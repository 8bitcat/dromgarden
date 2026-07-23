// DRÖMGÅRDEN — kartbyggaren. Måla mark/objekt/djur, väggar, åker, startpunkt.
// Bygger paletten från ALLA sprite-ark. Sparar kartor i localStorage.
import { World, TILE, MAP_W, MAP_H } from './world.js?v=8';
import { buildPalette } from './brushes.js?v=8';

const STORE = 'dromgarden-maps';
const TOOLS = [
  { k: 'paint', e: '🖌️', n: 'Måla' },
  { k: 'wall',  e: '🧱', n: 'Vägg' },
  { k: 'farm',  e: '🌱', n: 'Åker' },
  { k: 'spawn', e: '🚩', n: 'Start' },
  { k: 'erase', e: '🧽', n: 'Radera' },
  { k: 'pan',   e: '✋', n: 'Flytta' },
];

export class Editor {
  constructor(game) {
    this.game = game;
    this.world = new World();
    this.world.setAssets(game.assets);
    this.built = false;
    this.tool = 'paint';
    this.brush = null;
    this.cam = { x: 0, y: 0 };
    this.scale = 2;
    this.running = false;
    this.pointer = { down: false, panning: false, lastX: 0, lastY: 0 };
    this.hover = null;
  }

  // ---- localStorage ----------------------------------------------------
  _all() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
  listSaved() { return Object.keys(this._all()); }
  loadSaved(name) { return this._all()[name] || null; }
  saveMap(name) { const a = this._all(); a[name] = this.world.serialize(); localStorage.setItem(STORE, JSON.stringify(a)); }
  deleteMap(name) { const a = this._all(); delete a[name]; localStorage.setItem(STORE, JSON.stringify(a)); }

