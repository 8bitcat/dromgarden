// DRÖMGÅRDEN — världen som en enhetlig, data-driven modell.
// Samma struktur används av (a) den genererade standardgården och (b) egna kartor
// från kartbyggaren. Allt är JSON-vänligt → funkar för både localStorage och co-op-snapshot.
import { blitCell, blit } from './assets.js?v=13';

export const TILE = 16;
export const MAP_W = 46;
export const MAP_H = 34;

const GRASS = ['farm_tiles', 3, 1];          // standard-marktile
const TILES = {
  path: [6, 16],   // brun grus/jordgång
  // uppluckrad åker = ljustan autotile-block (kol 4-7) med mörka kanter; single = fårad ruta
  till: { c: [6, 12], t: [6, 11], b: [6, 13], l: [5, 12], r: [7, 12], tl: [5, 11], tr: [7, 11], bl: [5, 13], br: [7, 13], single: [1, 13] },
  tuft: [[0, 0], [0, 1], [0, 2]], flower: [[1, 1], [1, 2]],
  water: { c: [3, 8], t: [3, 7], b: [3, 9], l: [2, 8], r: [4, 8], tl: [2, 7], tr: [4, 7], bl: [2, 9], br: [4, 9] },
};
const OBJ = {
  tree: [[48, 0, 32, 60], [96, 0, 32, 60]],   // BARA trädet (y0-60); under ligger annan dekor
  house: [0, 96, 80, 95],
  crate: [16, 64, 16, 16],
  fence: { h: [1, 0], v: [0, 1] },
  decor: { tulip: [3, 4], white: [2, 4], rock: [2, 5], clover: [3, 5] },
};

export const CROPS = {
  morot:     { name: 'Morot',     emoji: '🥕', seed: 4,  sell: 9,  grow: 22, stages: 4, row: 1 },
  potatis:   { name: 'Potatis',   emoji: '🥔', seed: 5,  sell: 11, grow: 26, stages: 4, row: 2 },
  sallad:    { name: 'Sallad',    emoji: '🥬', seed: 6,  sell: 14, grow: 30, stages: 4, row: 5 },
  jordgubbe: { name: 'Jordgubbe', emoji: '🍓', seed: 8,  sell: 18, grow: 34, stages: 4, row: 3 },
  pumpa:     { name: 'Pumpa',     emoji: '🎃', seed: 10, sell: 26, grow: 45, stages: 4, row: 0 },
};
export const CROP_KEYS = Object.keys(CROPS);

export class World {
  constructor() { this.w = MAP_W; this.h = MAP_H; this.A = null; this._alloc(); }
  _alloc() {
    const n = this.w * this.h;
    this.ground = new Array(n).fill(null);   // [imgKey,col,row] | null(=gräs)
    this.solid = new Uint8Array(n);
    this.farm = new Uint8Array(n);
    this.objects = [];                       // {img,sx,sy,sw,sh,tx,ty,fw,fh}
    this.plots = new Map();                  // cell -> {wet,cropType,stage,grow}
    this.animalSpawns = [];                  // {type,x,y}
    this.spawn = { x: 2, y: 2 };
    this.house = null; this.chest = null; this.shop = null;
    this._bake = null; this._bakeScale = 0;
  }
  setAssets(A) { this.A = A; }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  isSolid(x, y) { return !this.inBounds(x, y) ? true : !!this.solid[this.idx(x, y)]; }

  // -- Odlingslogik -------------------------------------------------------
  canTill(x, y) { return this.inBounds(x, y) && !this.solid[this.idx(x, y)] && this.farm[this.idx(x, y)] && !this.plots.has(this.idx(x, y)); }
  till(x, y) { if (!this.canTill(x, y)) return false; this.plots.set(this.idx(x, y), { wet: false, cropType: null, stage: 0, grow: 0 }); return true; }
  water(x, y) { const p = this.plots.get(this.idx(x, y)); if (!p || p.wet) return false; p.wet = true; return true; }
  plant(x, y, cropType) { const p = this.plots.get(this.idx(x, y)); if (!p || p.cropType || !CROPS[cropType]) return false; p.cropType = cropType; p.stage = 0; p.grow = 0; return true; }
  harvest(x, y) {
    const p = this.plots.get(this.idx(x, y)); if (!p || !p.cropType) return 0;
    if (p.stage < CROPS[p.cropType].stages - 1) return 0;
    const type = p.cropType; const n = 1 + Math.floor(Math.random() * 2);
    p.cropType = null; p.stage = 0; p.grow = 0; return { type, n };
  }
  tick(dt) {
    const changed = [];
    for (const [i, p] of this.plots) {
      if (!p.cropType) continue;
      const def = CROPS[p.cropType]; if (p.stage >= def.stages - 1) continue;
      p.grow += dt * (p.wet ? 1 : 0.5);
      if (p.grow >= def.grow) { p.grow = 0; p.stage++; if (p.wet && Math.random() < 0.6) p.wet = false; changed.push(i); }
    }
    return changed;
  }

