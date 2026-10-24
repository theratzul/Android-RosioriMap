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

  const PARK_TYPES = {
    all: 'Toate',
    parc: 'Parcuri Urbane',
    padure: 'Pădure & Natură',
    agrement: 'Baze Agrement',
    strand: 'Ștrand & Natație',
    balci: 'Bâlci & Tradiție'
  };
  const PARK_EMOJI = {
    parc: '🌳',
    padure: '🌲',
    agrement: '⚽',
    strand: '🏊',
    balci: '🎡'
  };

  const state = {
    restaurants: [],
    parks: [],
    mode: 'restaurants', // 'restaurants' | 'parks'
    filter: 'all',
    parksFilter: 'all',
    submenuFilter: 'all',
    query: '',
    parksQuery: '',
    submenuQuery: '',
    activeId: null,
    activeParkId: null,
    markers: new Map(),
    parkMarkers: new Map(),
    userMarker: null,
    userPos: null
  };

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
    async parks() {
      try { return await http('/api/parks'); }
      catch { const r = await fetch('data/parks.json'); return r.json(); }
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
      attr = '';
    }

    currentTileLayer = L.tileLayer(url, { maxZoom, subdomains, attribution: '' }).addTo(map);
  }

  const map = L.map('map', { zoomControl: false, attributionControl: false }).setView(CFG.center, CFG.zoom);
  if (map.attributionControl) { map.attributionControl.remove(); }
  applyTileLayer();

  // Emblem marker for Roșiori de Vede on map
  const cityEmblem = L.marker(CFG.center, {
    icon: L.divIcon({
      className: 'city-center-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: `<div class="city-marker-pulse" title="Roșiori de Vede ☩">
               <img src="icons/icon.svg?v=2" width="26" height="26" alt="Roșiori Map" />
             </div>`
    }),
    zIndexOffset: -50
  }).addTo(map);

  cityEmblem.on('click', () => {
    map.flyTo(CFG.center, 16);
    toast('📍 Centrul Municipiului Roșiorii de Vede ☩');
  });

  function pinIcon(r, active) {
    return L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 40], html: `<div class="pin${active ? ' active' : ''}"><span>${EMOJI[r.type] || '🍽️'}</span></div>` });
  }

  function parkPinIcon(p, active) {
    return L.divIcon({
      className: '',
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      html: `<div class="pin pin-park${active ? ' active' : ''}"><span>${p.emoji || PARK_EMOJI[p.category] || '🌳'}</span></div>`
    });
  }

  function renderMarkers(list) {
    const ids = new Set(list.map((r) => r.id));
    state.markers.forEach((m, id) => { if (!ids.has(id)) { map.removeLayer(m); state.markers.delete(id); } });
    list.forEach((r) => {
      if (state.markers.has(r.id)) return;
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(r, false), title: r.name, riseOnHover: true }).addTo(map);
      m.on('click', () => {
        setMode('restaurants');
        openRestaurant(r.id);
      });
      state.markers.set(r.id, m);
    });
  }

  function renderParkMarkers(list) {
    const ids = new Set(list.map((p) => p.id));
    state.parkMarkers.forEach((m, id) => {
      if (!ids.has(id)) {
        map.removeLayer(m);
        state.parkMarkers.delete(id);
      }
    });
    list.forEach((p) => {
      if (state.parkMarkers.has(p.id)) return;
      const m = L.marker([p.lat, p.lng], {
        icon: parkPinIcon(p, false),
        title: p.name,
        riseOnHover: true
      }).addTo(map);
      m.on('click', () => {
        setMode('parks');
        openPark(p.id);
      });
      state.parkMarkers.set(p.id, m);
    });
  }

  function setActiveMarker(id) {
    state.markers.forEach((m, mid) => {
      const r = state.restaurants.find((x) => x.id === mid);
      if (r) m.setIcon(pinIcon(r, mid === id));
      m.setZIndexOffset(mid === id ? 1000 : 0);
    });
  }

  function setActiveParkMarker(id) {
    state.parkMarkers.forEach((m, mid) => {
      const p = state.parks.find((x) => x.id === mid);
      if (p) m.setIcon(parkPinIcon(p, mid === id));
      m.setZIndexOffset(mid === id ? 1000 : 0);
    });
  }

  /* ---------------- List & Filters ---------------- */
  function filteredRestaurants() {
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

  function filteredParks() {
    const q = state.parksQuery.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let list = state.parks.filter((p) => state.parksFilter === 'all' || p.category === state.parksFilter);
    if (q) {
      list = list.filter((p) =>
        norm(p.name).includes(q) ||
        norm(p.categoryLabel).includes(q) ||
        norm(p.description).includes(q) ||
        norm(p.history).includes(q) ||
        norm(p.address).includes(q) ||
        (p.highlights || []).some((h) => norm(h).includes(q)) ||
        (p.features || []).some((f) => norm(f).includes(q))
      );
    }
    if (state.userPos) list = [...list].sort((a, b) => distanceKm(state.userPos, [a.lat, a.lng]) - distanceKm(state.userPos, [b.lat, b.lng]));
    return list;
  }

  function setMode(mode) {
    state.mode = mode;
    $('#btn-mode-restaurants')?.classList.toggle('active', mode === 'restaurants');
    $('#btn-mode-restaurants')?.setAttribute('aria-selected', mode === 'restaurants');
    $('#btn-mode-parks')?.classList.toggle('active', mode === 'parks');
    $('#btn-mode-parks')?.setAttribute('aria-selected', mode === 'parks');

    const searchInput = $('#search');
    if (searchInput) {
      searchInput.placeholder = mode === 'restaurants'
        ? 'Caută restaurant, preparat…'
        : 'Caută parcuri, pădure, agrement, istoric…';
      searchInput.value = mode === 'restaurants' ? state.query : state.parksQuery;
    }

    renderFilters();
    renderList();
  }

  function renderFilters() {
    const filtersWrap = $('#filters');
    if (!filtersWrap) return;
    if (state.mode === 'restaurants') {
      const present = new Set(state.restaurants.map((r) => r.type));
      filtersWrap.innerHTML = Object.entries(TYPES).filter(([k]) => k === 'all' || present.has(k))
        .map(([k, v]) => `<button class="filter${state.filter === k ? ' active' : ''}" data-filter="${k}" id="filter-${k}" role="tab">${k === 'all' ? '' : EMOJI[k] + ' '}${v}</button>`).join('');
    } else {
      filtersWrap.innerHTML = Object.entries(PARK_TYPES)
        .map(([k, v]) => `<button class="filter${state.parksFilter === k ? ' active' : ''}" data-filter="${k}" id="filter-park-${k}" role="tab">${k === 'all' ? '✨ ' : PARK_EMOJI[k] + ' '}${v}</button>`).join('');
    }
  }

  function renderList() {
    if (state.mode === 'restaurants') {
      const list = filteredRestaurants();
      $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'local' : 'localuri'} în Roșiorii de Vede`;
      $('#list').innerHTML = list.length ? list.map((r, i) => {
        const open = isOpen(r);
        const dist = state.userPos ? `<span>📍 ${distanceKm(state.userPos, [r.lat, r.lng]).toFixed(1)} km</span>` : '';
        return `<li class="card${state.activeId === r.id ? ' active' : ''}" data-id="${r.id}" data-type="restaurant" id="card-${r.id}" style="animation-delay:${Math.min(i * 30, 300)}ms" tabindex="0">
          <div class="card-emoji">${EMOJI[r.type] || '🍽️'}</div>
          <div><h3>${esc(r.name)}</h3><div class="meta"><span>${esc(r.cuisine)}</span>${dist}${r.priceLevel ? `<span>${'💰'.repeat(r.priceLevel)}</span>` : ''}</div></div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <span class="badge ${open ? 'open' : 'closed'}">${open ? 'Deschis' : 'Închis'}</span>
            ${r.menu?.length ? '<span class="badge menu">Meniu</span>' : ''}
          </div></li>`;
      }).join('') : '<li class="empty">Niciun rezultat. Încearcă alt termen. 🔍</li>';
      renderMarkers(list);
      // Ensure park markers are also on map for discovery
      renderParkMarkers(state.parks);
    } else {
      const list = filteredParks();
      $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'zonă verde / agrement' : 'zone verzi și de agrement'} în Roșiorii de Vede`;
      $('#list').innerHTML = list.length ? list.map((p, i) => {
        const dist = state.userPos ? `<span>📍 ${distanceKm(state.userPos, [p.lat, p.lng]).toFixed(1)} km</span>` : '';
        return `<li class="card card-park-item${state.activeParkId === p.id ? ' active' : ''}" data-id="${p.id}" data-type="park" id="card-park-${p.id}" style="animation-delay:${Math.min(i * 30, 300)}ms" tabindex="0">
          <div class="card-emoji" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff">${p.emoji || PARK_EMOJI[p.category] || '🌳'}</div>
          <div>
            <h3>${esc(p.name)}</h3>
            <div class="meta">
              <span>${esc(p.categoryLabel)}</span>
              ${dist}
              <span>${esc(p.badge || '')}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <span class="badge open">Verde</span>
            <span class="badge menu">Istoric</span>
          </div></li>`;
      }).join('') : '<li class="empty">Nicio zonă verde găsită. Încearcă alt termen. 🔍</li>';
      renderParkMarkers(list);
    }
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

  /* ---------------- Drawer (park details & history) ---------------- */
  function openPark(id) {
    const p = state.parks.find((x) => x.id === id);
    if (!p) return;
    state.activeParkId = id;
    state.activeId = null;
    setActiveParkMarker(id);
    setActiveMarker(null);
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });

    const dist = state.userPos ? distanceKm(state.userPos, [p.lat, p.lng]).toFixed(1) : null;

    $('#drawer-content').innerHTML = `
      <header class="hero hero-park">
        <div class="emoji">${p.emoji || PARK_EMOJI[p.category] || '🌳'}</div>
        <div style="margin-bottom:6px"><span class="badge-pill badge-live">${esc(p.badge || p.categoryLabel)}</span></div>
        <h2>${esc(p.name)}</h2>
        <p>${esc(p.description)}</p>
        <div class="tags">
          <span class="tag">🌿 ${esc(p.categoryLabel)}</span>
          <span class="tag">🎟️ ${esc(p.admission)}</span>
          <span class="tag">⏰ ${esc(p.schedule)}</span>
          ${dist ? `<span class="tag">📍 ${dist} km distanță</span>` : ''}
        </div>
      </header>
      <div class="actions">
        <button class="btn primary" id="btn-park-directions" type="button">🧭 Traseu / Navigare GPS</button>
        <button class="btn" id="btn-park-share" type="button">🔗 Distribuie</button>
        <button class="btn" id="btn-park-to-submenu" type="button">🌳 Submeniu Parcuri</button>
      </div>
      <section class="section">
        <h3>📍 Localizare & Accesibilitate</h3>
        <div class="info-row">📍 <span><strong>Adresă:</strong> ${esc(p.address)}</span></div>
        <div class="info-row">⏰ <span><strong>Program:</strong> ${esc(p.schedule)}</span></div>
        <div class="info-row">🎟️ <span><strong>Tarif / Acces:</strong> ${esc(p.admission)}</span></div>
      </section>
      <section class="section">
        <h3>📖 Istoric & Semnificație Tradițională</h3>
        <div class="park-history-text">${esc(p.history)}</div>
      </section>
      <section class="section">
        <h3>✨ Atracții & Repere Relevante</h3>
        <ul class="park-highlights-list">
          ${(p.highlights || []).map((h) => `<li>${esc(h)}</li>`).join('')}
        </ul>
      </section>
      <section class="section">
        <h3>🏷️ Facilități & Caracteristici</h3>
        <div class="tags">
          ${(p.features || []).map((f) => `<span class="tag tag-feature">✦ ${esc(f)}</span>`).join('')}
        </div>
      </section>`;

    $('#btn-park-directions')?.addEventListener('click', () => bridge.navigate(p.lat, p.lng, p.name));
    $('#btn-park-share')?.addEventListener('click', () => bridge.share(
      `${p.name} – Roșiori Map`,
      `Descoperă ${p.name} din Roșiorii de Vede pe Roșiori Map! Istoric, atracții și localizare GPS.`,
      location.origin + location.pathname + '#park-' + p.id
    ));
    $('#btn-park-to-submenu')?.addEventListener('click', () => {
      closeDrawer();
      showView('parks');
    });

    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawer-backdrop').hidden = false;
    $('#drawer').scrollTop = 0;
    history.replaceState(null, '', '#park-' + p.id);
  }

  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawer-backdrop').hidden = true;
    state.activeId = null;
    state.activeParkId = null;
    setActiveMarker(null);
    setActiveParkMarker(null);
    document.querySelectorAll('.card.active').forEach((c) => c.classList.remove('active'));
    if (currentView === 'map') {
      history.replaceState(null, '', '#map');
    } else if (currentView === 'parks') {
      history.replaceState(null, '', '#parks');
    } else {
      history.replaceState(null, '', location.pathname + location.search);
    }
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
    const currentTheme = store.get('theme', 'heaven');

    openModal(`<h2>Setări Aplicație</h2>
      <form id="set-form">
        <h3 style="font-size:1rem;margin:12px 0 6px">✨ Temă Vizuală</h3>
        <p class="sub" style="margin-bottom:8px">Alege stilul vizual al aplicației.</p>
        <div class="field">
          <label for="set-theme">Stil & Ambianță</label>
          <select id="set-theme">
            <option value="heaven" ${currentTheme === 'heaven' ? 'selected' : ''}>🕊️ Temă Cerească ✝ (Albastru divin, aur radiant, îngeri & cruci)</option>
            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>🌑 Temă Clasic Dark (Bordeaux & Cărbune)</option>
          </select>
        </div>

        <h3 style="font-size:1rem;margin:18px 0 6px">🗺️ Stil Hartă</h3>
        <p class="sub" style="margin-bottom:8px">Harta standard funcționează gratuit fără cheie API.</p>
        <div class="field">
          <label for="set-map-provider">Stil Hartă</label>
          <select id="set-map-provider">
            <option value="osm" ${currentProvider === 'osm' ? 'selected' : ''}>Harta Standard (Fără cheie API ✓)</option>
            <option value="opentopo" ${currentProvider === 'opentopo' ? 'selected' : ''}>Topografic (Relief)</option>
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
        
        <div class="about-card" style="box-shadow: 0 0 16px -4px rgba(251, 191, 36, 0.25);">
          <div class="about-card-badge">🕊️ Dezvoltator Aplicație</div>
          <div class="about-card-title">Popa Bogdan (theratzul)</div>
          <div class="about-card-sub">devops / linux admin / christian ✝</div>
        </div>

        <button class="btn primary" type="submit" id="set-save" style="width:100%;margin-top:14px">Salvează Setările ✝</button>
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
      const chosenTheme = $('#set-theme').value;

      applyTheme(chosenTheme);

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

  /* ---------------- Christian Heaven & Dark Theme ---------------- */
  const applyTheme = (themeName) => {
    const isHeaven = themeName === 'heaven';
    document.documentElement.setAttribute('data-theme', isHeaven ? 'heaven' : 'dark');
    document.body.classList.toggle('theme-heaven', isHeaven);
    store.set('theme', themeName);
  };

  const toggleTheme = () => {
    const cur = store.get('theme', 'heaven');
    const next = cur === 'heaven' ? 'dark' : 'heaven';
    applyTheme(next);
    toast(next === 'heaven' ? '✦ Stil Celest Mistic activat ☩' : '🌑 Stil Clasic Dark activat');
  };

  /* ---------------- Mysterious & Elegant Sacred Application Menu ---------------- */
  function openAppMenu() {
    const isHeaven = store.get('theme', 'heaven') === 'heaven';
    openModal(`
      <div class="sacred-menu-modal">
        <div class="sacred-emblem-wrap">
          <div class="sacred-aureole"></div>
          <!-- Seraphim & Crux Mystica Sacred Linework -->
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none" class="sacred-emblem">
            <!-- Central Mystical Halo & Rays -->
            <circle cx="32" cy="32" r="28" stroke="var(--accent)" stroke-width="0.8" stroke-dasharray="2 3" opacity="0.45"/>
            <circle cx="32" cy="32" r="19" stroke="var(--accent)" stroke-width="0.9" opacity="0.7"/>
            <circle cx="32" cy="32" r="7" fill="rgba(229,192,123,0.12)" stroke="var(--accent)" stroke-width="1.2"/>
            
            <!-- Seraphim Wings (6 delicate stylized angelic wings) -->
            <!-- Upper Wings -->
            <path d="M32 18 C25 8, 12 10, 8 18 C15 22, 24 22, 32 25" stroke="var(--accent)" stroke-width="1.3" opacity="0.9"/>
            <path d="M32 18 C39 8, 52 10, 56 18 C49 22, 40 22, 32 25" stroke="var(--accent)" stroke-width="1.3" opacity="0.9"/>
            <!-- Middle Wings -->
            <path d="M26 32 C12 30, 4 38, 6 46 C15 45, 23 40, 27 34" stroke="var(--accent)" stroke-width="1.2" opacity="0.8"/>
            <path d="M38 32 C52 30, 60 38, 58 46 C49 45, 41 40, 37 34" stroke="var(--accent)" stroke-width="1.2" opacity="0.8"/>
            <!-- Lower Wings -->
            <path d="M30 38 C22 46, 18 56, 26 58 C30 52, 31 46, 32 40" stroke="var(--accent)" stroke-width="1.1" opacity="0.75"/>
            <path d="M34 38 C42 46, 46 56, 38 58 C34 52, 33 46, 32 40" stroke="var(--accent)" stroke-width="1.1" opacity="0.75"/>

            <!-- Mystical Latin Cross at Core -->
            <line x1="32" y1="11" x2="32" y2="53" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="22" y1="23" x2="42" y2="23" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
            <!-- Finials -->
            <circle cx="32" cy="11" r="1.6" fill="var(--accent)"/>
            <circle cx="32" cy="53" r="1.6" fill="var(--accent)"/>
            <circle cx="22" cy="23" r="1.6" fill="var(--accent)"/>
            <circle cx="42" cy="23" r="1.6" fill="var(--accent)"/>
          </svg>
        </div>

        <h2 style="margin: 0 0 2px; font-size: 1.3rem; letter-spacing: 0.5px;">Menu</h2>
        <p class="sub" style="margin: 0 0 16px; font-size: 0.78rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); opacity: 0.9;">
          Roșiori Map · ☩ Lux in Tenebris
        </p>

        <div class="sacred-menu-list">
          <div class="sacred-menu-item" id="menu-item-home" role="button" tabindex="0">
            <div class="sacred-menu-item-icon">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </div>
            <div class="sacred-menu-item-text">
              <div class="sacred-menu-item-title">Meniu Principal (Portal)</div>
              <div class="sacred-menu-item-sub">Înapoi la ecranul principal cu toate categoriile</div>
            </div>
          </div>

          <div class="sacred-menu-item" id="menu-item-parks" role="button" tabindex="0">
            <div class="sacred-menu-item-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C9.24 2 7 4.24 7 7c0 .64.12 1.25.35 1.82C5.4 9.55 4 11.61 4 14c0 3.31 2.69 6 6 6h1v2h2v-2h1c3.31 0 6-2.69 6-6 0-2.39-1.4-4.45-3.35-5.18.23-.57.35-1.18.35-1.82 0-2.76-2.24-5-5-5z"/>
              </svg>
            </div>
            <div class="sacred-menu-item-text">
              <div class="sacred-menu-item-title">Parcuri & Zone Verzi</div>
              <div class="sacred-menu-item-sub">Parcul Central, Pădurea Roșiori, agrement și bâlci</div>
            </div>
          </div>

          <div class="sacred-menu-item" id="menu-item-reservations" role="button" tabindex="0">
            <div class="sacred-menu-item-icon">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10ZM7 12h5v5H7z"/></svg>
            </div>
            <div class="sacred-menu-item-text">
              <div class="sacred-menu-item-title">Rezervările Mele</div>
              <div class="sacred-menu-item-sub">Vizualizează mesele rezervate și starea lor</div>
            </div>
          </div>

          <div class="sacred-menu-item" id="menu-item-theme" role="button" tabindex="0">
            <div class="sacred-menu-item-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="9" stroke-dasharray="2 2"/>
                <line x1="12" y1="6" x2="12" y2="18" stroke="var(--accent)" stroke-width="1.8"/>
                <line x1="8" y1="10" x2="16" y2="10" stroke="var(--accent)" stroke-width="1.8"/>
              </svg>
            </div>
            <div class="sacred-menu-item-text">
              <div class="sacred-menu-item-title">Stil Vizual: ${isHeaven ? 'Cerească (Seraphic Gold) ✦' : 'Clasic Dark 🌑'}</div>
              <div class="sacred-menu-item-sub">Comută între tema cerească mistică și clasic</div>
            </div>
          </div>

          <div class="sacred-menu-item" id="menu-item-settings" role="button" tabindex="0">
            <div class="sacred-menu-item-icon">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.3 7.3 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.3 7.3 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.3 7.3 0 0 0 1.7 1L11 21h4l.4-2.9a7.3 7.3 0 0 0 1.7-1l2.5 1 2-3.5ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)"/></svg>
            </div>
            <div class="sacred-menu-item-text">
              <div class="sacred-menu-item-title">Setări & Hartă</div>
              <div class="sacred-menu-item-sub">Stiluri de hartă și sincronizare server</div>
            </div>
          </div>

          <div class="sacred-menu-item" id="menu-item-about" role="button" tabindex="0">
            <div class="sacred-menu-item-icon">
              <span style="font-size:1.15rem;color:var(--accent)">☩</span>
            </div>
            <div class="sacred-menu-item-text">
              <div class="sacred-menu-item-title">Popa Bogdan (theratzul)</div>
              <div class="sacred-menu-item-sub">devops / linux admin / christian · Despre autor</div>
            </div>
          </div>
        </div>

        <button class="btn secondary" type="button" id="menu-close-btn" style="width: 100%; margin-top: 4px;">
          Închide Meniul
        </button>
      </div>
    `);

    $('#menu-close-btn')?.addEventListener('click', closeModal);
    $('#menu-item-home')?.addEventListener('click', () => { closeModal(); showView('menu'); });
    $('#menu-item-parks')?.addEventListener('click', () => { closeModal(); showView('parks'); });
    $('#menu-item-reservations')?.addEventListener('click', () => { closeModal(); openMyReservations(); });
    $('#menu-item-theme')?.addEventListener('click', () => { toggleTheme(); openAppMenu(); });
    $('#menu-item-settings')?.addEventListener('click', () => { closeModal(); openSettings(); });
    $('#menu-item-about')?.addEventListener('click', () => { closeModal(); openAbout(); });
  }

  /* ---------------- About / Informații ---------------- */
  function openAbout() {
    openModal(`
      <div style="text-align: center; padding: 6px 2px 2px;">
        <div style="font-size: 1.5rem; margin-bottom: 6px; color: var(--accent); opacity: 0.9;" title="Crux Mystica">
          ☩
        </div>
        <img src="icons/icon.svg?v=2" alt="Roșiori Map Logo" style="width: 58px; height: 58px; border-radius: 14px; margin-bottom: 10px; box-shadow: 0 4px 18px -2px rgba(29, 78, 216, 0.5), 0 0 12px rgba(59, 130, 246, 0.35);" />
        <h2 style="margin: 0 0 4px; font-size: 1.25rem;">Roșiori Map</h2>
        <p class="sub" style="margin: 0 0 16px; font-size: 0.8rem; letter-spacing: 1px; text-transform: uppercase; color: var(--accent);">Restaurante · Meniuri · Rezervări</p>

        <div class="about-card" style="box-shadow: 0 0 18px -4px rgba(229, 192, 123, 0.25);">
          <div class="about-card-badge">☩ Dezvoltator & Mentenanță</div>
          <div class="about-card-title">Popa Bogdan (theratzul)</div>
          <div class="about-card-sub">devops / linux admin / christian</div>
        </div>

        <p class="sub" style="margin: 14px 4px 16px; font-size: 0.82rem; line-height: 1.5;">
          Ghidul tău culinar interactiv pentru orașul Roșiorii de Vede. Descoperă restaurante, consultă meniurile complete și rezervă mese online în câteva secunde.
        </p>

        <button class="btn primary" type="button" id="about-close-btn" style="width: 100%;">Închide</button>
      </div>
    `);

    const closeBtn = $('#about-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
  }

  /* ---------------- Events ---------------- */
  $('#search').addEventListener('input', (e) => {
    if (state.mode === 'restaurants') {
      state.query = e.target.value;
    } else {
      state.parksQuery = e.target.value;
    }
    renderList();
  });

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter');
    if (!b) return;
    if (state.mode === 'restaurants') {
      state.filter = b.dataset.filter;
    } else {
      state.parksFilter = b.dataset.filter;
    }
    renderFilters();
    renderList();
  });

  $('#list').addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (!c) return;
    if (c.dataset.type === 'park' || state.mode === 'parks') {
      openPark(c.dataset.id);
    } else {
      openRestaurant(c.dataset.id);
    }
  });

  $('#list').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const c = e.target.closest('.card');
      if (!c) return;
      if (c.dataset.type === 'park' || state.mode === 'parks') {
        openPark(c.dataset.id);
      } else {
        openRestaurant(c.dataset.id);
      }
    }
  });

  $('#btn-mode-restaurants')?.addEventListener('click', () => setMode('restaurants'));
  $('#btn-mode-parks')?.addEventListener('click', () => setMode('parks'));
  $('#btn-top-parks')?.addEventListener('click', () => showView('parks'));

  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#btn-my-res').addEventListener('click', openMyReservations);
  $('#btn-menu')?.addEventListener('click', openAppMenu);
  $('#map-brand-badge')?.addEventListener('click', () => {
    map.flyTo(CFG.center, 15);
    toast('📍 Roșiorii de Vede · Hartă centrată ☩');
  });

  const sideFooter = $('#sidebar-footer');
  if (sideFooter) {
    sideFooter.addEventListener('click', openAppMenu);
    sideFooter.addEventListener('keydown', (e) => { if (e.key === 'Enter') openAppMenu(); });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.open) closeDrawer(); });

  $('#btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Geolocația nu este disponibilă', true);
    navigator.geolocation.getCurrentPosition((p) => {
      state.userPos = [p.coords.latitude, p.coords.longitude];
      if (state.userMarker) state.userMarker.setLatLng(state.userPos);
      else state.userMarker = L.marker(state.userPos, { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [18, 18] }) }).addTo(map);
      map.flyTo(state.userPos, 16);
      renderList();
      renderParksSubmenu();
      toast('Sortat după distanță 📍');
    }, () => toast('Nu am putut obține locația', true), { enableHighAccuracy: true, timeout: 10000 });
  });

  // Mobile bottom sheet: tap/drag the handle to cycle sizes.
  const sheet = $('#sidebar');
  const handle = $('#sheet-handle');
  const setSheet = (mode) => {
    sheet.classList.toggle('expanded', mode === 'expanded');
    sheet.classList.toggle('collapsed', mode === 'collapsed');
    document.body.classList.toggle('sheet-expanded', mode === 'expanded');
    document.body.classList.toggle('sheet-collapsed', mode === 'collapsed');
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

  /* ---------------- Parks Submenu Rendering & Events ---------------- */
  function renderParksSubmenu() {
    const filtersWrap = $('#parks-filters');
    if (filtersWrap) {
      filtersWrap.innerHTML = Object.entries(PARK_TYPES)
        .map(([k, v]) => `<button class="park-filter-btn${state.submenuFilter === k ? ' active' : ''}" data-cat="${k}" type="button">${k === 'all' ? '✨ ' : PARK_EMOJI[k] + ' '}${v}</button>`)
        .join('');
    }

    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = norm(state.submenuQuery);
    let list = state.parks;
    if (state.submenuFilter !== 'all') {
      list = list.filter((p) => p.category === state.submenuFilter);
    }
    if (q) {
      list = list.filter((p) =>
        norm(p.name).includes(q) ||
        norm(p.categoryLabel).includes(q) ||
        norm(p.description).includes(q) ||
        norm(p.history).includes(q) ||
        norm(p.address).includes(q) ||
        (p.highlights || []).some((h) => norm(h).includes(q)) ||
        (p.features || []).some((f) => norm(f).includes(q))
      );
    }
    if (state.userPos) {
      list = [...list].sort((a, b) => distanceKm(state.userPos, [a.lat, a.lng]) - distanceKm(state.userPos, [b.lat, b.lng]));
    }

    const grid = $('#parks-grid');
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = `<div class="empty-card glass" style="grid-column: 1 / -1; padding: 30px;">
        <p class="empty-desc">Nicio zonă verde găsită pentru căutarea selectată. 🔍</p>
      </div>`;
      return;
    }

    grid.innerHTML = list.map((p, i) => {
      const dist = state.userPos ? `<span>📍 ${distanceKm(state.userPos, [p.lat, p.lng]).toFixed(1)} km</span>` : '';
      return `
        <article class="park-card" data-id="${p.id}" id="park-card-${p.id}" style="animation: rise 0.28s ease ${Math.min(i * 35, 250)}ms both">
          <div class="park-card-header">
            <div class="park-card-icon">${p.emoji || PARK_EMOJI[p.category] || '🌳'}</div>
            <div class="park-card-title-wrap">
              <div class="park-card-badge-row">
                <span class="park-badge">${esc(p.badge || p.categoryLabel)}</span>
                <span class="park-category-tag">${esc(p.categoryLabel)}</span>
              </div>
              <h3 class="park-card-title">${esc(p.name)}</h3>
            </div>
          </div>
          <p class="park-card-desc">${esc(p.description)}</p>

          <div class="park-meta-info">
            <div class="park-meta-item">📍 <span>${esc(p.address)}</span> ${dist ? `<strong>(${dist})</strong>` : ''}</div>
            <div class="park-meta-item">⏰ <strong>Program:</strong> <span>${esc(p.schedule)}</span></div>
            <div class="park-meta-item">🎟️ <strong>Acces:</strong> <span>${esc(p.admission)}</span></div>
          </div>

          <div class="park-highlights-box">
            <div class="park-highlights-title">Atracții & Repere</div>
            <div class="park-highlights-tags">
              ${(p.highlights || []).slice(0, 3).map((h) => `<span class="park-highlight-chip">✦ ${esc(h)}</span>`).join('')}
            </div>
          </div>

          <div class="park-history-collapsible" id="collapsible-${p.id}">
            <button class="park-history-btn" type="button" aria-expanded="false" data-target="collapsible-${p.id}">
              <span>📖 Istoric & Semnificație Tradițională</span>
              <span class="park-history-arrow">▼</span>
            </button>
            <div class="park-history-content">
              ${esc(p.history)}
            </div>
          </div>

          <div class="park-card-actions">
            <button class="btn primary btn-park-map" data-id="${p.id}" type="button">🗺️ Vezi pe Hartă</button>
            <button class="btn btn-park-gps" data-lat="${p.lat}" data-lng="${p.lng}" data-name="${esc(p.name)}" type="button">🧭 Traseu</button>
            <button class="btn btn-park-share-card" data-id="${p.id}" data-name="${esc(p.name)}" type="button">🔗 Distribuie</button>
          </div>
        </article>
      `;
    }).join('');
  }

  $('#parks-search')?.addEventListener('input', (e) => {
    state.submenuQuery = e.target.value;
    renderParksSubmenu();
  });

  $('#parks-filters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.park-filter-btn');
    if (!btn) return;
    state.submenuFilter = btn.dataset.cat;
    renderParksSubmenu();
  });

  $('#parks-grid')?.addEventListener('click', (e) => {
    const histBtn = e.target.closest('.park-history-btn');
    if (histBtn) {
      const container = document.getElementById(histBtn.dataset.target);
      if (container) {
        const isOpen = container.classList.toggle('open');
        histBtn.setAttribute('aria-expanded', isOpen);
      }
      return;
    }
    const mapBtn = e.target.closest('.btn-park-map');
    if (mapBtn) {
      showView('map', mapBtn.dataset.id, 'parks');
      return;
    }
    const gpsBtn = e.target.closest('.btn-park-gps');
    if (gpsBtn) {
      bridge.navigate(parseFloat(gpsBtn.dataset.lat), parseFloat(gpsBtn.dataset.lng), gpsBtn.dataset.name);
      return;
    }
    const shareBtn = e.target.closest('.btn-park-share-card');
    if (shareBtn) {
      const p = state.parks.find((x) => x.id === shareBtn.dataset.id);
      if (p) {
        bridge.share(
          `${p.name} – Roșiori Map`,
          `Explorează ${p.name} din Roșiorii de Vede pe Roșiori Map! Istoric, facilități și traseu GPS.`,
          location.origin + location.pathname + '#park-' + p.id
        );
      }
      return;
    }
  });

  $('#btn-parks-back')?.addEventListener('click', () => showView('menu'));
  $('#btn-parks-open-map')?.addEventListener('click', () => showView('map', null, 'parks'));

  /* ---------------- City Portal & View Management ---------------- */
  const BLANK_SECTIONS = {
    history: {
      title: 'Istorie & Patrimoniu',
      navTitle: 'Istorie & Patrimoniu',
      desc: 'Cronica istorică a orașului Roșiorii de Vede, prima atestare documentară din 1385, vestigii arheologice și personalități locale.',
      bgClass: 'bg-amber',
      iconSvg: `<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor">
        <path d="M12 3L2 8v2h20V8L12 3zm-7 7v9h2v-9H5zm4 0v9h2v-9H9zm4 0v9h2v-9h-2zm4 0v9h2v-9h-2zm-13 11v2h18v-2H4z"/>
      </svg>`,
      items: [
        'Prima atestare documentară a târgului Ruși (1385)',
        'Centrul vechi comercial și monumente de patrimoniu',
        'Personalități teleormănene, scriitori și ctitori',
        'Povești, legende locale și cronici memoriale'
      ]
    },
    culture: {
      title: 'Clădiri Culturale & Muzee',
      navTitle: 'Clădiri Culturale',
      desc: 'Instituțiile de cultură, teatrul municipal, cinematograful, biblioteca și așezămintele artistice din Roșiorii de Vede.',
      bgClass: 'bg-purple',
      iconSvg: `<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor">
        <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-1.5V6a3 3 0 0 0-3-3h-6a3 3 0 0 0-3 3v4.5H4.5a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15zM8 6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v4.5H8V6zm-3.5 6.5h15a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-4.5a1 1 0 0 1 1-1z"/>
      </svg>`,
      items: [
        'Casa Municipală de Cultură',
        'Muzeul de Istorie „Petre Voivozeanu”',
        'Biblioteca Municipală „Gala Galaction”',
        'Săli de expoziție, cinematograf și evenimente'
      ]
    },
    schools: {
      title: 'Școli & Educație',
      navTitle: 'Școli & Educație',
      desc: 'Unitățile de învățământ preuniversitar, colegii de prestigiu, licee tehnologice și școli gimnaziale din Roșiorii de Vede.',
      bgClass: 'bg-cyan',
      iconSvg: `<svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor">
        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
      </svg>`,
      items: [
        'Colegiul Național „Anastasescu”',
        'Liceul Tehnologic „Anghel Saligny” & Liceul Tehnologic „Virgil Madgearu”',
        'Școlile Gimnaziale „Mihai Eminescu”, „Dan Berindei” și „Zaharia Stancu”',
        'Grădinițe municipale & centre de sprijin educațional'
      ]
    }
  };

  let currentView = 'menu';
  const viewMainMenu = $('#view-main-menu');
  const viewMapApp = $('#view-map-app');
  const viewParksSubmenu = $('#view-parks-submenu');
  const viewEmptySection = $('#view-empty-section');

  function showView(view, param = null, mode = null) {
    currentView = view;
    if (view === 'menu') {
      if (viewMainMenu) viewMainMenu.hidden = false;
      if (viewMapApp) viewMapApp.hidden = true;
      if (viewParksSubmenu) viewParksSubmenu.hidden = true;
      if (viewEmptySection) viewEmptySection.hidden = true;
      if (viewMainMenu) viewMainMenu.scrollTop = 0;
      history.replaceState(null, '', '#menu');
    } else if (view === 'parks') {
      if (viewMainMenu) viewMainMenu.hidden = true;
      if (viewMapApp) viewMapApp.hidden = true;
      if (viewEmptySection) viewEmptySection.hidden = true;
      if (viewParksSubmenu) {
        viewParksSubmenu.hidden = false;
        viewParksSubmenu.scrollTop = 0;
      }
      renderParksSubmenu();
      history.replaceState(null, '', '#parks');
    } else if (view === 'map') {
      if (viewMainMenu) viewMainMenu.hidden = true;
      if (viewParksSubmenu) viewParksSubmenu.hidden = true;
      if (viewEmptySection) viewEmptySection.hidden = true;
      if (viewMapApp) viewMapApp.hidden = false;
      setTimeout(() => {
        map.invalidateSize();
      }, 80);

      const targetMode = mode || (param?.startsWith('park-') || state.parks.some((p) => p.id === param) ? 'parks' : 'restaurants');
      setMode(targetMode);

      if (param) {
        const parkId = param.replace(/^park-/, '');
        if (state.parks.some((p) => p.id === parkId)) {
          setMode('parks');
          openPark(parkId);
        } else if (state.restaurants.some((r) => r.id === param)) {
          setMode('restaurants');
          openRestaurant(param);
        }
      } else {
        history.replaceState(null, '', '#map');
      }
    } else if (view === 'section') {
      const data = BLANK_SECTIONS[param] || BLANK_SECTIONS.history;
      if (viewMainMenu) viewMainMenu.hidden = true;
      if (viewMapApp) viewMapApp.hidden = true;
      if (viewParksSubmenu) viewParksSubmenu.hidden = true;
      if (viewEmptySection) {
        viewEmptySection.hidden = false;
        viewEmptySection.scrollTop = 0;
      }

      const navTitle = $('#empty-section-nav-title');
      const title = $('#empty-section-title');
      const desc = $('#empty-section-desc');
      const iconWrap = $('#empty-section-icon');
      const listEl = $('#empty-section-list');

      if (navTitle) navTitle.textContent = data.navTitle;
      if (title) title.textContent = data.title;
      if (desc) desc.textContent = data.desc;
      if (iconWrap) {
        iconWrap.className = `empty-icon-halo ${data.bgClass}`;
        iconWrap.innerHTML = data.iconSvg;
      }
      if (listEl) {
        listEl.innerHTML = data.items.map((it) => `<li>${it}</li>`).join('');
      }
      history.replaceState(null, '', `#${param}`);
    }
  }
  window.showView = showView;

  // Main menu card actions
  $('#card-action-restaurants')?.addEventListener('click', () => showView('map', null, 'restaurants'));
  $('#card-action-parks')?.addEventListener('click', () => showView('parks'));
  $('#card-action-history')?.addEventListener('click', () => showView('section', 'history'));
  $('#card-action-culture')?.addEventListener('click', () => showView('section', 'culture'));
  $('#card-action-schools')?.addEventListener('click', () => showView('section', 'schools'));

  ['restaurants', 'parks', 'history', 'culture', 'schools'].forEach((id) => {
    $(`#card-action-${id}`)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (id === 'restaurants') showView('map', null, 'restaurants');
        else if (id === 'parks') showView('parks');
        else showView('section', id);
      }
    });
  });

  // Header and back buttons
  $('#btn-back-to-menu')?.addEventListener('click', () => showView('menu'));
  $('#brand-home-btn')?.addEventListener('click', () => showView('menu'));
  $('#brand-home-btn')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showView('menu'); }
  });

  $('#btn-empty-back')?.addEventListener('click', () => showView('menu'));
  $('#btn-empty-return')?.addEventListener('click', () => showView('menu'));
  $('#btn-empty-go-map')?.addEventListener('click', () => showView('map'));

  $('#menu-btn-theme')?.addEventListener('click', toggleTheme);
  $('#menu-btn-about')?.addEventListener('click', openAbout);

  /* ---------------- Android & Back Navigation ---------------- */
  window.handleBackPressed = () => {
    if (modal.open) { closeModal(); return true; }
    if ($('#drawer').classList.contains('open')) { closeDrawer(); return true; }
    if (sheet.classList.contains('expanded')) { setSheet('mid'); return true; }
    if (currentView !== 'menu') {
      showView('menu');
      return true;
    }
    return false;
  };

  window.addEventListener('popstate', () => {
    if (modal.open) closeModal();
    else if ($('#drawer').classList.contains('open')) closeDrawer();
  });

  /* ---------------- Boot ---------------- */
  applyTheme(store.get('theme', 'heaven'));

  (async () => {
    try {
      const [restaurants, parks] = await Promise.all([
        api.restaurants(),
        api.parks()
      ]);
      state.restaurants = restaurants;
      state.parks = parks;
      renderFilters();
      renderList();
      renderParksSubmenu();

      const hash = location.hash.slice(1);
      if (hash === 'map') {
        showView('map');
      } else if (hash === 'parks') {
        showView('parks');
      } else if (hash.startsWith('park-')) {
        showView('map', hash.replace(/^park-/, ''), 'parks');
      } else if (['history', 'culture', 'schools'].includes(hash)) {
        showView('section', hash);
      } else if (hash && state.restaurants.some((r) => r.id === hash)) {
        showView('map', hash, 'restaurants');
      } else if (hash && state.parks.some((p) => p.id === hash)) {
        showView('map', hash, 'parks');
      } else {
        showView('menu');
      }
    } catch (e) {
      console.error(e);
      toast('Nu am putut încărca datele', true);
      showView('menu');
    }
  })();

  if ('serviceWorker' in navigator && location.protocol === 'https:' && location.hostname !== 'appassets.androidplatform.net') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
