// DRÖMGÅRDEN — allt DOM/UI: startmeny, HUD, verktygsrad, butik, säljpanel, toasts.
import { CROPS, CROP_KEYS } from './world.js?v=11';
import { MAPS } from './prefabs.js?v=11';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.cb = {};
    this.tools = [];
    this.onTool = null;
    this.onSeed = null;
    this.selectedSeed = CROP_KEYS[0];
  }

  init(cb) {
    this.cb = cb;
    // Startmeny
    $('btnSolo').onclick = () => this.cb.onStart('solo');
    $('btnHost').onclick = () => this.cb.onStart('host');
    $('btnJoin').onclick = () => this.cb.onStart('join');
    // Modal-stängningar
    $('shopClose').onclick = () => this.closeShop();
    $('sellClose').onclick = () => this.closeSell();
    $('sellAll').onclick = () => { this.cb.onSellAll?.(); };
    // Butik/sälj-knappar i HUD
    $('btnShop').onclick = () => this.cb.onOpenShop?.();
    $('btnSell').onclick = () => this.cb.onOpenSell?.();
  }

  // Kartval + kartbyggare
  initMaps(cb) {
    this.mapsCb = cb;
    $('btnEditor').onclick = () => cb.onEditor?.();
    this.refreshMapList();
  }
  refreshMapList() {
    const sel = $('mapSelect'); if (!sel || !this.mapsCb) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">🏡 Standardgården</option>';
    for (const [key, m] of Object.entries(MAPS)) {
      const o = document.createElement('option'); o.value = '#' + key; o.textContent = '🌸 ' + m.name; sel.appendChild(o);
    }
    for (const n of this.mapsCb.listMaps?.() || []) {
      const o = document.createElement('option'); o.value = n; o.textContent = '🗺️ ' + n; sel.appendChild(o);
    }
    sel.value = cur;
  }
  selectedMap() { return $('mapSelect') ? $('mapSelect').value : ''; }

  name() { return ($('nameInput').value || '').trim().slice(0, 12) || 'Bonde'; }
  joinCode() { return ($('joinCode').value || '').trim().toUpperCase(); }
  menuMsg(t) { $('menuMsg').textContent = t || ''; }

  showMenu() { $('menu').classList.remove('hidden'); }
  hideMenu() { $('menu').classList.add('hidden'); }
  showGame() { this.hideMenu(); $('game').classList.remove('hidden'); }

  setRoomCode(code, mode) {
    const el = $('roomCode');
    if (mode === 'solo') { el.textContent = 'Ensam'; el.classList.remove('link'); }
    else if (code) { el.textContent = 'Kod: ' + code; el.classList.toggle('link', mode === 'host'); }
    else el.textContent = '';
  }

  // Verktygsrad
  buildToolbar(tools, onTool) {
    this.tools = tools; this.onTool = onTool;
    const bar = $('toolbar'); bar.innerHTML = '';
    tools.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.i = i;
      b.innerHTML = `<span class="e">${t.emoji}</span><span class="l">${t.label}</span>`;
      b.onclick = () => onTool(i);
      bar.appendChild(b);
    });
  }
  setActiveTool(i) {
    [...$('toolbar').children].forEach((b, j) => b.classList.toggle('active', j === i));
    // fröväljare synlig bara för så-verktyget
    const seedTool = this.tools[i] && this.tools[i].key === 'seed';
    $('seedPicker').classList.toggle('hidden', !seedTool);
  }

  buildSeedPicker(onSeed) {
    this.onSeed = onSeed;
    const el = $('seedPicker'); el.innerHTML = '';
    CROP_KEYS.forEach((k) => {
      const c = CROPS[k];
      const b = document.createElement('button');
      b.className = 'seed';
      b.dataset.k = k;
      b.innerHTML = `<span class="e">${c.emoji}</span>`;
      b.title = c.name;
      b.onclick = () => { this.selectedSeed = k; this.refreshSeedPicker(); onSeed(k); };
      el.appendChild(b);
    });
    this.refreshSeedPicker();
  }
  refreshSeedPicker(inv) {
    [...$('seedPicker').children].forEach((b) => {
      const k = b.dataset.k;
      b.classList.toggle('active', k === this.selectedSeed);
      if (inv) {
        let cnt = b.querySelector('.cnt');
        if (!cnt) { cnt = document.createElement('span'); cnt.className = 'cnt'; b.appendChild(cnt); }
        cnt.textContent = inv.seeds[k] || 0;
        b.classList.toggle('empty', !(inv.seeds[k] > 0));
      }
    });
  }

  // Top-HUD
  hud(s) {
    $('coins').textContent = '🪙 ' + s.coins;
    const hh = String(Math.floor(s.time)).padStart(2, '0');
    const mm = String(Math.floor((s.time % 1) * 60)).padStart(2, '0');
    $('clock').textContent = `Dag ${s.day} · ${hh}:${mm}`;
    $('players').textContent = '👥 ' + s.players;
  }

  actionLabel(txt) { $('actionBtn').querySelector('.txt').textContent = txt; }

  // Butik (köpa frön)
  openShop(state, onBuy) {
    const list = $('shopList'); list.innerHTML = '';
    CROP_KEYS.forEach((k) => {
      const c = CROPS[k];
      const row = document.createElement('div');
      row.className = 'shopRow';
      row.innerHTML = `
        <span class="ico">${c.emoji}</span>
        <span class="nm">${c.name}</span>
        <span class="pr">🪙 ${c.seed}</span>
        <span class="have">har: ${state.seeds[k] || 0}</span>`;
      const buy = document.createElement('button');
      buy.textContent = 'Köp frö';
      buy.className = 'buy';
      buy.disabled = state.coins < c.seed;
      buy.onclick = () => onBuy(k);
      row.appendChild(buy);
      list.appendChild(row);
    });
    $('shopCoins').textContent = '🪙 ' + state.coins;
    $('shopModal').classList.remove('hidden');
  }
  refreshShop(state, onBuy) {
    if ($('shopModal').classList.contains('hidden')) return;
    this.openShop(state, onBuy);
  }
  closeShop() { $('shopModal').classList.add('hidden'); }

  // Sälj (skeppa skörd)
  openSell(state) {
    const list = $('sellList'); list.innerHTML = '';
    let total = 0, any = false;
    CROP_KEYS.forEach((k) => {
      const n = state.produce[k] || 0;
      if (n <= 0) return;
      any = true;
      const c = CROPS[k];
      total += n * c.sell;
      const row = document.createElement('div');
      row.className = 'shopRow';
      row.innerHTML = `
        <span class="ico">${c.emoji}</span>
        <span class="nm">${c.name} ×${n}</span>
        <span class="pr">🪙 ${c.sell}/st</span>
        <span class="have">= ${n * c.sell}</span>`;
      list.appendChild(row);
    });
    if (!any) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Inget att sälja än — skörda något först!'; list.appendChild(p); }
    $('sellTotal').textContent = '🪙 ' + total;
    $('sellAll').disabled = !any;
    $('sellModal').classList.remove('hidden');
  }
  refreshSell(state) { if (!$('sellModal').classList.contains('hidden')) this.openSell(state); }
  closeSell() { $('sellModal').classList.add('hidden'); }

  toast(text, ms = 2200) {
    const t = $('toast');
    const line = document.createElement('div');
    line.className = 'toastLine';
    line.textContent = text;
    t.appendChild(line);
    requestAnimationFrame(() => line.classList.add('show'));
    setTimeout(() => { line.classList.remove('show'); setTimeout(() => line.remove(), 350); }, ms);
  }
}