  // -- Hjälp för att bygga/redigera --------------------------------------
  // Placera en odlingsruta direkt (för prefabs/kartor) — kringgår canTill.
  plot(x, y, cropType, stage, wet) { if (this.inBounds(x, y)) this.plots.set(this.idx(x, y), { wet: !!wet, cropType: cropType || null, stage: stage || 0, grow: 0 }); }
  waterCell(x, y, x0, y0, w, h) { return ['farm_tiles', ...this._waterCell(x, y, x0, y0, w, h)]; }
  setGround(x, y, cell) { if (this.inBounds(x, y)) { this.ground[this.idx(x, y)] = cell; this._bake = null; } }
  setSolid(x, y, v) { if (this.inBounds(x, y)) this.solid[this.idx(x, y)] = v ? 1 : 0; }
  setFarm(x, y, v) { if (this.inBounds(x, y)) this.farm[this.idx(x, y)] = v ? 1 : 0; }
  addObject(o) { this.objects.push(o); for (let yy = 0; yy < o.fh; yy++) for (let xx = 0; xx < o.fw; xx++) this.setSolid(o.tx + xx, o.ty + yy, 1); }
  clearCell(x, y) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.ground[i] = null; this.solid[i] = 0; this.farm[i] = 0; this.plots.delete(i);
    // ta bort objekt vars fotavtryck täcker rutan
    this.objects = this.objects.filter((o) => !(x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh));
    this.animalSpawns = this.animalSpawns.filter((a) => Math.floor(a.x) !== x || Math.floor(a.y) !== y);
    this._bake = null;
  }

  // -- Standardgård (genererad) ------------------------------------------
  generate() {
    this._alloc();
    let s = 20250723; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    // hela fältet blir odlingsbart gräs som utgångsläge
    for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) this.setFarm(x, y, 1);

    // trädram
    for (let x = 0; x < this.w; x++) { this._tree(x, 0); this._tree(x, this.h - 1); }
    for (let y = 1; y < this.h - 1; y++) { this._tree(0, y); this._tree(this.w - 1, y); }

    // rektangulär damm (autotile-kant)
    const px0 = 4, py0 = this.h - 9, pw = 9, ph = 6;
    for (let y = py0; y < py0 + ph; y++) for (let x = px0; x < px0 + pw; x++) { this.setSolid(x, y, 1); this.setFarm(x, y, 0); }
    for (let y = py0; y < py0 + ph; y++) for (let x = px0; x < px0 + pw; x++) this.ground[this.idx(x, y)] = ['farm_tiles', ...this._waterCell(x, y, px0, py0, pw, ph)];

    // hus (objekt) + fotavtryck
    const hx = 4, hy = 4, hw = 5, hh = 4;
    this.house = { x: hx, y: hy, w: hw, h: hh };
    this.addObject({ img: 'farm_objects', sx: OBJ.house[0], sy: OBJ.house[1], sw: OBJ.house[2], sh: OBJ.house[3], tx: hx, ty: hy, fw: hw, fh: hh });
    for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) this.setFarm(x, y, 0);

    // grusgång
    const doorX = hx + 2;
    for (let y = hy + hh; y < hy + hh + 5; y++) this._pathTile(doorX, y);
    const midY = hy + hh + 4;
    for (let x = doorX; x < this.w - 9; x++) this._pathTile(x, midY);

    // sälj/butik-lådor
    this.chest = { x: doorX + 3, y: hy + hh + 1 };
    this.shop = { x: doorX - 2, y: hy + hh + 1 };

    // djurhage (staket) + djur-spawns
    const nx = this.w - 13, ny = 4, nw = 10, nh = 8;
    for (let x = nx; x < nx + nw; x++) { this._fence(x, ny); this._fence(x, ny + nh - 1); }
    for (let y = ny; y < ny + nh; y++) { this._fence(nx, y); this._fence(nx + nw - 1, y); }
    this.clearCell(nx + Math.floor(nw / 2), ny + nh - 1); // grind
    for (let y = ny; y < ny + nh; y++) for (let x = nx; x < nx + nw; x++) this.setFarm(x, y, 0);
    for (let i = 0; i < 3; i++) this.animalSpawns.push({ type: 'chicken', x: nx + 2 + rnd() * (nw - 4), y: ny + 2 + rnd() * (nh - 4) });
    for (let i = 0; i < 2; i++) this.animalSpawns.push({ type: 'cow', x: nx + 2 + rnd() * (nw - 4), y: ny + 2 + rnd() * (nh - 4) });

    // spridda träd (glesa så kronor inte överlappar) + blommor + gräsdetalj
    const treePos = [];
    const farFromTrees = (x, y) => treePos.every((t) => Math.abs(t[0] - x) + Math.abs(t[1] - y) > 3);
    for (let i = 0; i < 60; i++) {
      const x = 3 + Math.floor(rnd() * (this.w - 6)), y = 3 + Math.floor(rnd() * (this.h - 6));
      if (this.solid[this.idx(x, y)] || this._nearImportant(x, y)) continue;
      const r = rnd();
      if (r < 0.4) { if (farFromTrees(x, y)) { this._tree(x, y); treePos.push([x, y]); } }
      else { const k = ['tulip', 'white', 'rock', 'clover'][(rnd() * 4) | 0]; this.ground[this.idx(x, y)] = ['farm_objects', ...OBJ.decor[k]]; }
    }
    for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) {
      if (this.ground[this.idx(x, y)] || this.solid[this.idx(x, y)]) continue;
      const r = this._hash(x, y);
      if (r > 0.9) this.ground[this.idx(x, y)] = ['farm_tiles', ...TILES.tuft[(r * TILES.tuft.length) | 0]];
      else if (r > 0.85) this.ground[this.idx(x, y)] = ['farm_tiles', ...TILES.flower[(r * TILES.flower.length) | 0]];
    }

    this.spawn = { x: doorX, y: midY + 1 };
    this._bake = null;
  }
  _tree(x, y) { const v = (x + y) % 2, t = OBJ.tree[v]; this.addObject({ img: 'farm_objects', sx: t[0], sy: t[1], sw: t[2], sh: t[3], tx: x, ty: y, fw: 1, fh: 1 }); this.setFarm(x, y, 0); }
  _fence(x, y) { const horiz = false; this.ground[this.idx(x, y)] = ['farm_objects', ...(horiz ? OBJ.fence.h : OBJ.fence.v)]; this.setSolid(x, y, 1); }
  _pathTile(x, y) { this.ground[this.idx(x, y)] = ['farm_tiles', ...TILES.path]; this.setFarm(x, y, 0); }
  _nearImportant(x, y) {
    const near = (o, pad) => o && x >= o.x - pad && x <= o.x + (o.w || 1) + pad && y >= o.y - pad && y <= o.y + (o.h || 1) + pad;
    return near(this.house, 2) || near(this.chest, 1) || near(this.shop, 1);
  }
  _waterCell(tx, ty, x0, y0, w, h) {
    const up = ty > y0, dn = ty < y0 + h - 1, le = tx > x0, ri = tx < x0 + w - 1, W = TILES.water;
    if (!up && !le) return W.tl; if (!up && !ri) return W.tr; if (!dn && !le) return W.bl; if (!dn && !ri) return W.br;
    if (!up) return W.t; if (!dn) return W.b; if (!le) return W.l; if (!ri) return W.r; return W.c;
  }
  _hash(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff; }

  // -- Serialisering (spara + co-op-snapshot) ----------------------------
  serialize() {
    const ground = {};
    for (let i = 0; i < this.ground.length; i++) if (this.ground[i]) ground[i] = this.ground[i];
    const solid = [], farm = [];
    for (let i = 0; i < this.solid.length; i++) { if (this.solid[i]) solid.push(i); if (this.farm[i]) farm.push(i); }
    return { w: this.w, h: this.h, ground, solid, farm, objects: this.objects, animalSpawns: this.animalSpawns,
      spawn: this.spawn, house: this.house, chest: this.chest, shop: this.shop };
  }
  load(m) {
    this.w = m.w; this.h = m.h; this._alloc();
    for (const k in m.ground || {}) this.ground[+k] = m.ground[k];
    for (const i of m.solid || []) this.solid[i] = 1;
    for (const i of m.farm || []) this.farm[i] = 1;
    this.objects = m.objects || []; this.animalSpawns = m.animalSpawns || [];
    this.spawn = m.spawn || { x: 2, y: 2 };
    this.house = m.house || null; this.chest = m.chest || null; this.shop = m.shop || null;
    this._bake = null;
  }
  snapshot() { const s = this.serialize(); s.plots = Array.from(this.plots.entries()); return s; }
  applySnapshot(s) { this.load(s); this.plots = new Map(s.plots || []); }
  plotState(i) { return { i, p: this.plots.get(i) || null }; }
  applyPlot(d) { if (d.p) this.plots.set(d.i, d.p); else this.plots.delete(d.i); }

  // -- Rendering ----------------------------------------------------------
  _bakeGround(scale) {
    const S = TILE * scale, img = this.A.img;
    const cv = document.createElement('canvas'); cv.width = this.w * S; cv.height = this.h * S;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      blitCell(c, img.farm_tiles, GRASS[1], GRASS[2], x * S, y * S, S);
      const g = this.ground[this.idx(x, y)];
      if (g) blitCell(c, img[g[0]], g[1], g[2], x * S, y * S, S);
    }
    this._bake = cv; this._bakeScale = scale;
  }
  getBake(scale) { if (!this._bake || this._bakeScale !== scale) this._bakeGround(scale); return this._bake; }
  // Rita en enskild markruta direkt (används av editorn — inget om-bakande vid penseldrag)
  drawGroundCell(ctx, x, y, px, py, S) {
    blitCell(ctx, this.A.img.farm_tiles, GRASS[1], GRASS[2], px, py, S);
    const g = this.ground[this.idx(x, y)];
    if (g) blitCell(ctx, this.A.img[g[0]], g[1], g[2], px, py, S);
  }

  _tilledCell(x, y) {
    const t = (xx, yy) => this.plots.has(this.idx(xx, yy));
    const up = t(x, y - 1), dn = t(x, y + 1), le = t(x - 1, y), ri = t(x + 1, y), F = TILES.till;
    if (!up && !dn && !le && !ri) return F.single;
    if (!up && !le) return F.tl; if (!up && !ri) return F.tr;
    if (!dn && !le) return F.bl; if (!dn && !ri) return F.br;
    if (!up) return F.t; if (!dn) return F.b; if (!le) return F.l; if (!ri) return F.r;
    return F.c;
  }
  drawPlot(ctx, tx, ty, px, py, S) {
    const p = this.plots.get(this.idx(tx, ty)); if (!p) return;
    // KORREKT autotile: kol 5-7 rad 11-13, äkta center (6,12). Sömlöst i alla storlekar,
    // med paketets fina mörka plätt-kant runt fältet.
    const c = this._tilledCell(tx, ty);
    blitCell(ctx, this.A.img.farm_tiles, c[0], c[1], px, py, S);
    if (p.wet) { ctx.fillStyle = 'rgba(55,32,14,0.32)'; ctx.fillRect(px + S * 0.14, py + S * 0.14, S * 0.72, S * 0.72); } // vått = mörkare mitt
    if (p.cropType) { const def = CROPS[p.cropType]; blitCell(ctx, this.A.img.plants, 1 + Math.min(p.stage, def.stages - 1), def.row, px, py, S); }
  }

  objFootY(o, S) { return (o.ty + o.fh) * S; }
  drawObject(ctx, o, camX, camY, S) {
    const dw = (o.sw / TILE) * S, dh = (o.sh / TILE) * S;
    const dx = o.tx * S - camX - (dw - o.fw * S) / 2;
    const dy = (o.ty + o.fh) * S - camY - dh;
    blit(ctx, this.A.img[o.img], o.sx, o.sy, o.sw, o.sh, dx, dy, dw, dh);
  }
  drawCrate(ctx, px, py, S) { const s = OBJ.crate; blit(ctx, this.A.img.farm_objects, s[0], s[1], s[2], s[3], px, py, S, S); }
}
