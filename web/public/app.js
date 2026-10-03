/* Roșiori Map – front-end application (shared by web and Android WebView). */
(() => {
  'use strict';
  const CFG = window.ROSIORI_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DAY_RO = { mon: 'Luni', tue: 'Marți', wed: 'Miercuri', thu: 'Joi', fri: 'Vineri', sat: 'Sâmbătă', sun: 'Duminică' };
  const TYPES = { all: 'Toate', restaurant: 'Restaurante', pizzerie: 'Pizzerii', cafenea: 'Cafenele', fastfood: 'Fast-food', patiserie: 'Patiserii', bar: 'Baruri' };
  const EMOJI = { restaurant: '🍽️', pizzerie: '🍕', cafenea: '☕', fastfood: '🍔', patiserie: '🥐', bar: '🍹' };

  const state = { restaurants: [], filter: 'all', query: '', activeId: null, markers: new Map(), userMarker: null };

  /* ---------------- Settings / storage ---------------- */
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('rm_' + k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem('rm_' + k, JSON.stringify(v)),
  };
  // Android bridge can inject the server URL; otherwise use saved/explicit config.
  const apiBase = () => (store.get('apiBase', null) ?? CFG.apiBase ?? '').replace(/\/$/, '');
  const isLocalMode = () => location.protocol === 'file:' || (location.hostname === 'appassets.androidplatform.net' && !apiBase());

  /* ---------------- API (with offline fallback for the Android build) ---------------- */
  async function http(path, opts = {}) {
    const res = await fetch(apiBase() + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Eroare ${res.status}`);
    return body;
  }

  const local = {
    all: () => store.get('localReservations', []),
    save: (list) => store.set('localReservations', list),
  };

  function localSlots(r, date) {
    const d = new Date(date + 'T12:00:00');
    const h = (r.hours && (r.hours[DAYS[d.getDay()]] || r.hours.default)) || '10:00-22:00';
    if (h === 'closed') return [];
    const [o, c] = h.split('-'); const toM = (t) => t.split(':').reduce((a, b) => a * 60 + +b, 0);
    let s = toM(o), e = toM(c); if (e <= s) e += 1440;
    const out = [];
    for (let m = s; m <= e - 60; m += 30) { const mm = m % 1440; out.push(`${String(mm / 60 | 0).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`); }
    const cap = r.capacity || 40;
    return out.map((time) => ({ time, remaining: cap - local.all().filter((x) => x.restaurantId === r.id && x.date === date && x.time === time && x.status !== 'cancelled').reduce((a, x) => a + x.guests, 0) }));
  }

  const api = {
    async restaurants() {
      try { return await http('/api/restaurants'); }
      catch { const r = await fetch('data/restaurants.json'); return r.json(); }
    },
    async availability(r, date) {
      if (isLocalMode()) return localSlots(r, date);
      try { return (await http(`/api/restaurants/${r.id}/availability?date=${date}`)).slots; }
      catch { return localSlots(r, date); }
    },
    async reserve(payload) {
      if (!isLocalMode()) {
        try { return await http('/api/reservations', { method: 'POST', body: JSON.stringify(payload) }); }
        catch (e) { if (!/Failed to fetch|NetworkError|Load failed/i.test(e.message)) throw e; }
      }
      // Offline: keep locally so the user still has a record.
      const r = state.restaurants.find((x) => x.id === payload.restaurantId);
      const item = { ...payload, id: crypto.randomUUID?.() || String(Date.now()), code: Math.random().toString(16).slice(2, 8).toUpperCase(), restaurantName: r.name, status: 'pending-offline', createdAt: new Date().toISOString(), offline: true };
      local.save([...local.all(), item]);
      return item;
    },
    async mine(phone) {
      const offline = local.all().filter((x) => x.phone.replace(/[^\d+]/g, '') === phone.replace(/[^\d+]/g, ''));
      if (isLocalMode()) return offline;
      try { return [...(await http(`/api/reservations?phone=${encodeURIComponent(phone)}`)), ...offline]; }
      catch { return offline; }
    },
    async cancel(item, phone) {
      if (item.offline) { local.save(local.all().map((x) => (x.id === item.id ? { ...x, status: 'cancelled' } : x))); return; }
      await http(`/api/reservations/${item.id}?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' });
    },
  };

  /* ---------------- Helpers ---------------- */
  function todayHours(r, d = new Date()) { return (r.hours && (r.hours[DAYS[d.getDay()]] || r.hours.default)) || null; }
  function isOpen(r, d = new Date()) {
    const h = todayHours(r, d);
    if (!h || h === 'closed') return false;
    if (h === '00:00-24:00') return true;
    const [o, c] = h.split('-'); const toM = (t) => t.split(':').reduce((a, b) => a * 60 + +b, 0);
    const now = d.getHours() * 60 + d.getMinutes(); let s = toM(o), e = toM(c);
    return e > s ? now >= s && now < e : now >= s || now < e;
  }
  function distanceKm(a, b) {
    const R = 6371, toR = (x) => (x * Math.PI) / 180;
    const dLat = toR(b[0] - a[0]), dLon = toR(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function toast(msg, isError = false) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = 'toast'), 3200);
  }
  const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
  const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  /* ---------------- Native Android bridge & helpers ---------------- */
  const bridge = {
    isAndroid: () => typeof window.Android !== 'undefined',
    toast: (msg) => {
      if (window.Android?.toast) { window.Android.toast(msg); }
      else { toast(msg); }
    },
    share: async (title, text, url) => {
      if (window.Android?.share) { window.Android.share(title, text, url); return; }
      if (navigator.share) {
        try { await navigator.share({ title, text, url }); return; } catch {}
      }
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url);
        toast('Link copiat în clipboard! 📋');
      } else {
        toast(url);
      }
    },
    dial: (phone) => {
      if (!phone) return;
      if (window.Android?.dial) { window.Android.dial(phone); }
      else { location.href = 'tel:' + phone.replace(/[^\d+]/g, ''); }
    },
    navigate: (lat, lng, label) => {
      if (window.Android?.openMapNavigation) { window.Android.openMapNavigation(lat, lng, label); }
      else { window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener'); }
    }
  };

  /* ---------------- Map (Keyless OpenStreetMap by default) ---------------- */
  let currentTileLayer = null;
  function applyTileLayer() {
    if (currentTileLayer) { map.removeLayer(currentTileLayer); }
    const providerKey = store.get('mapProvider', 'osm');
    const providers = CFG.tileProviders || {};
    let url, attr, maxZoom = 19, subdomains = 'abc';

    if (providerKey === 'custom') {
      url = store.get('customTileUrl', '') || CFG.tileUrl;
      attr = 'Custom Map Tiles';
    } else if (providers[providerKey]) {
      url = providers[providerKey].url;
      attr = providers[providerKey].attr;
      maxZoom = providers[providerKey].maxZoom || 19;
    } else {
      url = CFG.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      attr = CFG.tileAttribution || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    }

    currentTileLayer = L.tileLayer(url, { maxZoom, subdomains, attribution: attr }).addTo(map);
  }

  const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(CFG.center, CFG.zoom);
  applyTileLayer();

  function pinIcon(r, active) {
    return L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 40], html: `<div class="pin${active ? ' active' : ''}"><span>${EMOJI[r.type] || '🍽️'}</span></div>` });
  }
  function renderMarkers(list) {
    const ids = new Set(list.map((r) => r.id));
    state.markers.forEach((m, id) => { if (!ids.has(id)) { map.removeLayer(m); state.markers.delete(id); } });
    list.forEach((r) => {
      if (state.markers.has(r.id)) return;
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(r, false), title: r.name, riseOnHover: true }).addTo(map);
      m.on('click', () => openRestaurant(r.id));
      state.markers.set(r.id, m);
    });
  }
  function setActiveMarker(id) {
    state.markers.forEach((m, mid) => {
      const r = state.restaurants.find((x) => x.id === mid);
      m.setIcon(pinIcon(r, mid === id)); m.setZIndexOffset(mid === id ? 1000 : 0);
    });
  }

  /* ---------------- List ---------------- */
  function filtered() {
    const q = state.query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let list = state.restaurants.filter((r) => state.filter === 'all' || r.type === state.filter);
    if (q) {
      list = list.filter((r) => norm(r.name).includes(q) || norm(r.cuisine).includes(q) || norm(r.address).includes(q) ||
        (r.menu || []).some((c) => c.items.some((i) => norm(i.name).includes(q))));
    }
    if (state.userPos) list = [...list].sort((a, b) => distanceKm(state.userPos, [a.lat, a.lng]) - distanceKm(state.userPos, [b.lat, b.lng]));
    return list;
  }

  function renderFilters() {
    const present = new Set(state.restaurants.map((r) => r.type));
    $('#filters').innerHTML = Object.entries(TYPES).filter(([k]) => k === 'all' || present.has(k))
      .map(([k, v]) => `<button class="filter${state.filter === k ? ' active' : ''}" data-filter="${k}" id="filter-${k}" role="tab">${k === 'all' ? '' : EMOJI[k] + ' '}${v}</button>`).join('');
  }

  function renderList() {
    const list = filtered();
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'local' : 'localuri'} în Roșiorii de Vede`;
    $('#list').innerHTML = list.length ? list.map((r, i) => {
      const open = isOpen(r);
      const dist = state.userPos ? `<span>📍 ${distanceKm(state.userPos, [r.lat, r.lng]).toFixed(1)} km</span>` : '';
      return `<li class="card${state.activeId === r.id ? ' active' : ''}" data-id="${r.id}" id="card-${r.id}" style="animation-delay:${Math.min(i * 30, 300)}ms" tabindex="0">
        <div class="card-emoji">${EMOJI[r.type] || '🍽️'}</div>
        <div><h3>${esc(r.name)}</h3><div class="meta"><span>${esc(r.cuisine)}</span>${dist}${r.priceLevel ? `<span>${'💰'.repeat(r.priceLevel)}</span>` : ''}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <span class="badge ${open ? 'open' : 'closed'}">${open ? 'Deschis' : 'Închis'}</span>
          ${r.menu?.length ? '<span class="badge menu">Meniu</span>' : ''}
        </div></li>`;
    }).join('') : '<li class="empty">Niciun rezultat. Încearcă alt termen. 🔍</li>';
    renderMarkers(list);
  }

  /* ---------------- Drawer (restaurant details & menu) ---------------- */
  function openRestaurant(id) {
    const r = state.restaurants.find((x) => x.id === id); if (!r) return;
    state.activeId = id; setActiveMarker(id);
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
    map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    const open = isOpen(r); const today = DAYS[new Date().getDay()];
    const hoursRows = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => {
      const h = (r.hours && (r.hours[d] || r.hours.default)) || '—';
      return `<span class="${d === today ? 'today' : ''}">${DAY_RO[d]}</span><span class="${d === today ? 'today' : ''}">${h === 'closed' ? 'Închis' : h === '00:00-24:00' ? 'Non-stop' : h}</span>`;
    }).join('');
    const totalMenuItems = (r.menu || []).reduce((s, c) => s + c.items.length, 0);
    const menuHtml = r.menu?.length ? `
      <section class="section">
        <h3>Meniu (${totalMenuItems} preparate)</h3>
        <div class="menu-search-wrap">
          <input type="search" class="menu-search-input" id="menu-search" placeholder="Caută preparat în meniu..." autocomplete="off" />
        </div>
        <div class="menu-tabs" id="menu-tabs">${r.menu.map((c, i) => `<button class="menu-tab${i === 0 ? ' active' : ''}" data-cat="${i}">${esc(c.category)} (${c.items.length})</button>`).join('')}</div>
        <div id="menu-items"></div>
        ${r.menuSource ? `<p class="note">Sursa meniului: <a href="${esc(r.menuSource)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(r.menuSource.replace(/^https?:\/\//, ''))}</a>. Prețurile pot varia.</p>` : ''}
      </section>` : `<section class="section"><h3>Meniu</h3><p class="note">Meniul nu este încă disponibil online. Sună la local pentru oferta zilei.</p></section>`;

    $('#drawer-content').innerHTML = `
      <header class="hero">
        <div class="emoji">${EMOJI[r.type] || '🍽️'}</div>
        <h2>${esc(r.name)}</h2>
        <p>${esc(r.description || r.cuisine)}</p>
        <div class="tags"><span class="tag">${open ? '🟢 Deschis acum' : '🔴 Închis acum'}</span>${(r.features || []).map((f) => `<span class="tag">${esc(f)}</span>`).join('')}</div>
      </header>
      <div class="actions">
        <button class="btn primary" id="btn-reserve" ${r.reservable ? '' : 'disabled'}>${r.reservable ? '📅 Rezervă o masă' : 'Fără rezervări (doar la tejghea / livrare)'}</button>
        ${r.phone ? `<button class="btn" id="btn-call" type="button">📞 Sună</button>` : ''}
        <button class="btn" id="btn-directions" type="button">🧭 Traseu</button>
        <button class="btn" id="btn-share" type="button">🔗 Distribuie</button>
      </div>
      <section class="section"><h3>Informații & Contact</h3>
        <div class="info-row">📍 <span>${esc(r.address)}, Roșiorii de Vede</span></div>
        ${r.phone ? `<div class="info-row">📞 <a href="tel:${esc(r.phone.replace(/\s/g, ''))}">${esc(r.phone)}</a></div>` : ''}
        ${r.website ? `<div class="info-row">🌐 <a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.website.replace(/^https?:\/\//, ''))}</a></div>` : ''}
      </section>
      <section class="section"><h3>Program de Funcționare</h3><div class="hours-grid">${hoursRows}</div></section>
      ${menuHtml}`;

    // Action buttons
    $('#btn-call')?.addEventListener('click', () => bridge.dial(r.phone));
    $('#btn-directions')?.addEventListener('click', () => bridge.navigate(r.lat, r.lng, r.name));
    $('#btn-share')?.addEventListener('click', () => bridge.share(
      `${r.name} – Roșiori Map`,
      `Vezi meniul și programul pentru ${r.name} din Roșiorii de Vede pe Roșiori Map!`,
      location.origin + location.pathname + '#' + r.id
    ));

    if (r.menu?.length) {
      let activeCatIdx = 0;
      const renderItems = (items) => {
        if (!items.length) {
          $('#menu-items').innerHTML = `<p class="empty" style="padding:15px 0">Niciun preparat găsit.</p>`;
          return;
        }
        $('#menu-items').innerHTML = items.map((it) => `
          <div class="menu-item">
            <div>
              <div class="name">${esc(it.name)}</div>
              ${it.desc ? `<div class="desc">${esc(it.desc)}</div>` : ''}
            </div>
            <div class="price">${it.price != null ? `${Number(it.price).toFixed(it.price % 1 ? 2 : 0)} lei` : ''}</div>
          </div>`).join('');
      };

      const updateMenuDisplay = () => {
        const query = ($('#menu-search')?.value || '').trim().toLowerCase();
        if (query) {
          const matched = [];
          r.menu.forEach((c) => {
            c.items.forEach((it) => {
              if (it.name.toLowerCase().includes(query) || (it.desc && it.desc.toLowerCase().includes(query))) {
                matched.push(it);
              }
            });
          });
          renderItems(matched);
        } else {
          renderItems(r.menu[activeCatIdx]?.items || []);
        }
      };

      renderItems(r.menu[0].items);

      $('#menu-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('.menu-tab'); if (!b) return;
        document.querySelectorAll('.menu-tab').forEach((x) => x.classList.toggle('active', x === b));
        activeCatIdx = +b.dataset.cat;
        if ($('#menu-search')) $('#menu-search').value = '';
        updateMenuDisplay();
      });

      $('#menu-search')?.addEventListener('input', updateMenuDisplay);
    }
    $('#btn-reserve')?.addEventListener('click', () => openReservation(r));
    $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawer-backdrop').hidden = false; $('#drawer').scrollTop = 0;
    history.replaceState(null, '', '#' + r.id);
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawer-backdrop').hidden = true; state.activeId = null; setActiveMarker(null);
    document.querySelectorAll('.card.active').forEach((c) => c.classList.remove('active'));
    history.replaceState(null, '', location.pathname + location.search);
  }

  /* ---------------- Modal helpers ---------------- */
  const modal = $('#modal');
  function openModal(html) { $('#modal-content').innerHTML = `<div class="modal-body">${html}</div>`; if (!modal.open) modal.showModal(); }
  function closeModal() { modal.close(); }
  $('#modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  /* ---------------- Reservation flow ---------------- */
  function openReservation(r) {
    const profile = store.get('profile', {});
    const today = localISO(); const max = localISO(new Date(Date.now() + 60 * 864e5));
    let guests = 2; let selected = null;
    openModal(`
      <h2>Rezervare la ${esc(r.name)}</h2>
      <p class="sub">Alege data, ora și numărul de persoane.${isLocalMode() ? ' <br>⚠️ Mod offline: rezervarea se salvează local – confirmă telefonic.' : ''}</p>
      <form id="res-form" novalidate>
        <div class="row">
          <div class="field"><label for="res-date">Data</label><input type="date" id="res-date" min="${today}" max="${max}" value="${today}" required /></div>
          <div class="field"><label>Persoane</label><div class="stepper"><button type="button" id="g-minus" aria-label="Mai puțini">−</button><output id="g-val">2</output><button type="button" id="g-plus" aria-label="Mai mulți">+</button></div></div>
        </div>
        <div class="field"><label>Ora</label><div class="slots" id="slots"><span class="note">Se încarcă…</span></div></div>
        <div class="field"><label for="res-name">Nume</label><input id="res-name" autocomplete="name" value="${esc(profile.name || '')}" required placeholder="Ion Popescu" /></div>
        <div class="field"><label for="res-phone">Telefon</label><input id="res-phone" type="tel" autocomplete="tel" value="${esc(profile.phone || '')}" required placeholder="07xx xxx xxx" /></div>
        <div class="field"><label for="res-notes">Observații (opțional)</label><textarea id="res-notes" rows="2" placeholder="Ex: masă pe terasă, scaun copil…"></textarea></div>
        <button class="btn primary" type="submit" id="res-submit" style="width:100%">Confirmă rezervarea</button>
      </form>`);

    const loadSlots = async () => {
      const date = $('#res-date').value; selected = null;
      $('#slots').innerHTML = '<span class="note">Se încarcă…</span>';
      const slots = await api.availability(r, date);
      const now = new Date(); const isToday = date === localISO();
      const nowM = now.getHours() * 60 + now.getMinutes() + 30;
      const vis = slots.filter((s) => !isToday || s.time.split(':').reduce((a, b) => a * 60 + +b, 0) >= nowM);
      $('#slots').innerHTML = vis.length ? vis.map((s) => `<button type="button" class="slot" data-time="${s.time}" ${s.remaining < guests ? 'disabled' : ''} title="${s.remaining} locuri libere">${s.time}</button>`).join('')
        : '<span class="note">Nu mai sunt intervale disponibile în această zi.</span>';
    };
    $('#res-date').addEventListener('change', loadSlots);
    $('#g-minus').addEventListener('click', () => { guests = Math.max(1, guests - 1); $('#g-val').textContent = guests; loadSlots(); });
    $('#g-plus').addEventListener('click', () => { guests = Math.min(30, guests + 1); $('#g-val').textContent = guests; loadSlots(); });
    $('#slots').addEventListener('click', (e) => {
      const b = e.target.closest('.slot'); if (!b || b.disabled) return;
      document.querySelectorAll('.slot').forEach((x) => x.classList.toggle('selected', x === b)); selected = b.dataset.time;
    });
    $('#res-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#res-name').value.trim(); const phone = $('#res-phone').value.trim();
      if (!selected) return toast('Alege o oră', true);
      if (name.length < 2) return toast('Completează numele', true);
      if (phone.replace(/\D/g, '').length < 9) return toast('Telefon invalid', true);
      const btn = $('#res-submit'); btn.disabled = true; btn.textContent = 'Se trimite…';
      try {
        const item = await api.reserve({ restaurantId: r.id, name, phone, date: $('#res-date').value, time: selected, guests, notes: $('#res-notes').value });
        store.set('profile', { name, phone });
        openModal(`<div class="success"><div class="check">✓</div><h2>${item.offline ? 'Rezervare salvată' : 'Rezervare confirmată!'}</h2>
          <p class="sub">${esc(r.name)} · ${fmtDate(item.date)} · ${item.time} · ${item.guests} pers.</p>
          <div>Cod rezervare</div><div class="code">${esc(item.code)}</div>
          <p class="note">${item.offline ? 'Serverul nu este accesibil. Te rugăm să confirmi telefonic.' : 'Prezintă codul la sosire.'}</p>
          ${r.phone ? `<a class="btn" href="tel:${esc(r.phone.replace(/\s/g, ''))}" style="margin-top:10px">📞 ${esc(r.phone)}</a>` : ''}</div>`);
      } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Confirmă rezervarea'; }
    });
    loadSlots();
  }

  /* ---------------- My reservations ---------------- */
  async function openMyReservations() {
    const profile = store.get('profile', {});
    openModal(`<h2>Rezervările mele</h2><p class="sub">Introdu telefonul folosit la rezervare.</p>
      <form id="my-form" class="row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="field" style="margin:0"><label for="my-phone">Telefon</label><input id="my-phone" type="tel" value="${esc(profile.phone || '')}" placeholder="07xx xxx xxx" /></div>
        <button class="btn" type="submit" id="my-search">Caută</button>
      </form><div id="my-list" style="margin-top:16px"></div>`);
    const load = async () => {
      const phone = $('#my-phone').value.trim(); if (!phone) return;
      $('#my-list').innerHTML = '<p class="note">Se încarcă…</p>';
      try {
        const list = (await api.mine(phone)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        $('#my-list').innerHTML = list.length ? list.map((x) => `
          <div class="res-item ${x.status === 'cancelled' ? 'cancelled' : ''}">
            <h4>${esc(x.restaurantName)}</h4>
            <div class="meta">${fmtDate(x.date)} · ${x.time} · ${x.guests} pers. · cod <b>${esc(x.code)}</b></div>
            <div class="meta">${x.status === 'cancelled' ? '❌ Anulată' : x.offline ? '⏳ Salvată offline' : '✅ Confirmată'}</div>
            ${x.status !== 'cancelled' && x.date >= localISO() ? `<button class="btn danger" data-cancel="${x.id}">Anulează</button>` : ''}
          </div>`).join('') : '<p class="empty">Nu ai rezervări.</p>';
        $('#my-list').onclick = async (e) => {
          const id = e.target.dataset.cancel; if (!id) return;
          const item = list.find((x) => x.id === id);
          if (!confirm(`Anulezi rezervarea la ${item.restaurantName}?`)) return;
          try { await api.cancel(item, phone); toast('Rezervare anulată'); load(); } catch (err) { toast(err.message, true); }
        };
      } catch (err) { $('#my-list').innerHTML = `<p class="empty">${esc(err.message)}</p>`; }
    };
    $('#my-form').addEventListener('submit', (e) => { e.preventDefault(); load(); });
    if (profile.phone) load();
  }

  /* ---------------- Settings ---------------- */
  function openSettings() {
    const currentProvider = store.get('mapProvider', 'osm');
    const customUrl = store.get('customTileUrl', '');
    const api = store.get('apiBase', '') || '';

    openModal(`<h2>Setări Aplicație</h2>
      <form id="set-form">
        <h3 style="font-size:1rem;margin:12px 0 6px">🗺️ Furnizor Hartă</h3>
        <p class="sub" style="margin-bottom:8px">OpenStreetMap Standard funcționează gratuit fără cheie API.</p>
        <div class="field">
          <label for="set-map-provider">Stil Hartă</label>
          <select id="set-map-provider">
            <option value="osm" ${currentProvider === 'osm' ? 'selected' : ''}>OpenStreetMap Standard (Fără cheie API ✓)</option>
            <option value="opentopo" ${currentProvider === 'opentopo' ? 'selected' : ''}>OpenTopoMap (Topografic / Relief)</option>
            <option value="carto" ${currentProvider === 'carto' ? 'selected' : ''}>CARTO Voyager</option>
            <option value="custom" ${currentProvider === 'custom' ? 'selected' : ''}>URL Personalizat (Tile Server)</option>
          </select>
        </div>
        <div class="field" id="field-custom-url" style="${currentProvider === 'custom' ? '' : 'display:none'}">
          <label for="set-custom-url">URL Șablon Tile (ex: https://{s}.tile.server/{z}/{x}/{y}.png)</label>
          <input id="set-custom-url" type="url" placeholder="https://..." value="${esc(customUrl)}" />
        </div>

        <h3 style="font-size:1rem;margin:18px 0 6px">🌐 Server Sincronizare</h3>
        <p class="sub" style="margin-bottom:8px">Pentru rezervări în rețea (lasă gol pentru serverul local/curent).</p>
        <div class="field">
          <label for="set-api">Adresă server API</label>
          <input id="set-api" type="url" placeholder="https://rosiori-map.exemplu.ro" value="${esc(api)}" />
        </div>
        <p class="note">Mod curent: <b>${isLocalMode() ? 'offline (rezervări locale pe dispozitiv)' : 'online – ' + esc(apiBase() || location.origin)}</b></p>
        
        <button class="btn primary" type="submit" id="set-save" style="width:100%;margin-top:14px">Salvează Setările</button>
      </form>`);

    const select = $('#set-map-provider');
    const customField = $('#field-custom-url');
    select.addEventListener('change', () => {
      customField.style.display = select.value === 'custom' ? 'block' : 'none';
    });

    $('#set-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = $('#set-api').value.trim();
      const prov = select.value;
      const cUrl = $('#set-custom-url').value.trim();

      store.set('mapProvider', prov);
      if (prov === 'custom') { store.set('customTileUrl', cUrl); }
      applyTileLayer();

      if (v) {
        try {
          const r = await fetch(v.replace(/\/$/, '') + '/healthz');
          if (!r.ok) throw 0;
          toast('Conectat la server ✓ Hartă actualizată!');
        } catch {
          toast('Serverul nu răspunde – salvat oricum', true);
        }
      } else {
        toast('Setări salvate ✓ Hartă actualizată!');
      }
      store.set('apiBase', v || null);
      closeModal();
    });
  }

  /* ---------------- Events ---------------- */
  $('#search').addEventListener('input', (e) => { state.query = e.target.value; renderList(); });
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter'); if (!b) return; state.filter = b.dataset.filter; renderFilters(); renderList();
  });
  $('#list').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openRestaurant(c.dataset.id); });
  $('#list').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const c = e.target.closest('.card'); if (c) openRestaurant(c.dataset.id); } });
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#btn-my-res').addEventListener('click', openMyReservations);
  $('#btn-settings').addEventListener('click', openSettings);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.open) closeDrawer(); });

  $('#btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Geolocația nu este disponibilă', true);
    navigator.geolocation.getCurrentPosition((p) => {
      state.userPos = [p.coords.latitude, p.coords.longitude];
      if (state.userMarker) state.userMarker.setLatLng(state.userPos);
      else state.userMarker = L.marker(state.userPos, { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [18, 18] }) }).addTo(map);
      map.flyTo(state.userPos, 16); renderList(); toast('Sortat după distanță 📍');
    }, () => toast('Nu am putut obține locația', true), { enableHighAccuracy: true, timeout: 10000 });
  });

  // Mobile bottom sheet: tap/drag the handle to cycle sizes.
  const sheet = $('#sidebar'); const handle = $('#sheet-handle');
  const setSheet = (mode) => {
    sheet.classList.toggle('expanded', mode === 'expanded'); sheet.classList.toggle('collapsed', mode === 'collapsed');
    document.body.classList.toggle('sheet-expanded', mode === 'expanded'); document.body.classList.toggle('sheet-collapsed', mode === 'collapsed');
    setTimeout(() => map.invalidateSize(), 320);
  };
  let startY = null;
  handle.addEventListener('pointerdown', (e) => { startY = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointerup', (e) => {
    const dy = e.clientY - (startY ?? e.clientY); startY = null;
    const cur = sheet.classList.contains('expanded') ? 'expanded' : sheet.classList.contains('collapsed') ? 'collapsed' : 'mid';
    if (Math.abs(dy) < 8) setSheet(cur === 'mid' ? 'expanded' : 'mid');
    else if (dy < 0) setSheet(cur === 'collapsed' ? 'mid' : 'expanded');
    else setSheet(cur === 'expanded' ? 'mid' : 'collapsed');
  });
  $('#search').addEventListener('focus', () => { if (innerWidth <= 760) setSheet('expanded'); });

  /* ---------------- Android & Back Navigation ---------------- */
  window.handleBackPressed = () => {
    if (modal.open) { closeModal(); return true; }
    if ($('#drawer').classList.contains('open')) { closeDrawer(); return true; }
    if (sheet.classList.contains('expanded')) { setSheet('mid'); return true; }
    return false;
  };
  window.addEventListener('popstate', () => {
    if (modal.open) closeModal();
    else if ($('#drawer').classList.contains('open')) closeDrawer();
  });

  /* ---------------- Boot ---------------- */
  (async () => {
    try {
      state.restaurants = await api.restaurants();
      renderFilters(); renderList();
      const deep = location.hash.slice(1); if (deep) openRestaurant(deep);
    } catch (e) { console.error(e); toast('Nu am putut încărca restaurantele', true); }
  })();

  if ('serviceWorker' in navigator && location.protocol === 'https:' && location.hostname !== 'appassets.androidplatform.net') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
