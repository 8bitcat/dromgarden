// DRÖMGÅRDEN — huvudlogik: spelare, djur, verktyg, rendering, spelloop och nät-glue.
import { World, TILE, CROPS, CROP_KEYS } from './world.js?v=9';
import { loadAssets, drawFarmer, drawAnimalSprite, drawShadow, CHAR, ANIM, DIR } from './assets.js?v=9';
import { Net } from './net.js?v=9';
import { UI } from './ui.js?v=9';
import { Input } from './input.js?v=9';
import { Editor } from './editor.js?v=9';
import { MAPS } from './prefabs.js?v=9';

const SPEED = 4.4;
const DAY_LEN = 480;
const COLORS = ['#ff7ab6', '#7ac6ff', '#ffd166', '#9be564', '#c78bff', '#ff9f68', '#66d9c8', '#f26d6d'];

const TOOLS = [
  { key: 'hoe',     label: 'Hacka',  emoji: '⛏️' },
  { key: 'water',   label: 'Vattna', emoji: '💧' },
  { key: 'seed',    label: 'Så',     emoji: '🌱' },
  { key: 'harvest', label: 'Skörda', emoji: '🧺' },
  { key: 'hand',    label: 'Klappa', emoji: '✋' },
];
const DIR_DELTA = { [DIR.UP]: [0, -1], [DIR.RIGHT]: [1, 0], [DIR.LEFT]: [-1, 0], [DIR.DOWN]: [0, 1] };

