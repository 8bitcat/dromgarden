// DRÖMGÅRDEN — världen: rutnät, tiles, grödor, kartgenerering och rendering.
// Marken ritas nu med Tiny Wonder Farm-tileset (gräs, vatten-autotile, jord),
// grödor från plants-arket, träd och hus som riktiga objekt-sprites.
import { blitCell, blit, TS } from './assets.js';

export const TILE = 16;
export const MAP_W = 46;
export const MAP_H = 34;

export const T = { GRASS: 0, PATH: 1, WATER: 2, TREE: 3, FENCE: 4, HOUSE: 5, SOIL: 6, DECOR: 7 };
export const SOLID = new Set([T.WATER, T.TREE, T.FENCE, T.HOUSE]);

// Källkoordinater i farm_tiles.png (col,row) @16
const TILES = {
  grass: [3, 1],
  path: [5, 12],
  tilledDry: [1, 12],
  tilledWet: [6, 16],
  tuft: [[0, 0], [0, 1], [0, 2]],
  flower: [[1, 1], [1, 2]],
  reeds: [8, 9],
  water: { c: [3, 8], t: [3, 7], b: [3, 9], l: [2, 8], r: [4, 8], tl: [2, 7], tr: [4, 7], bl: [2, 9], br: [4, 9] },
};
// Källor i farm_objects.png (px x,y,w,h)
const OBJ = {
  tree: [[48, 0, 32, 64], [96, 0, 32, 64]],
  house: [0, 96, 80, 95],
  crate: [16, 64, 16, 16],
  fenceH: [16, 0, 16, 16],
  fenceV: [0, 16, 16, 16],
  decor: { tulip: [48, 64, 16, 16], white: [32, 64, 16, 16], rock: [32, 80, 16, 16], clover: [48, 80, 16, 16] },
};

// Grödor: row = rad i plants.png (kol 1-4 = 4 stadier, kol 0 = skörd-ikon)
export const CROPS = {
  morot:     { name: 'Morot',     emoji: '🥕', seed: 4,  sell: 9,  grow: 22, stages: 4, row: 1 },
  potatis:   { name: 'Potatis',   emoji: '🥔', seed: 5,  sell: 11, grow: 26, stages: 4, row: 2 },
  sallad:    { name: 'Sallad',    emoji: '🥬', seed: 6,  sell: 14, grow: 30, stages: 4, row: 5 },
  jordgubbe: { name: 'Jordgubbe', emoji: '🍓', seed: 8,  sell: 18, grow: 34, stages: 4, row: 3 },
  pumpa:     { name: 'Pumpa',     emoji: '🎃', seed: 10, sell: 26, grow: 45, stages: 4, row: 0 },
};
export const CROP_KEYS = Object.keys(CROPS);