  // ---- Öppna / stäng ---------------------------------------------------
  open(name) {
    if (!this.built) this.build();
    if (name && this.loadSaved(name)) { this.world.load(this.loadSaved(name)); this.currentName = name; }
    else {
      this.world.w = MAP_W; this.world.h = MAP_H; this.world._alloc();
      for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) this.world.setFarm(x, y, 1);
      this.world.spawn = { x: (MAP_W / 2) | 0, y: (MAP_H / 2) | 0 };
      this.currentName = null;
    }
    document.getElementById('menu').classList.add('hidden');
    this.el.classList.remove('hidden');
    this.resize();
    this.cam.x = Math.max(0, this.world.spawn.x * TILE * this.scale - this.cv.clientWidth / 2);
    this.cam.y = Math.max(0, this.world.spawn.y * TILE * this.scale - this.cv.clientHeight / 2);
    this.running = true;
    requestAnimationFrame(() => this.loop());
  }
  close() { this.running = false; this.el.classList.add('hidden'); document.getElementById('menu').classList.remove('hidden'); }
  play() { this.game.pendingMap = this.world.serialize(); this.close(); this.game.start('solo'); }

  // ---- Bygg DOM --------------------------------------------------------
  build() {
    const el = document.getElementById('editor');
    this.el = el;
    el.innerHTML = `
      <div class="edTop">
        <span class="edTitle">🎨 Kartbyggare</span>
        <div class="edTools"></div>
        <canvas class="edBrush" width="34" height="34" title="Vald pensel"></canvas>
        <div class="edActions">
          <button data-a="zoomout">➖</button>
          <button data-a="zoomin">➕</button>
          <button data-a="save">💾 Spara</button>
          <button data-a="load">📂 Ladda</button>
          <button data-a="play" class="prim">▶️ Spela</button>
          <button data-a="close">✕</button>
        </div>
      </div>
      <div class="edMain"><canvas id="edCanvas"></canvas>
        <div class="edHelp">Välj en ruta i paletten och måla på kartan. 🧱 gör väggar (går ej igenom), 🌱 markerar åker (går att odla), 🚩 sätter start. Zooma med ➕/➖.</div>
      </div>
      <div class="edPalette"><div class="edCats"></div><div class="edGrid"></div></div>
      <div class="edModal hidden"><div class="edSheet"><header><b>Mina kartor</b><button data-a="mclose">✕</button></header><div class="edList"></div></div></div>`;
    this.cv = el.querySelector('#edCanvas');
    this.ctx = this.cv.getContext('2d');
    this.brushCv = el.querySelector('.edBrush');

    // verktyg
    const tools = el.querySelector('.edTools');
    TOOLS.forEach((t) => {
      const b = document.createElement('button'); b.className = 'edTool'; b.dataset.t = t.k;
      b.innerHTML = `<span>${t.e}</span><small>${t.n}</small>`;
      b.onclick = () => this.setTool(t.k);
      tools.appendChild(b);
    });
    this.setTool('paint');

    // actions
    el.querySelector('.edActions').onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'zoomin') this.zoom(1);
      else if (a === 'zoomout') this.zoom(-1);
      else if (a === 'save') this.doSave();
      else if (a === 'load') this.showModal();
      else if (a === 'play') this.play();
      else if (a === 'close') this.close();
    };
    el.querySelector('[data-a="mclose"]').onclick = () => el.querySelector('.edModal').classList.add('hidden');

    // palett
    this.cats = buildPalette(this.game.assets);
    this.cats.unshift({ cat: '🐮 Djur', brushes: [
      { kind: 'animal', type: 'chicken', img: 'chicken' },
      { kind: 'animal', type: 'cow', img: 'cow' },
    ] });
    const catsEl = el.querySelector('.edCats');
    this.cats.forEach((c, i) => {
      const b = document.createElement('button'); b.className = 'edCat'; b.textContent = c.cat;
      b.onclick = () => this.showCat(i, b);
      catsEl.appendChild(b);
    });
    this.showCat(0, catsEl.firstChild);

    // pekhändelser
    this._bindPointer();
    window.addEventListener('resize', () => { if (this.running) this.resize(); });
    this.built = true;
  }

  setTool(k) {
    this.tool = k;
    this.el.querySelectorAll('.edTool').forEach((b) => b.classList.toggle('active', b.dataset.t === k));
  }
  zoom(d) {
    const cx = this.cam.x + this.cv.clientWidth / 2, cy = this.cam.y + this.cv.clientHeight / 2;
    const old = this.scale; this.scale = Math.max(1, Math.min(5, this.scale + d));
    const f = this.scale / old;
    this.cam.x = cx * f - this.cv.clientWidth / 2; this.cam.y = cy * f - this.cv.clientHeight / 2;
    this.clampCam();
  }

  showCat(i, btn) {
    this.el.querySelectorAll('.edCat').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const grid = this.el.querySelector('.edGrid'); grid.innerHTML = '';
    for (const br of this.cats[i].brushes) {
      const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'edCell';
      this.drawBrush(c.getContext('2d'), br, 0, 0, 32);
      c.onclick = () => { this.brush = br; this.setTool('paint'); grid.querySelectorAll('.edCell').forEach((x) => x.classList.remove('sel')); c.classList.add('sel'); this.drawBrushPreview(); };
      grid.appendChild(c);
    }
  }

  drawBrush(ctx, br, dx, dy, box) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(dx, dy, box, box);
    const img = this.game.assets.img;
    if (br.kind === 'cell') { ctx.drawImage(img[br.img], br.sx, br.sy, 16, 16, dx, dy, box, box); }
    else if (br.kind === 'stamp') { const s = Math.min(box / (br.sw / 16), box / (br.sh / 16)); const w = (br.sw / 16) * s, h = (br.sh / 16) * s; ctx.drawImage(img[br.img], br.sx, br.sy, br.sw, br.sh, dx + (box - w) / 2, dy + (box - h) / 2, w, h); }
    else if (br.kind === 'animal') { ctx.drawImage(img[br.img], 0, 3 * 48, 48, 48, dx, dy, box, box); }
  }
  drawBrushPreview() { const c = this.brushCv.getContext('2d'); c.clearRect(0, 0, 34, 34); if (this.brush) this.drawBrush(c, this.brush, 1, 1, 32); }

  // ---- Pekhändelser ----------------------------------------------------
  _bindPointer() {
    const pt = (e) => { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const tile = (p) => ({ x: Math.floor((p.x + this.cam.x) / (TILE * this.scale)), y: Math.floor((p.y + this.cam.y) / (TILE * this.scale)) });
    this.cv.addEventListener('pointerdown', (e) => {
      this.cv.setPointerCapture(e.pointerId);
      const p = pt(e); this.pointer.down = true; this.pointer.lastX = p.x; this.pointer.lastY = p.y;
      if (this.tool === 'pan') { this.pointer.panning = true; return; }
      const t = tile(p); this.paintAt(t.x, t.y, true);
    });
    this.cv.addEventListener('pointermove', (e) => {
      const p = pt(e); this.hover = tile(p);
      if (!this.pointer.down) return;
      if (this.pointer.panning) { this.cam.x -= p.x - this.pointer.lastX; this.cam.y -= p.y - this.pointer.lastY; this.pointer.lastX = p.x; this.pointer.lastY = p.y; this.clampCam(); return; }
      const t = tile(p); this.paintAt(t.x, t.y, false);
    });
    const up = () => { this.pointer.down = false; this.pointer.panning = false; };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  }

  paintAt(x, y, isDown) {
    const w = this.world; if (!w.inBounds(x, y)) return;
    if (this.tool === 'erase') { w.clearCell(x, y); return; }
    if (this.tool === 'wall') { w.setSolid(x, y, 1); return; }
    if (this.tool === 'farm') { w.setFarm(x, y, 1); return; }
    if (this.tool === 'spawn') { w.spawn = { x, y }; return; }
    if (this.tool === 'paint') {
      const br = this.brush; if (!br) return;
      if (br.kind === 'cell') { w.setGround(x, y, [br.img, br.col, br.row]); }
      else if (isDown && br.kind === 'stamp') { w.addObject({ img: br.img, sx: br.sx, sy: br.sy, sw: br.sw, sh: br.sh, tx: x, ty: y, fw: br.fw, fh: br.fh }); }
      else if (isDown && br.kind === 'animal') { w.animalSpawns.push({ type: br.type, x: x + 0.5, y: y + 0.5 }); }
    }
  }

  doSave() {
    const name = (prompt('Namn på kartan:', this.currentName || 'Min gård') || '').trim();
    if (!name) return;
    this.saveMap(name); this.currentName = name;
    this.game.ui.toast('Sparade kartan "' + name + '" 💾');
    this.game.ui.refreshMapList?.();
  }
  showModal() {
    const list = this.el.querySelector('.edList'); list.innerHTML = '';
    const names = this.listSaved();
    if (!names.length) { list.innerHTML = '<p class="muted">Inga sparade kartor än.</p>'; }
    names.forEach((n) => {
      const row = document.createElement('div'); row.className = 'edLrow';
      row.innerHTML = `<span>${n}</span>`;
      const load = document.createElement('button'); load.textContent = 'Öppna'; load.onclick = () => { this.world.load(this.loadSaved(n)); this.currentName = n; this.el.querySelector('.edModal').classList.add('hidden'); };
      const del = document.createElement('button'); del.textContent = '🗑️'; del.className = 'del'; del.onclick = () => { this.deleteMap(n); this.showModal(); this.game.ui.refreshMapList?.(); };
      row.append(load, del); list.appendChild(row);
    });
    this.el.querySelector('.edModal').classList.remove('hidden');
  }

  // ---- Render ----------------------------------------------------------
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = w * dpr; this.cv.height = h * dpr; this.dpr = dpr;
    this.clampCam();
  }
  clampCam() {
    const S = TILE * this.scale, vw = this.cv.clientWidth, vh = this.cv.clientHeight;
    this.cam.x = Math.max(-40, Math.min(this.world.w * S - vw + 40, this.cam.x));
    this.cam.y = Math.max(-40, Math.min(this.world.h * S - vh + 40, this.cam.y));
  }
  loop() { if (!this.running) return; this.render(); requestAnimationFrame(() => this.loop()); }
  render() {
    const ctx = this.ctx, S = TILE * this.scale;
    const vw = this.cv.clientWidth, vh = this.cv.clientHeight;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(0, 0, vw, vh);
    const c0 = Math.max(0, Math.floor(this.cam.x / S)), c1 = Math.min(this.world.w - 1, Math.floor((this.cam.x + vw) / S));
    const r0 = Math.max(0, Math.floor(this.cam.y / S)), r1 = Math.min(this.world.h - 1, Math.floor((this.cam.y + vh) / S));
    // mark
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) this.world.drawGroundCell(ctx, x, y, x * S - this.cam.x, y * S - this.cam.y, S);
    // objekt (djup-sorterade)
    const objs = this.world.objects.filter((o) => !(o.tx > c1 + 1 || o.tx + o.fw < c0 - 1 || o.ty > r1 + 2 || o.ty + o.fh < r0 - 6)).sort((a, b) => this.world.objFootY(a, S) - this.world.objFootY(b, S));
    for (const o of objs) this.world.drawObject(ctx, o, this.cam.x, this.cam.y, S);
    // djur-spawns
    for (const a of this.world.animalSpawns) {
      const img = this.game.assets.img[a.type];
      if (img) ctx.drawImage(img, 0, 3 * 48, 48, 48, a.x * S - this.cam.x - S, a.y * S - this.cam.y - S * 1.4, S * 2, S * 2);
    }
    // overlays: åker (grön) + vägg (röd) + start
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
      const i = this.world.idx(x, y), px = x * S - this.cam.x, py = y * S - this.cam.y;
      if (this.world.farm[i]) { ctx.fillStyle = 'rgba(90,220,90,0.18)'; ctx.fillRect(px, py, S, S); }
      if (this.world.solid[i]) { ctx.strokeStyle = 'rgba(255,60,60,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, S - 2, S - 2); }
    }
    const sp = this.world.spawn;
    if (sp) { ctx.font = `${Math.round(S)}px serif`; ctx.textAlign = 'center'; ctx.fillText('🚩', sp.x * S - this.cam.x + S / 2, sp.y * S - this.cam.y + S * 0.85); }
    // rutnät
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let x = c0; x <= c1 + 1; x++) { ctx.beginPath(); ctx.moveTo(x * S - this.cam.x, 0); ctx.lineTo(x * S - this.cam.x, vh); ctx.stroke(); }
    for (let y = r0; y <= r1 + 1; y++) { ctx.beginPath(); ctx.moveTo(0, y * S - this.cam.y); ctx.lineTo(vw, y * S - this.cam.y); ctx.stroke(); }
    // hover-ruta
    if (this.hover && this.world.inBounds(this.hover.x, this.hover.y)) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(this.hover.x * S - this.cam.x, this.hover.y * S - this.cam.y, S, S); }
  }
}
