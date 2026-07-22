// DRÖMGÅRDEN — världen: rutnät, tiles, grödor, kartgenerering och rendering.
// Marken och grödorna ritas procedurellt i mjuk pastellstil (matchar Little Dreamyland),
// medan spelare/djur använder de riktiga sprite-arken (se assets.js).

export const TILE = 16;              // baspixlar per ruta (skalas upp vid rendering)
export const MAP_W = 44;             // kartans bredd i rutor
export const MAP_H = 34;             // kartans höjd i rutor

// Tile-typer
export const T = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  TREE: 3,
  FENCE: 4,
  HOUSE: 5,
  SOIL: 6,     // uppluckrad jord (odlingsbar)
  FLOWER: 7,   // dekor på gräs (gångbar)
  SAND: 8,     // strandkant runt vatten
};

// Vilka tiles man INTE kan gå igenom
export const SOLID = new Set([T.WATER, T.TREE, T.FENCE, T.HOUSE]);

// ---- Grödor -------------------------------------------------------------
// growTime = sekunder per mognadssteg när ruta är vattnad. Torr jord = dubbelt så långsamt.
export const CROPS = {
  morot:      { name: 'Morot',     emoji: '🥕', seed: 4,  sell: 9,  grow: 22, stages: 4, leaf: '#4caf50', fruit: '#ef8c34' },
  kal:        { name: 'Kål',       emoji: '🥬', seed: 6,  sell: 14, grow: 30, stages: 4, leaf: '#66bb44', fruit: '#9ccc65' },
  pumpa:      { name: 'Pumpa',     emoji: '🎃', seed: 10, sell: 26, grow: 45, stages: 4, leaf: '#4caf50', fruit: '#f0821e' },
  jordgubbe:  { name: 'Jordgubbe', emoji: '🍓', seed: 8,  sell: 18, grow: 34, stages: 4, leaf: '#4caf50', fruit: '#e53950' },
  vete:       { name: 'Vete',      emoji: '🌾', seed: 3,  sell: 7,  grow: 20, stages: 4, leaf: '#8fae4a', fruit: '#e8c65a' },
};
export const CROP_KEYS = Object.keys(CROPS);

// ---- Världsklass --------------------------------------------------------
export class World {
  constructor() {
    this.w = MAP_W;
    this.h = MAP_H;
    this.grid = new Uint8Array(this.w * this.h);
    this.plots = new Map();   // index -> { wet, cropType, stage, grow }
    this.decorSeed = 1337;    // för stabil dekor-rendering
    this._bake = null;        // offscreen canvas med statiskt marklager
    this._bakeScale = 0;
    // Viktiga platser (sätts i generate)
    this.house = null;        // {x,y,w,h}
    this.chest = null;        // {x,y} shipping bin
    this.shop = null;         // {x,y} butiksskylt
    this.pen = null;          // {x,y,w,h} djurhage
    this.spawn = { x: 0, y: 0 };
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : T.WATER; }
  set(x, y, t) { if (this.inBounds(x, y)) this.grid[this.idx(x, y)] = t; }

  isSolid(x, y) {
    if (!this.inBounds(x, y)) return true;
    return SOLID.has(this.grid[this.idx(x, y)]);
  }