class Game {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ui = new UI();
    this.net = new Net();
    this.world = new World();
    this.assets = null;
    this.mode = 'solo';
    this.myId = 'host';
    this.players = new Map();
    this.animals = [];
    this.shared = { coins: 60, seeds: { morot: 6, potatis: 4, sallad: 3, jordgubbe: 3, pumpa: 1 }, produce: {}, day: 1, time: 8 };
    this.tool = 0;
    this.selectedSeed = CROP_KEYS[0];
    this.cam = { x: 0, y: 0 };
    this.scale = 3;
    this.now = 0; this.last = 0;
    this._acc = { pos: 0, players: 0, animals: 0, stats: 0 };
    this._nextColor = 0;
  }

  async boot() {
    this.assets = await loadAssets();
    this.world.setAssets(this.assets);
    this.ui.init({
      onStart: (m) => this.start(m),
      onOpenShop: () => this.ui.openShop(this.shared, (c) => this.doBuy(c)),
      onOpenSell: () => this.ui.openSell(this.shared),
      onSellAll: () => this.doSell(),
    });
    this.ui.buildToolbar(TOOLS, (i) => this.selectTool(i));
    this.ui.buildSeedPicker((k) => { this.selectedSeed = k; });
    this.ui.setActiveTool(0);
    this.input = new Input(this.canvas, {
      onAction: () => this.doAction(),
      onTool: (i) => { if (i < TOOLS.length) this.selectTool(i); },
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    document.getElementById('roomCode').onclick = () => {
      if (this.mode === 'host' && this.net.code) navigator.clipboard?.writeText(this.net.code).then(() => this.ui.toast('Kod kopierad: ' + this.net.code));
    };
    // Kartbyggare
    this.editor = new Editor(this);
    this.ui.initMaps({
      onEditor: () => this.editor.open(null),
      onEditMap: (name) => this.editor.open(name),
      onPlayMap: (name, mode) => { this.pendingMap = this.editor.loadSaved(name); this.start(mode); },
      listMaps: () => this.editor.listSaved(),
    });
    this.ui.showMenu();
  }

  buildWorld() {
    if (this.pendingMap) { this.world.load(this.pendingMap); this.pendingMap = null; }
    else if (this.pendingPreset && MAPS[this.pendingPreset]) { MAPS[this.pendingPreset].build(this.world); this.pendingPreset = null; }
    else this.world.generate();
    this.spawnAnimals();
  }

  // ---- Start / nät -----------------------------------------------------
  start(mode) {
    const name = this.ui.name();
    // vald karta i menyn (om ingen redan satt av editorn)
    if (!this.pendingMap && !this.pendingPreset && (mode === 'solo' || mode === 'host')) {
      const mn = this.ui.selectedMap();
      if (mn.startsWith('#')) this.pendingPreset = mn.slice(1);
      else if (mn) this.pendingMap = this.editor.loadSaved(mn);
    }
    if (mode === 'solo') {
      this.mode = 'solo'; this.myId = 'host';
      this.buildWorld();
      this.addPlayer('host', name, this.nextColor(), this.world.spawn.x + 0.5, this.world.spawn.y + 0.5);
      this.ui.setRoomCode(null, 'solo'); this.begin();
    } else if (mode === 'host') {
      this.mode = 'host'; this.myId = 'host';
      this.buildWorld();
      this.addPlayer('host', name, this.nextColor(), this.world.spawn.x + 0.5, this.world.spawn.y + 0.5);
      this.ui.menuMsg('Skapar rum…');
      this.net.on({
        msg: (from, t, d) => this.onHostMsg(from, t, d),
        peerLeave: (id) => this.onLeave(id),
        netError: () => this.ui.menuMsg('Nätverksfel — testa igen.'),
      });
      this.net.host((code) => { this.ui.setRoomCode(code, 'host'); this.begin(); this.ui.toast('Rum skapat! Dela koden: ' + code, 4000); });
    } else if (mode === 'join') {
      const code = this.ui.joinCode();
      if (!code || code.length < 4) { this.ui.menuMsg('Skriv en 4-teckens kod.'); return; }
      this.mode = 'client';
      this.ui.menuMsg('Ansluter till ' + code + '…');
      this.net.on({ msg: (from, t, d) => this.onClientMsg(t, d), hostLost: () => this.ui.toast('Värden lämnade spelet 😢', 4000) });
      this.net.join(code, () => { this.myId = this.net.myId; this.net.send('hello', { name }); },
        (err) => this.ui.menuMsg('Kunde inte ansluta (' + err + '). Kolla koden.'));
    }
  }

  begin() {
    this.ui.showGame();
    this.ui.setRoomCode(this.net.code, this.mode);
    this.refreshInventoryUI();
    this.ui.toast('Tips: gå fram till ett djur med 🥚/🥛 och tryck på gröna knappen!', 5000);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  nextColor() { const c = COLORS[this._nextColor % COLORS.length]; this._nextColor++; return c; }

  addPlayer(id, name, color, x, y) {
    const p = { id, name, color, x, y, dir: DIR.DOWN, mv: false, flip: false, animT: 0, frame: 0, row: 0, actUntil: 0, act: null };
    this.players.set(id, p); return p;
  }
  me() { return this.players.get(this.myId); }

  // ---- HOST ------------------------------------------------------------
  onHostMsg(from, t, d) {
    if (t === 'hello') {
      const color = this.nextColor();
      const p = this.addPlayer(from, (d.name || 'Bonde').slice(0, 12), color, this.world.spawn.x + 0.5, this.world.spawn.y + 0.5);
      this.net.sendTo(from, 'welcome', {
        you: { id: from, name: p.name, color, x: p.x, y: p.y },
        world: this.world.snapshot(), shared: this.shared, players: this.serializePlayers(), animals: this.animals,
      });
      this.broadcastPlayers();
      this.ui.toast(p.name + ' gick med! 👋', 3000);
      this.net.broadcast('toast', { text: p.name + ' gick med! 👋' }, from);
    } else if (t === 'pos') {
      const p = this.players.get(from);
      if (p) { p.x = d.x; p.y = d.y; p.dir = d.dir; p.mv = d.mv; p.flip = d.flip; }
    } else if (t === 'do') {
      this.applyDo(from, d);
    }
  }
  onLeave(id) {
    const p = this.players.get(id);
    if (p) { this.ui.toast(p.name + ' lämnade.', 2500); this.net.broadcast('toast', { text: p.name + ' lämnade.' }); }
    this.players.delete(id); this.broadcastPlayers();
  }

  // ---- CLIENT ----------------------------------------------------------
  onClientMsg(t, d) {
    if (t === 'welcome') {
      this.world.applySnapshot(d.world); this.shared = d.shared; this.animals = d.animals || [];
      this.players.clear();
      for (const sp of d.players) this.addPlayer(sp.id, sp.name, sp.color, sp.x, sp.y);
      const you = d.you;
      if (!this.players.has(you.id)) this.addPlayer(you.id, you.name, you.color, you.x, you.y);
      this.myId = you.id; this.begin();
    } else if (t === 'players') {
      for (const sp of d) {
        if (sp.id === this.myId) continue;
        let p = this.players.get(sp.id) || this.addPlayer(sp.id, sp.name, sp.color, sp.x, sp.y);
        p.x = sp.x; p.y = sp.y; p.dir = sp.dir; p.mv = sp.mv; p.flip = sp.flip; p.name = sp.name; p.color = sp.color;
        if (sp.act && p.act !== sp.act) { p.act = sp.act; p.actUntil = this.now + 0.35; }
      }
      const ids = new Set(d.map((s) => s.id));
      for (const id of [...this.players.keys()]) if (id !== this.myId && !ids.has(id)) this.players.delete(id);
    } else if (t === 'tile') { this.world.applyPlot(d); }
    else if (t === 'animals') { this.animals = d; }
    else if (t === 'stats') { this.shared = d; this.refreshInventoryUI(); }
    else if (t === 'toast') { this.ui.toast(d.text); }
  }

  serializePlayers() {
    const arr = [];
    for (const p of this.players.values())
      arr.push({ id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, dir: p.dir, mv: p.mv, flip: p.flip, act: this.now < p.actUntil ? p.act : null });
    return arr;
  }
  broadcastPlayers() { if (this.mode !== 'client') this.net.broadcast('players', this.serializePlayers()); }
  broadcastStats() { if (this.mode !== 'client') this.net.broadcast('stats', this.shared); this.refreshInventoryUI(); }
  broadcastTile(i) { if (this.mode !== 'client') this.net.broadcast('tile', this.world.plotState(i)); }

  // ---- Verktyg / handlingar -------------------------------------------
  selectTool(i) { this.tool = i; this.ui.setActiveTool(i); if (TOOLS[i].key === 'seed') this.ui.refreshSeedPicker(this.shared); }
  targetTile() { const p = this.me(); if (!p) return null; const [dx, dy] = DIR_DELTA[p.dir]; return { x: Math.floor(p.x) + dx, y: Math.floor(p.y) + dy }; }

  nearReadyAnimal() {
    const p = this.me(); if (!p) return null;
    let best = null, bd = 1.5;
    for (const a of this.animals) { const d = Math.hypot(a.x - p.x, a.y - p.y); if (a.ready && d < bd) { bd = d; best = a; } }
    return best;
  }

  doAction() {
    const p = this.me(); if (!p) return;
    const tool = TOOLS[this.tool];
    p.act = tool.key; p.actUntil = this.now + 0.35;
    // Nära ett redo djur? Samla alltid (oavsett verktyg) — enkelt för barnen.
    const a = this.nearReadyAnimal();
    if (a || tool.key === 'hand') {
      if (a) { if (this.mode === 'client') this.net.send('do', { k: 'collect', id: a.id }); else this.applyDo(this.myId, { k: 'collect', id: a.id }); }
      return;
    }
    const tgt = this.targetTile(); if (!tgt) return;
    const kind = tool.key === 'seed' ? 'plant' : tool.key === 'hoe' ? 'till' : tool.key === 'water' ? 'water' : 'harvest';
    const payload = { k: kind, tx: tgt.x, ty: tgt.y };
    if (kind === 'plant') payload.crop = this.selectedSeed;
    if (this.mode === 'client') this.net.send('do', payload); else this.applyDo(this.myId, payload);
  }

  applyDo(fromId, d) {
    if (this.mode === 'client') return;
    const actor = this.players.get(fromId);
    const nm = actor ? actor.name : 'Någon';
    if (actor && d.k) { const map = { till: 'hoe', water: 'water', plant: 'seed', harvest: 'harvest', collect: 'hand' }; if (map[d.k]) { actor.act = map[d.k]; actor.actUntil = this.now + 0.35; } }
    if (d.k === 'till') { if (this.world.till(d.tx, d.ty)) this.broadcastTile(this.world.idx(d.tx, d.ty)); }
    else if (d.k === 'water') { if (this.world.water(d.tx, d.ty)) this.broadcastTile(this.world.idx(d.tx, d.ty)); }
    else if (d.k === 'plant') {
      const crop = d.crop;
      if ((this.shared.seeds[crop] || 0) <= 0) { this.notify(fromId, 'Slut på ' + CROPS[crop].name + '-frön! Köp i 🛒 Butik'); return; }
      if (this.world.plant(d.tx, d.ty, crop)) { this.shared.seeds[crop]--; this.broadcastTile(this.world.idx(d.tx, d.ty)); this.broadcastStats(); }
    } else if (d.k === 'harvest') {
      const res = this.world.harvest(d.tx, d.ty);
      if (res) { this.shared.produce[res.type] = (this.shared.produce[res.type] || 0) + res.n; this.broadcastTile(this.world.idx(d.tx, d.ty)); this.broadcastStats(); this.announce(`${nm} skördade ${res.n} ${CROPS[res.type].name.toLowerCase()} ${CROPS[res.type].emoji}`); }
    } else if (d.k === 'collect') {
      const a = this.animals.find((x) => x.id === d.id);
      if (a && a.ready) { a.ready = false; a.timer = 0; const gain = a.type === 'cow' ? 8 : 3; this.shared.coins += gain; this.broadcastStats(); this.announce(`${nm} samlade ${a.type === 'cow' ? 'mjölk 🥛' : 'ägg 🥚'} (+${gain} 🪙)`); }
    } else if (d.k === 'buy') { this.buyImpl(fromId, d.crop); }
    else if (d.k === 'sell') { this.sellImpl(fromId); }
  }

  buyImpl(fromId, crop) {
    const c = CROPS[crop]; if (!c) return;
    if (this.shared.coins < c.seed) { this.notify(fromId, 'För lite mynt!'); return; }
    this.shared.coins -= c.seed; this.shared.seeds[crop] = (this.shared.seeds[crop] || 0) + 1;
    this.broadcastStats(); this.ui.refreshShop(this.shared, (k) => this.doBuy(k));
  }
  sellImpl(fromId) {
    let total = 0;
    for (const k of CROP_KEYS) { const n = this.shared.produce[k] || 0; total += n * CROPS[k].sell; this.shared.produce[k] = 0; }
    if (total <= 0) { this.notify(fromId, 'Inget att sälja.'); return; }
    this.shared.coins += total; this.broadcastStats();
    const actor = this.players.get(fromId);
    this.announce(`${actor ? actor.name : 'Någon'} skeppade skörd för ${total} 🪙`);
    this.ui.refreshSell(this.shared);
  }
  doBuy(crop) { if (this.mode === 'client') this.net.send('do', { k: 'buy', crop }); else this.buyImpl(this.myId, crop); }
  doSell() { if (this.mode === 'client') this.net.send('do', { k: 'sell' }); else this.sellImpl(this.myId); }

  notify(id, text) { if (id === this.myId) this.ui.toast(text); else this.net.sendTo(id, 'toast', { text }); }
  announce(text) { this.ui.toast(text); if (this.mode !== 'client') this.net.broadcast('toast', { text }); }
  refreshInventoryUI() {
    this.ui.hud({ coins: this.shared.coins, day: this.shared.day, time: this.shared.time, players: this.players.size });
    this.ui.refreshSeedPicker(this.shared);
    this.ui.refreshShop(this.shared, (k) => this.doBuy(k));
    this.ui.refreshSell(this.shared);
  }

  // ---- Djur (spawnas från kartans animalSpawns, vandrar runt sitt hem) --
  spawnAnimals() {
    this.animals = []; let n = 0;
    for (const sp of this.world.animalSpawns) {
      const iv = sp.type === 'cow' ? 30 : 18;
      this.animals.push({ id: 'a' + (n++), type: sp.type, x: sp.x, y: sp.y, home: { x: sp.x, y: sp.y }, dir: DIR.DOWN, mv: false, ready: false, timer: Math.max(0, iv - (6 + Math.random() * 6)), iv, tx: sp.x, ty: sp.y, wait: 0 });
    }
  }
  updateAnimals(dt) {
    for (const a of this.animals) {
      a.timer += dt; if (!a.ready && a.timer >= a.iv) a.ready = true;
      a.wait -= dt;
      if (a.wait <= 0) { a.tx = a.home.x + (Math.random() * 5 - 2.5); a.ty = a.home.y + (Math.random() * 5 - 2.5); a.wait = 2 + Math.random() * 3; }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 0.06) {
        const sp = (a.type === 'cow' ? 0.7 : 1.1) * dt;
        const nx = a.x + (dx / d) * Math.min(sp, d), ny = a.y + (dy / d) * Math.min(sp, d);
        if (!this.world.isSolid(Math.floor(nx), Math.floor(ny))) { a.x = nx; a.y = ny; a.mv = true; }
        else { a.wait = 0; a.mv = false; }
        a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR.RIGHT : DIR.LEFT) : (dy > 0 ? DIR.DOWN : DIR.UP);
      } else a.mv = false;
    }
  }

  // ---- Loop ------------------------------------------------------------
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.now += dt;
    this.update(dt); this.render();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  update(dt) {
    const me = this.me();
    if (me) this.moveLocal(me, dt);
    for (const p of this.players.values()) this.updateAnim(p, dt);
    if (this.mode !== 'client') {
      const changed = this.world.tick(dt); for (const i of changed) this.broadcastTile(i);
      this.updateAnimals(dt);
      const prevDay = this.shared.day;
      this.shared.time += dt * (24 / DAY_LEN);
      if (this.shared.time >= 24) { this.shared.time -= 24; this.shared.day++; }
      if (this.shared.day !== prevDay) this.announce('☀️ Ny dag på gården! (Dag ' + this.shared.day + ')');
    }
    if (this.mode === 'host') {
      this._acc.players += dt; this._acc.animals += dt; this._acc.stats += dt;
      if (this._acc.players > 0.08) { this._acc.players = 0; this.broadcastPlayers(); }
      if (this._acc.animals > 0.3) { this._acc.animals = 0; this.net.broadcast('animals', this.animals); }
      if (this._acc.stats > 1) { this._acc.stats = 0; this.net.broadcast('stats', this.shared); }
    } else if (this.mode === 'client') {
      this._acc.pos += dt;
      if (this._acc.pos > 0.066 && me) { this._acc.pos = 0; this.net.send('pos', { x: me.x, y: me.y, dir: me.dir, mv: me.mv, flip: me.flip }); }
    }
    this.ui.hud({ coins: this.shared.coins, day: this.shared.day, time: this.shared.time, players: this.players.size });
    this.updateActionLabel();
  }

  moveLocal(p, dt) {
    const mv = this.input.getMove();
    const step = SPEED * dt;
    p.mv = Math.abs(mv.x) > 0.01 || Math.abs(mv.y) > 0.01;
    if (p.mv) {
      p.dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x > 0 ? DIR.RIGHT : DIR.LEFT) : (mv.y > 0 ? DIR.DOWN : DIR.UP);
      if (mv.x < -0.01) p.flip = true; else if (mv.x > 0.01) p.flip = false;
      let nx = p.x, ny = p.y;
      const tx = p.x + mv.x * step, ty = p.y + mv.y * step;
      if (!this.blocked(tx, p.y)) nx = tx;
      if (!this.blocked(nx, ty)) ny = ty;
      p.x = Math.max(0.5, Math.min(this.world.w - 0.5, nx));
      p.y = Math.max(0.5, Math.min(this.world.h - 0.5, ny));
    }
  }
  blocked(px, py) {
    const r = 0.28;
    for (const [ux, uy] of [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]])
      if (this.world.isSolid(Math.floor(ux), Math.floor(uy))) return true;
    return false;
  }

  updateAnim(p, dt) {
    p.animT += dt;
    const set = p.mv ? CHAR.walk : CHAR.idle;
    if (p.row !== set.row) { p.row = set.row; p.animT = 0; }
    p.frame = Math.floor(p.animT * set.fps) % set.frames;
  }

  updateActionLabel() {
    const tool = TOOLS[this.tool];
    let lbl = tool.label;
    if (this.nearReadyAnimal()) lbl = 'Samla 🥚';
    else if (tool.key === 'seed') { const n = this.shared.seeds[this.selectedSeed] || 0; lbl = `Så ${CROPS[this.selectedSeed].name} ×${n}`; }
    else if (tool.key === 'hand') lbl = 'Klappa';
    this.ui.actionLabel(lbl);
  }

  // ---- Render ----------------------------------------------------------
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.dpr = dpr; this.vw = w; this.vh = h;
    this.scale = Math.max(2, Math.min(4, Math.round(Math.min(w, h) / (TILE * 12))));
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const S = TILE * this.scale;
    const me = this.me(); if (!me) return;
    const mapPxW = this.world.w * S, mapPxH = this.world.h * S;
    this.cam.x = Math.max(0, Math.min(mapPxW - this.vw, me.x * S - this.vw / 2));
    this.cam.y = Math.max(0, Math.min(mapPxH - this.vh, me.y * S - this.vh / 2));
    if (mapPxW < this.vw) this.cam.x = (mapPxW - this.vw) / 2;
    if (mapPxH < this.vh) this.cam.y = (mapPxH - this.vh) / 2;

    ctx.fillStyle = '#8ec95a'; ctx.fillRect(0, 0, this.vw, this.vh);

    const bake = this.world.getBake(this.scale);
    const sx = Math.max(0, this.cam.x), sy = Math.max(0, this.cam.y);
    const sw = Math.min(this.vw, bake.width - sx), sh = Math.min(this.vh, bake.height - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(bake, sx, sy, sw, sh, sx - this.cam.x, sy - this.cam.y, sw, sh);

    const c0 = Math.max(0, Math.floor(this.cam.x / S) - 1), c1 = Math.min(this.world.w - 1, Math.floor((this.cam.x + this.vw) / S) + 1);
    const r0 = Math.max(0, Math.floor(this.cam.y / S) - 1), r1 = Math.min(this.world.h - 1, Math.floor((this.cam.y + this.vh) / S) + 1);
    for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) this.world.drawPlot(ctx, tx, ty, tx * S - this.cam.x, ty * S - this.cam.y, S);

    // målruta
    const tgt = this.targetTile();
    if (tgt && this.world.inBounds(tgt.x, tgt.y) && TOOLS[this.tool].key !== 'hand') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(tgt.x * S - this.cam.x + 2, tgt.y * S - this.cam.y + 2, S - 4, S - 4);
    }

    // depth-sorterade objekt + entiteter
    const ents = [];
    for (const o of this.world.objects) {
      if (o.tx > c1 + 1 || o.tx + o.fw < c0 - 1 || o.ty > r1 + 2 || o.ty + o.fh < r0 - 6) continue;
      ents.push({ y: this.world.objFootY(o, S), draw: () => this.world.drawObject(ctx, o, this.cam.x, this.cam.y, S) });
    }
    const ch = this.world.chest, sh2 = this.world.shop;
    if (ch) ents.push({ y: ch.y * S + 1, draw: () => { this.world.drawCrate(ctx, ch.x * S - this.cam.x, ch.y * S - this.cam.y, S); this.emojiTag(ctx, '📦', ch.x * S - this.cam.x + S / 2, ch.y * S - this.cam.y - 2, S); } });
    if (sh2) ents.push({ y: sh2.y * S + 1, draw: () => { this.world.drawCrate(ctx, sh2.x * S - this.cam.x, sh2.y * S - this.cam.y, S); this.emojiTag(ctx, '🛒', sh2.x * S - this.cam.x + S / 2, sh2.y * S - this.cam.y - 2, S); } });
    for (const a of this.animals) ents.push({ y: a.y * S, draw: () => this.drawAnimal(ctx, a, S) });
    for (const p of this.players.values()) ents.push({ y: p.y * S, draw: () => this.drawPlayer(ctx, p, S) });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    this.drawNight(ctx);
    this.input.drawJoystick(ctx);
  }

  drawPlayer(ctx, p, S) {
    let footY = p.y * S - this.cam.y + S * 0.35;
    const cx = p.x * S - this.cam.x;
    // liten hopp-effekt vid handling
    if (this.now < p.actUntil) footY -= Math.sin((1 - (p.actUntil - this.now) / 0.35) * Math.PI) * S * 0.18;
    drawShadow(ctx, this.assets.img.shadow, cx, footY, S * 0.6, S * 0.26);
    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(2, this.scale); ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(cx, footY, S * 0.3, S * 0.14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    drawFarmer(ctx, this.assets.img.farmer, p.row, p.frame, cx, footY, this.scale, p.flip);
    this.drawNameTag(ctx, p.name, p.color, cx, footY - S * 1.4);
  }

  drawAnimal(ctx, a, S) {
    const cx = a.x * S - this.cam.x, footY = a.y * S - this.cam.y + S * 0.42;
    drawShadow(ctx, this.assets.img.shadow, cx, footY, S * 0.62, S * 0.24);
    const meta = ANIM[a.type], frame = Math.floor(this.now * meta.fps) % meta.frames;
    drawAnimalSprite(ctx, this.assets.img[a.type], frame, a.dir, cx, footY, this.scale * (a.type === 'cow' ? 0.8 : 0.68));
    if (a.ready) this.drawReadyIcon(ctx, a.type, cx, footY - S * 1.45 + Math.sin(this.now * 3) * S * 0.1, S);
  }

  // Pixelkonst-ikon för färdig produkt (ägg ritas, mjölk = riktig sprite)
  drawReadyIcon(ctx, type, cx, cy, S) {
    // liten vit bubbla för kontrast
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, S * 0.44, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (type === 'cow') {
      const s = S * 0.62; ctx.drawImage(this.assets.img.farm_items, 0, 32, 16, 16, cx - s / 2, cy - s / 2, s, s);
    } else {
      const w = S * 0.36, h = S * 0.48;
      ctx.fillStyle = '#f2e0ac'; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.05, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(1.5, S * 0.08); ctx.strokeStyle = '#9c7833'; ctx.stroke();
      ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.ellipse(cx - w * 0.16, cy - h * 0.12, w * 0.18, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  emojiTag(ctx, e, cx, y, S) { ctx.font = `${Math.round(S * 0.55)}px serif`; ctx.textAlign = 'center'; ctx.fillText(e, cx, y); }

  drawNameTag(ctx, name, color, cx, y) {
    ctx.font = `bold ${Math.round(9 + this.scale * 2)}px system-ui, sans-serif`; ctx.textAlign = 'center';
    const w = ctx.measureText(name).width + 12;
    ctx.fillStyle = 'rgba(20,20,30,0.6)'; ctx.fillRect(cx - w / 2, y - 14, w, 18);
    ctx.fillStyle = color; ctx.fillRect(cx - w / 2, y + 3, w, 2);
    ctx.fillStyle = '#fff'; ctx.fillText(name, cx, y);
  }

  drawNight(ctx) {
    // Dagtid (07–19) = ingen hinna. Mjuk gryning/skymning, dämpad natt.
    const t = this.shared.time; let dark = 0;
    if (t >= 19) dark = Math.min(1, (t - 19) / 3);   // 19→22 mörknar
    else if (t < 5) dark = 1;                          // 22→05 natt
    else if (t < 7) dark = (7 - t) / 2;                // 05→07 ljusnar
    dark = Math.max(0, Math.min(0.42, dark * 0.42));
    if (dark > 0.01) { ctx.fillStyle = `rgba(20,26,70,${dark})`; ctx.fillRect(0, 0, this.vw, this.vh); }
  }
}

window.addEventListener('DOMContentLoaded', () => { const g = new Game(); g.boot(); window.__game = g; });
