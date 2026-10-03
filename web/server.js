'use strict';
/**
 * Roșiori Map – zero-dependency Node.js server.
 * Serves the static web app from ./public and exposes a small REST API
 * for restaurants and reservations. Reservations are persisted as JSON
 * in DATA_DIR (mounted as a PersistentVolume in Kubernetes).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8080', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'var');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const RESTAURANTS_FILE = path.join(PUBLIC_DIR, 'data', 'restaurants.json');
const RES_FILE = path.join(DATA_DIR, 'reservations.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const restaurants = JSON.parse(fs.readFileSync(RESTAURANTS_FILE, 'utf8'));
const byId = new Map(restaurants.map((r) => [r.id, r]));

let reservations = [];
try { reservations = JSON.parse(fs.readFileSync(RES_FILE, 'utf8')); } catch { reservations = []; }

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = RES_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(reservations, null, 2));
    fs.renameSync(tmp, RES_FILE);
  }, 50);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

const normPhone = (p) => String(p || '').replace(/[^\d+]/g, '');
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Generate bookable 30-min slots for a restaurant/date based on its hours. */
function slotsFor(r, date) {
  const d = new Date(date + 'T12:00:00');
  const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()];
  const h = (r.hours && (r.hours[day] || r.hours.default)) || '10:00-22:00';
  if (h === 'closed') return [];
  const [open, close] = h.split('-');
  const toMin = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  let start = toMin(open); let end = toMin(close); if (end <= start) end += 24 * 60;
  const out = [];
  for (let m = start; m <= end - 60; m += 30) {
    const mm = m % (24 * 60);
    out.push(`${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`);
  }
  return out;
}

function availability(r, date) {
  const cap = r.capacity || 40;
  return slotsFor(r, date).map((time) => {
    const booked = reservations
      .filter((x) => x.restaurantId === r.id && x.date === date && x.time === time && x.status !== 'cancelled')
      .reduce((s, x) => s + x.guests, 0);
    return { time, remaining: Math.max(0, cap - booked) };
  });
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const m = req.method;

  if (parts[1] === 'restaurants' && parts.length === 2 && m === 'GET') return send(res, 200, restaurants);

  if (parts[1] === 'restaurants' && parts[3] === 'availability' && m === 'GET') {
    const r = byId.get(parts[2]); const date = url.searchParams.get('date');
    if (!r) return send(res, 404, { error: 'Restaurant inexistent' });
    if (!DATE_RE.test(date || '')) return send(res, 400, { error: 'Dată invalidă' });
    return send(res, 200, { restaurantId: r.id, date, slots: availability(r, date) });
  }

  if (parts[1] === 'reservations' && parts.length === 2 && m === 'POST') {
    let b; try { b = await readBody(req); } catch { return send(res, 400, { error: 'JSON invalid' }); }
    const r = byId.get(b.restaurantId);
    const guests = parseInt(b.guests, 10);
    const phone = normPhone(b.phone);
    if (!r) return send(res, 404, { error: 'Restaurant inexistent' });
    if (!r.reservable) return send(res, 400, { error: 'Acest local nu acceptă rezervări' });
    if (!b.name || String(b.name).trim().length < 2) return send(res, 400, { error: 'Numele este obligatoriu' });
    if (phone.replace('+', '').length < 9) return send(res, 400, { error: 'Telefon invalid' });
    if (!DATE_RE.test(b.date || '') || !TIME_RE.test(b.time || '')) return send(res, 400, { error: 'Dată/oră invalidă' });
    if (!(guests >= 1 && guests <= 30)) return send(res, 400, { error: 'Număr de persoane invalid (1-30)' });
    const today = new Date().toISOString().slice(0, 10);
    if (b.date < today) return send(res, 400, { error: 'Data este în trecut' });
    const slot = availability(r, b.date).find((s) => s.time === b.time);
    if (!slot) return send(res, 400, { error: 'Ora nu este în programul localului' });
    if (slot.remaining < guests) return send(res, 409, { error: `Mai sunt doar ${slot.remaining} locuri la această oră` });
    const item = {
      id: crypto.randomUUID(), code: crypto.randomBytes(3).toString('hex').toUpperCase(),
      restaurantId: r.id, restaurantName: r.name, name: String(b.name).trim().slice(0, 80), phone,
      email: String(b.email || '').slice(0, 120), date: b.date, time: b.time, guests,
      notes: String(b.notes || '').slice(0, 500), status: 'confirmed', createdAt: new Date().toISOString(),
    };
    reservations.push(item); persist();
    console.log(`[reservation] ${item.code} ${r.name} ${item.date} ${item.time} x${guests}`);
    return send(res, 201, item);
  }

  if (parts[1] === 'reservations' && parts.length === 2 && m === 'GET') {
    const phone = normPhone(url.searchParams.get('phone'));
    if (!phone) return send(res, 400, { error: 'Telefonul este necesar' });
    return send(res, 200, reservations.filter((x) => x.phone === phone).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
  }

  if (parts[1] === 'reservations' && parts.length === 3 && m === 'DELETE') {
    const item = reservations.find((x) => x.id === parts[2]);
    const phone = normPhone(url.searchParams.get('phone'));
    if (!item) return send(res, 404, { error: 'Rezervare inexistentă' });
    if (item.phone !== phone) return send(res, 403, { error: 'Telefonul nu corespunde' });
    item.status = 'cancelled'; persist();
    return send(res, 200, item);
  }

  if (parts[1] === 'admin' && parts[2] === 'reservations' && m === 'GET') {
    if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return send(res, 401, { error: 'Unauthorized' });
    const rid = url.searchParams.get('restaurantId');
    return send(res, 200, rid ? reservations.filter((x) => x.restaurantId === rid) : reservations);
  }

  return send(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback
      return fs.createReadStream(path.join(PUBLIC_DIR, 'index.html'))
        .on('open', () => res.writeHead(200, { 'Content-Type': MIME['.html'] })).pipe(res);
    }
    const ext = path.extname(file);
    const cache = ext === '.html' || p === '/sw.js' ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname === '/healthz') return send(res, 200, { status: 'ok', restaurants: restaurants.length });
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Eroare internă' });
  }
});

server.listen(PORT, () => console.log(`Roșiori Map listening on :${PORT} (data: ${DATA_DIR})`));
process.on('SIGTERM', () => { clearTimeout(saveTimer); try { fs.writeFileSync(RES_FILE, JSON.stringify(reservations, null, 2)); } catch {} process.exit(0); });