  // -- Kartgenerering (körs på host) --------------------------------------
  generate() {
    const g = this.grid;
    g.fill(T.GRASS);

    // Ram av träd runt kanten
    for (let x = 0; x < this.w; x++) {
      this.set(x, 0, T.TREE); this.set(x, this.h - 1, T.TREE);
    }
    for (let y = 0; y < this.h; y++) {
      this.set(0, y, T.TREE); this.set(this.w - 1, y, T.TREE);
    }

    // Damm nere till vänster (oval)
    const pcx = 9, pcy = this.h - 8, prx = 6, pry = 4;
    for (let y = 1; y < this.h - 1; y++) {
      for (let x = 1; x < this.w - 1; x++) {
        const dx = (x - pcx) / prx, dy = (y - pcy) / pry;
        const d = dx * dx + dy * dy;
        if (d < 1) this.set(x, y, T.WATER);
        else if (d < 1.4) { if (this.get(x, y) === T.GRASS) this.set(x, y, T.SAND); }
      }
    }

    // Hus uppe till vänster
    const hx = 4, hy = 3, hw = 6, hh = 4;
    this.house = { x: hx, y: hy, w: hw, h: hh };
    for (let y = hy; y < hy + hh; y++)
      for (let x = hx; x < hx + hw; x++) this.set(x, y, T.HOUSE);

    // Grusgång från husets dörr och ut i mitten
    const doorX = hx + Math.floor(hw / 2);
    for (let y = hy + hh; y < hy + hh + 6; y++) this.set(doorX, y, T.PATH);
    const midY = hy + hh + 5;
    for (let x = doorX; x < this.w - 8; x++) this.set(x, midY, T.PATH);

    // Shipping-kista (chest) precis utanför dörren
    this.chest = { x: doorX + 2, y: hy + hh + 1 };
    // Butiksskylt bredvid kistan
    this.shop = { x: doorX - 2, y: hy + hh + 1 };

    // Djurhage uppe till höger (staket)
    const px = this.w - 13, py = 3, pw = 10, ph = 8;
    this.pen = { x: px, y: py, w: pw, h: ph };
    for (let x = px; x < px + pw; x++) { this.set(x, py, T.FENCE); this.set(x, py + ph - 1, T.FENCE); }
    for (let y = py; y < py + ph; y++) { this.set(px, y, T.FENCE); this.set(px + pw - 1, y, T.FENCE); }
    // Grind (öppning) i nedre staketet
    this.set(px + Math.floor(pw / 2), py + ph - 1, T.GRASS);

    // Spridda dekorträd och blommor på fältet (deterministiskt)
    let s = 20250723;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < 60; i++) {
      const x = 2 + Math.floor(rnd() * (this.w - 4));
      const y = 2 + Math.floor(rnd() * (this.h - 4));
      if (this.get(x, y) !== T.GRASS) continue;
      if (this._nearImportant(x, y)) continue;
      const r = rnd();
      if (r < 0.28) this.set(x, y, T.TREE);
      else if (r < 0.55) this.set(x, y, T.FLOWER);
    }