export class World {
  constructor() {
    this.w = MAP_W; this.h = MAP_H;
    this.grid = new Uint8Array(this.w * this.h);
    this.plots = new Map();
    this.trees = [];
    this.decor = [];
    this.A = null;
    this._bake = null; this._bakeScale = 0;
    this.house = null; this.chest = null; this.shop = null; this.pen = null;
    this.spawn = { x: 0, y: 0 };
  }
  setAssets(A) { this.A = A; }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : T.WATER; }
  set(x, y, t) { if (this.inBounds(x, y)) this.grid[this.idx(x, y)] = t; }
  isSolid(x, y) { return !this.inBounds(x, y) ? true : SOLID.has(this.grid[this.idx(x, y)]); }

  // -- Kartgenerering (host) ---------------------------------------------
  generate() {
    const g = this.grid; g.fill(T.GRASS);
    this.trees = []; this.decor = [];
    let s = 20250723;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

    // Trädram runt kanten
    for (let x = 0; x < this.w; x++) { this.set(x, 0, T.TREE); this.set(x, this.h - 1, T.TREE); }
    for (let y = 0; y < this.h; y++) { this.set(0, y, T.TREE); this.set(this.w - 1, y, T.TREE); }

    // Rektangulär damm nere till vänster (fin autotile-kant)
    const px0 = 4, py0 = this.h - 9, pw = 9, ph = 6;
    for (let y = py0; y < py0 + ph; y++)
      for (let x = px0; x < px0 + pw; x++) this.set(x, y, T.WATER);

    // Hus uppe till vänster (5 breda, 4 djupa fotavtryck; taket ritas ovanför)
    const hx = 4, hy = 4, hw = 5, hh = 4;
    this.house = { x: hx, y: hy, w: hw, h: hh };
    for (let y = hy; y < hy + hh; y++)
      for (let x = hx; x < hx + hw; x++) this.set(x, y, T.HOUSE);

    // Grusgång från huset ut i mitten + horisontellt
    const doorX = hx + 2;
    for (let y = hy + hh; y < hy + hh + 5; y++) this.set(doorX, y, T.PATH);
    const midY = hy + hh + 4;
    for (let x = doorX; x < this.w - 9; x++) this.set(x, midY, T.PATH);

    // Sälj-låda + butik-låda vid gången
    this.chest = { x: doorX + 3, y: hy + hh + 1 };
    this.shop = { x: doorX - 2, y: hy + hh + 1 };

    // Djurhage uppe till höger (staket)
    const nx = this.w - 13, ny = 4, nw = 10, nh = 8;
    this.pen = { x: nx, y: ny, w: nw, h: nh };
    for (let x = nx; x < nx + nw; x++) { this.set(x, ny, T.FENCE); this.set(x, ny + nh - 1, T.FENCE); }
    for (let y = ny; y < ny + nh; y++) { this.set(nx, y, T.FENCE); this.set(nx + nw - 1, y, T.FENCE); }
    this.set(nx + Math.floor(nw / 2), ny + nh - 1, T.GRASS); // grind

    // Spridda träd + dekor på fältet
    for (let i = 0; i < 40; i++) {
      const x = 2 + Math.floor(rnd() * (this.w - 4));
      const y = 2 + Math.floor(rnd() * (this.h - 4));
      if (this.get(x, y) !== T.GRASS || this._nearImportant(x, y)) continue;
      const r = rnd();
      if (r < 0.4) { this.set(x, y, T.TREE); this.trees.push({ x, y, v: rnd() < 0.5 ? 0 : 1 }); }
      else if (r < 0.75) this.decor.push({ x, y, k: ['tulip', 'white', 'rock', 'clover'][(rnd() * 4) | 0] });
    }
    // se till att kant-träden har trädobjekt
    for (let x = 0; x < this.w; x++) { this.trees.push({ x, y: 0, v: 0 }); this.trees.push({ x, y: this.h - 1, v: 1 }); }
    for (let y = 1; y < this.h - 1; y++) { this.trees.push({ x: 0, y, v: 0 }); this.trees.push({ x: this.w - 1, y, v: 1 }); }

    this.spawn = { x: doorX, y: midY + 1 };
    this._bake = null;
  }
  _nearImportant(x, y) {
    const near = (o, pad) => o && x >= o.x - pad && x <= o.x + (o.w || 1) + pad && y >= o.y - pad && y <= o.y + (o.h || 1) + pad;
    return near(this.house, 2) || near(this.pen, 1) || near(this.chest, 1) || near(this.shop, 1);
  }

  // -- Odlingslogik -------------------------------------------------------
  till(x, y) {
    if (this.get(x, y) !== T.GRASS) return false;
    this.set(x, y, T.SOIL);
    this.plots.set(this.idx(x, y), { wet: false, cropType: null, stage: 0, grow: 0 });
    return true;
  }
  water(x, y) {
    const p = this.plots.get(this.idx(x, y));
    if (!p || this.get(x, y) !== T.SOIL || p.wet) return false;
    p.wet = true; return true;
  }
  plant(x, y, cropType) {
    const p = this.plots.get(this.idx(x, y));
    if (!p || this.get(x, y) !== T.SOIL || p.cropType || !CROPS[cropType]) return false;
    p.cropType = cropType; p.stage = 0; p.grow = 0; return true;
  }
  harvest(x, y) {
    const p = this.plots.get(this.idx(x, y));
    if (!p || !p.cropType) return 0;
    if (p.stage < CROPS[p.cropType].stages - 1) return 0;
    const yieldN = 1 + Math.floor(Math.random() * 2);
    const type = p.cropType;
    p.cropType = null; p.stage = 0; p.grow = 0;
    return { type, n: yieldN };
  }
  tick(dt) {
    const changed = [];
    for (const [i, p] of this.plots) {
      if (!p.cropType) continue;
      const def = CROPS[p.cropType];
      if (p.stage >= def.stages - 1) continue;
      p.grow += dt * (p.wet ? 1 : 0.5);
      if (p.grow >= def.grow) {
        p.grow = 0; p.stage++;
        if (p.wet && Math.random() < 0.6) p.wet = false;
        changed.push(i);
      }
    }
    return changed;
  }

  // -- Serialisering ------------------------------------------------------
  snapshot() {
    return { w: this.w, h: this.h, grid: Array.from(this.grid), plots: Array.from(this.plots.entries()),
      trees: this.trees, decor: this.decor, house: this.house, chest: this.chest, shop: this.shop, pen: this.pen, spawn: this.spawn };
  }
  applySnapshot(s) {
    this.w = s.w; this.h = s.h; this.grid = Uint8Array.from(s.grid); this.plots = new Map(s.plots);
    this.trees = s.trees || []; this.decor = s.decor || [];
    this.house = s.house; this.chest = s.chest; this.shop = s.shop; this.pen = s.pen; this.spawn = s.spawn;
    this._bake = null;
  }
  tileState(i) { return { i, t: this.grid[i], p: this.plots.get(i) || null }; }
  applyTile(d) { this.grid[d.i] = d.t; if (d.p) this.plots.set(d.i, d.p); else this.plots.delete(d.i); }

  // -- Vatten-autotile ----------------------------------------------------
  _waterCell(tx, ty) {
    const w = (x, y) => this.get(x, y) === T.WATER;
    const up = w(tx, ty - 1), dn = w(tx, ty + 1), le = w(tx - 1, ty), ri = w(tx + 1, ty);
    const W = TILES.water;
    if (!up && !le) return W.tl; if (!up && !ri) return W.tr;
    if (!dn && !le) return W.bl; if (!dn && !ri) return W.br;
    if (!up) return W.t; if (!dn) return W.b; if (!le) return W.l; if (!ri) return W.r;
    return W.c;
  }
  _hash(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff; }

  // -- Bake av statiskt marklager ----------------------------------------
  _bakeGround(scale) {
    const S = TILE * scale, img = this.A.img;
    const cv = document.createElement('canvas');
    cv.width = this.w * S; cv.height = this.h * S;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.grid[this.idx(x, y)];
        // grundgräs under allt
        blitCell(c, img.tiles, TILES.grass[0], TILES.grass[1], x * S, y * S, S);
        const r = this._hash(x, y);
        if (t === T.GRASS) {
          if (r > 0.86) { const tf = TILES.tuft[(r * TILES.tuft.length) | 0]; blitCell(c, img.tiles, tf[0], tf[1], x * S, y * S, S); }
          else if (r > 0.82) { const fl = TILES.flower[(r * TILES.flower.length) | 0]; blitCell(c, img.tiles, fl[0], fl[1], x * S, y * S, S); }
        } else if (t === T.PATH) {
          blitCell(c, img.tiles, TILES.path[0], TILES.path[1], x * S, y * S, S);
        } else if (t === T.WATER) {
          const wc = this._waterCell(x, y);
          blitCell(c, img.tiles, wc[0], wc[1], x * S, y * S, S);
        } else if (t === T.FENCE) {
          const horiz = this.get(x - 1, y) === T.FENCE || this.get(x + 1, y) === T.FENCE;
          const src = horiz ? OBJ.fenceH : OBJ.fenceV;
          blit(c, img.objects, src[0], src[1], src[2], src[3], x * S, y * S, S, S);
        }
      }
    }
    // dekor (blommor/stenar) ovanpå gräset
    for (const d of this.decor) {
      const src = OBJ.decor[d.k]; if (!src) continue;
      blit(c, img.objects, src[0], src[1], src[2], src[3], d.x * S, d.y * S, S, S);
    }
    this._bake = cv; this._bakeScale = scale;
  }
  getBake(scale) { if (!this._bake || this._bakeScale !== scale) this._bakeGround(scale); return this._bake; }

  // -- Dynamiska rutor: uppluckrad jord + gröda --------------------------
  drawPlot(ctx, tx, ty, px, py, S) {
    if (this.get(tx, ty) !== T.SOIL) return;
    const p = this.plots.get(this.idx(tx, ty));
    const src = p && p.wet ? TILES.tilledWet : TILES.tilledDry;
    blitCell(ctx, this.A.img.tiles, src[0], src[1], px, py, S);
    if (p && p.cropType) {
      const def = CROPS[p.cropType];
      const col = 1 + Math.min(p.stage, def.stages - 1);   // kol 1-4
      blitCell(ctx, this.A.img.plants, col, def.row, px, py, S);
    }
  }

  // -- Objekt (ritas i entitetspasset, djup-sorterade) -------------------
  drawTree(ctx, tx, ty, camX, camY, S) {
    const src = OBJ.tree[tx % 2] || OBJ.tree[0];
    const dw = 2 * S, dh = (src[3] / TILE) * S;   // 2 rutor breda
    const dx = tx * S - camX + (S - dw) / 2 + S * 0.5;
    const dy = (ty + 1) * S - camY - dh;          // fot vid rutans nederkant
    blit(ctx, this.A.img.objects, src[0], src[1], src[2], src[3], dx - S * 0.5, dy, dw, dh);
  }
  drawHouse(ctx, camX, camY, S) {
    const h = this.house, src = OBJ.house;
    const dw = h.w * S, dh = (src[3] / TILE) * S;
    const dx = h.x * S - camX;
    const dy = (h.y + h.h) * S - camY - dh;
    blit(ctx, this.A.img.objects, src[0], src[1], src[2], src[3], dx, dy, dw, dh);
  }
  drawCrate(ctx, px, py, S) {
    const s = OBJ.crate; blit(ctx, this.A.img.objects, s[0], s[1], s[2], s[3], px, py, S, S);
  }
}