    // Startruta: mitt på gången
    this.spawn = { x: doorX, y: midY + 1 };
    this._bake = null;
  }

  _nearImportant(x, y) {
    const near = (o, pad) => o && x >= o.x - pad && x <= o.x + (o.w || 1) + pad && y >= o.y - pad && y <= o.y + (o.h || 1) + pad;
    return near(this.house, 2) || near(this.pen, 1) || near(this.chest, 1) || near(this.shop, 1);
  }

  hittFriRuta() {
    // hitta en gångbar ruta nära spawn
    return { x: this.spawn.x, y: this.spawn.y };
  }

  // -- Odlingslogik -------------------------------------------------------
  till(x, y) {
    if (this.get(x, y) !== T.GRASS && this.get(x, y) !== T.FLOWER) return false;
    this.set(x, y, T.SOIL);
    this.plots.set(this.idx(x, y), { wet: false, cropType: null, stage: 0, grow: 0 });
    return true;
  }
  water(x, y) {
    const p = this.plots.get(this.idx(x, y));
    if (!p || this.get(x, y) !== T.SOIL) return false;
    if (p.wet) return false;
    p.wet = true;
    return true;
  }
  plant(x, y, cropType) {
    const p = this.plots.get(this.idx(x, y));
    if (!p || this.get(x, y) !== T.SOIL || p.cropType) return false;
    if (!CROPS[cropType]) return false;
    p.cropType = cropType; p.stage = 0; p.grow = 0;
    return true;
  }
  // Returnerar antal skörd (0 = misslyckat)
  harvest(x, y) {
    const i = this.idx(x, y);
    const p = this.plots.get(i);
    if (!p || !p.cropType) return 0;
    const def = CROPS[p.cropType];
    if (p.stage < def.stages - 1) return 0; // ej mogen
    const yieldN = 1 + Math.floor(Math.random() * 2); // 1-2
    const type = p.cropType;
    p.cropType = null; p.stage = 0; p.grow = 0; // jorden blir tom igen (men fortsatt uppluckrad)
    return { type, n: yieldN };
  }

  // Host: avancera grödor. dt i sekunder. Returnerar lista med ändrade index (för nät-delta).
  tick(dt) {
    const changed = [];
    for (const [i, p] of this.plots) {
      if (!p.cropType) continue;
      const def = CROPS[p.cropType];
      if (p.stage >= def.stages - 1) continue;
      const rate = p.wet ? 1 : 0.5;
      p.grow += dt * rate;
      const need = def.grow;
      if (p.grow >= need) {
        p.grow = 0;
        p.stage++;
        if (p.wet && Math.random() < 0.6) p.wet = false; // torkar ibland
        changed.push(i);
      }
    }
    return changed;
  }

  // -- Serialisering för nät ---------------------------------------------
  snapshot() {
    return {
      w: this.w, h: this.h,
      grid: Array.from(this.grid),
      plots: Array.from(this.plots.entries()),
      house: this.house, chest: this.chest, shop: this.shop, pen: this.pen, spawn: this.spawn,
    };
  }
  applySnapshot(s) {
    this.w = s.w; this.h = s.h;
    this.grid = Uint8Array.from(s.grid);
    this.plots = new Map(s.plots);
    this.house = s.house; this.chest = s.chest; this.shop = s.shop; this.pen = s.pen; this.spawn = s.spawn;
    this._bake = null;
  }
  // Delta för en enskild ruta (skickas när något ändras)
  tileState(i) {
    return { i, t: this.grid[i], p: this.plots.get(i) || null };
  }
  applyTile(d) {
    this.grid[d.i] = d.t;
    if (d.p) this.plots.set(d.i, d.p);
    else this.plots.delete(d.i);
    // om själva marktypen (t.ex. träd) ändras måste bakemap ritas om
  }

  // -- Rendering av statiskt marklager (bakas en gång) --------------------
  _bakeGround(scale) {
    const S = TILE * scale;
    const cv = document.createElement('canvas');
    cv.width = this.w * S; cv.height = this.h * S;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        this._drawStaticTile(c, x, y, x * S, y * S, S);
      }
    }
    this._bake = cv; this._bakeScale = scale;
  }
  getBake(scale) {
    if (!this._bake || this._bakeScale !== scale) this._bakeGround(scale);
    return this._bake;
  }
  invalidateBake() { this._bake = null; }

  _hash(x, y) {
    let h = (x * 374761393 + y * 668265263) ^ this.decorSeed;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
  }

  _drawStaticTile(c, tx, ty, px, py, S) {
    const t = this.grid[this.idx(tx, ty)];
    const r = this._hash(tx, ty);
    // grundgräs under allt (så kanter smälter in)
    this._grass(c, px, py, S, r);
    if (t === T.WATER) this._water(c, px, py, S, tx, ty);
    else if (t === T.SAND) this._sand(c, px, py, S, r);
    else if (t === T.PATH) this._path(c, px, py, S, r);
    else if (t === T.FENCE) this._fence(c, px, py, S, tx, ty);
    else if (t === T.HOUSE) this._house(c, px, py, S, tx, ty);
    else if (t === T.TREE) { this._grass(c, px, py, S, r); this._tree(c, px, py, S, r); }
    else if (t === T.FLOWER) this._flower(c, px, py, S, r);
    // SOIL ritas dynamiskt (kan bli vått) — inte i bake
  }

  _grass(c, px, py, S, r) {
    c.fillStyle = r < 0.5 ? '#8ec654' : '#86c04c';
    c.fillRect(px, py, S, S);
    // små grässtrån
    c.fillStyle = 'rgba(120,180,70,0.55)';
    const n = 3;
    for (let i = 0; i < n; i++) {
      const hx = ((this._hash(px + i * 7, py + i * 3) * S) | 0);
      const hy = ((this._hash(px * 2 + i, py + i) * S) | 0);
      c.fillRect(px + hx, py + hy, Math.max(1, S / 16), Math.max(1, S / 8));
    }
    if (r > 0.92) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(px, py, S, S / 6); }
  }
  _sand(c, px, py, S) {
    c.fillStyle = '#e6d3a3'; c.fillRect(px + S * 0.05, py + S * 0.05, S * 0.9, S * 0.9);
    c.fillStyle = 'rgba(210,185,130,0.6)'; c.fillRect(px + S * 0.2, py + S * 0.5, S * 0.3, S * 0.15);
  }
  _water(c, px, py, S, tx, ty) {
    c.fillStyle = '#5bc0e6'; c.fillRect(px, py, S, S);
    c.fillStyle = '#4bb0dc'; c.fillRect(px, py + S * 0.55, S, S * 0.45);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    const hx = (this._hash(tx, ty) * S * 0.5) | 0;
    c.fillRect(px + hx, py + S * 0.3, S * 0.3, Math.max(1, S / 12));
  }
  _path(c, px, py, S, r) {
    c.fillStyle = '#d9b483'; c.fillRect(px, py, S, S);
    c.fillStyle = 'rgba(180,140,95,0.55)';
    for (let i = 0; i < 4; i++) {
      const a = this._hash(px + i, py * 2 + i);
      const b = this._hash(px * 3 + i, py + i);
      c.fillRect(px + (a * S) | 0, py + (b * S) | 0, Math.max(1, S / 10), Math.max(1, S / 10));
    }
  }
  _fence(c, px, py, S) {
    // gräs redan ritat; rita brun stolpe + ribbor
    c.fillStyle = '#9a6b3c';
    c.fillRect(px + S * 0.12, py + S * 0.15, S * 0.16, S * 0.75);
    c.fillRect(px + S * 0.72, py + S * 0.15, S * 0.16, S * 0.75);
    c.fillStyle = '#b3814f';
    c.fillRect(px, py + S * 0.32, S, S * 0.12);
    c.fillRect(px, py + S * 0.62, S, S * 0.12);
  }
  _house(c, px, py, S, tx, ty) {
    const h = this.house;
    const relx = tx - h.x, rely = ty - h.y;
    const roof = rely < 2;
    if (roof) {
      c.fillStyle = rely === 0 ? '#c1476b' : '#d65c80';
      c.fillRect(px, py, S, S);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(px, py + S * 0.8, S, S * 0.2);
      if (rely === 0) { c.fillStyle = '#e5799a'; c.fillRect(px, py, S, S * 0.25); }
    } else {
      c.fillStyle = '#f2e2c4'; c.fillRect(px, py, S, S);
      c.fillStyle = 'rgba(180,150,110,0.4)';
      c.fillRect(px, py, S, Math.max(1, S / 12));
      // dörr mitt i nedersta raden
      const doorRel = Math.floor(h.w / 2);
      if (rely === h.h - 1 && relx === doorRel) {
        c.fillStyle = '#8a5a34'; c.fillRect(px + S * 0.2, py + S * 0.15, S * 0.6, S * 0.85);
        c.fillStyle = '#ffd76a'; c.fillRect(px + S * 0.62, py + S * 0.5, S * 0.08, S * 0.1);
      } else if (rely === h.h - 2 && (relx === 1 || relx === h.w - 2)) {
        // fönster
        c.fillStyle = '#7ec8e6'; c.fillRect(px + S * 0.25, py + S * 0.25, S * 0.5, S * 0.5);
        c.fillStyle = '#f2e2c4'; c.fillRect(px + S * 0.47, py + S * 0.25, S * 0.06, S * 0.5);
      }
    }
  }
  _tree(c, px, py, S, r) {
    // stam
    c.fillStyle = '#8a5a34';
    c.fillRect(px + S * 0.42, py + S * 0.55, S * 0.16, S * 0.4);
    // krona (två toner)
    const cx = px + S * 0.5, cy = py + S * 0.42, rad = S * 0.42;
    c.fillStyle = r < 0.5 ? '#4e9e3e' : '#57a844';
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.beginPath(); c.arc(cx - S * 0.12, cy - S * 0.12, rad * 0.55, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.10)';
    c.beginPath(); c.arc(cx + S * 0.14, cy + S * 0.16, rad * 0.5, 0, Math.PI * 2); c.fill();
  }
  _flower(c, px, py, S, r) {
    const cols = ['#ff6f91', '#ffd166', '#c78bff', '#ff9f68'];
    const col = cols[(r * cols.length) | 0];
    const cx = px + S * (0.35 + r * 0.3), cy = py + S * 0.55;
    c.fillStyle = '#4caf50'; c.fillRect(cx - 1, cy, Math.max(1, S / 14), S * 0.3);
    c.fillStyle = col;
    const pr = S * 0.1;
    for (let a = 0; a < 4; a++) {
      const ang = a * Math.PI / 2;
      c.beginPath(); c.arc(cx + Math.cos(ang) * pr, cy - S * 0.05 + Math.sin(ang) * pr, pr, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(cx, cy - S * 0.05, pr * 0.6, 0, Math.PI * 2); c.fill();
  }

  // -- Dynamisk ruta (jord + gröda) ritas varje frame ovanpå bake ---------
  drawPlot(c, tx, ty, px, py, S) {
    if (this.get(tx, ty) !== T.SOIL) return;
    const p = this.plots.get(this.idx(tx, ty));
    // jord
    c.fillStyle = p && p.wet ? '#6b4a2f' : '#9a6b42';
    c.fillRect(px + S * 0.04, py + S * 0.04, S * 0.92, S * 0.92);
    // fåror
    c.fillStyle = p && p.wet ? '#5a3d27' : '#875c38';
    c.fillRect(px + S * 0.1, py + S * 0.2, S * 0.8, Math.max(1, S / 12));
    c.fillRect(px + S * 0.1, py + S * 0.5, S * 0.8, Math.max(1, S / 12));
    c.fillRect(px + S * 0.1, py + S * 0.78, S * 0.8, Math.max(1, S / 12));
    if (p && p.cropType) this._drawCrop(c, px, py, S, p);
  }

  _drawCrop(c, px, py, S, p) {
    const def = CROPS[p.cropType];
    const frac = (p.stage + (def.stages > 1 ? p.grow / def.grow : 0)) / (def.stages - 1);
    const t = Math.min(1, frac);
    const cx = px + S * 0.5, base = py + S * 0.82;
    const mature = p.stage >= def.stages - 1;

    if (p.stage === 0) {
      // groddar
      c.fillStyle = def.leaf;
      c.fillRect(cx - S * 0.04, base - S * 0.22, S * 0.08, S * 0.22);
      c.fillRect(cx - S * 0.16, base - S * 0.16, S * 0.1, S * 0.06);
      c.fillRect(cx + S * 0.06, base - S * 0.16, S * 0.1, S * 0.06);
      return;
    }

    // bladverk skalar med tillväxt
    const H = S * (0.25 + 0.4 * t);
    c.fillStyle = def.leaf;
    c.fillRect(cx - S * 0.14, base - H, S * 0.28, H);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(cx - S * 0.14, base - H, S * 0.1, H);

    if (mature) {
      // frukt/knopp per grödtyp
      c.fillStyle = def.fruit;
      if (p.cropType === 'morot') {
        c.fillRect(cx - S * 0.08, base - S * 0.1, S * 0.16, S * 0.22);
      } else if (p.cropType === 'pumpa' || p.cropType === 'kal') {
        c.beginPath(); c.arc(cx, base - S * 0.12, S * 0.2, 0, Math.PI * 2); c.fill();
      } else if (p.cropType === 'jordgubbe') {
        c.beginPath(); c.arc(cx - S * 0.1, base - H * 0.4, S * 0.07, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(cx + S * 0.1, base - H * 0.6, S * 0.07, 0, Math.PI * 2); c.fill();
      } else { // vete
        c.fillRect(cx - S * 0.16, base - H - S * 0.06, S * 0.32, S * 0.14);
      }
      // liten glans så mogna grödor sticker ut
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(cx + S * 0.02, base - S * 0.14, Math.max(1, S / 12), Math.max(1, S / 12));
    }
  }
}
