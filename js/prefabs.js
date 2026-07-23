// DRÖMGÅRDEN — färdiga byggbitar (prefabs) + färdiga mysiga kartor.
// En prefab stämplar flera tiles/objekt/djur på en gång så man bygger snabbt.

// -- Låg-nivå hjälpare (koordinater matchar farm_tiles/farm_objects) -----
const F_H = ['farm_objects', 1, 0];   // staket horisontellt
const F_V = ['farm_objects', 0, 1];   // staket vertikalt
const DEC = { tulip: [3, 4], white: [2, 4], rock: [2, 5], clover: [3, 5], hay: [4, 4], hay2: [4, 5] };

function fence(w, x, y, horiz) { w.setGround(x, y, horiz ? F_H : F_V); w.setSolid(x, y, 1); w.setFarm(x, y, 0); }
function dirt(w, x, y) { w.setGround(x, y, ['farm_tiles', 6, 16]); w.setFarm(x, y, 0); }
function decor(w, x, y, key) { const c = DEC[key]; if (c) w.setGround(x, y, ['farm_objects', c[0], c[1]]); }
function tree(w, x, y) { w.addObject({ img: 'farm_objects', sx: 48, sy: 0, sw: 32, sh: 60, tx: x, ty: y, fw: 1, fh: 1 }); w.setFarm(x, y, 0); }
function bush(w, x, y) { w.addObject({ img: 'forest_spring', sx: 0, sy: 80, sw: 32, sh: 48, tx: x, ty: y, fw: 1, fh: 1 }); w.setFarm(x, y, 0); }
function fenceRect(w, ox, oy, fw, fh, gateX) {
  for (let x = ox; x < ox + fw; x++) { fence(w, x, oy, true); fence(w, x, oy + fh - 1, true); }
  for (let y = oy; y < oy + fh; y++) { fence(w, ox, y, false); fence(w, ox + fw - 1, y, false); }
  if (gateX != null) w.clearCell(ox + gateX, oy + fh - 1);   // grind i nedre staketet
}

// -- Prefab-definitioner ------------------------------------------------
export const PREFABS = [
  { key: 'house', name: 'Torp', emoji: '🏠', w: 5, h: 7, stamp(w, ox, oy) {
    w.addObject({ img: 'farm_objects', sx: 0, sy: 96, sw: 80, sh: 95, tx: ox, ty: oy, fw: 5, fh: 4 });
    for (let y = oy; y < oy + 4; y++) for (let x = ox; x < ox + 5; x++) w.setFarm(x, y, 0);
    for (let y = oy + 4; y < oy + 7; y++) dirt(w, ox + 2, y);   // jordgång från dörren
  } },
  { key: 'field', name: 'Åker + staket', emoji: '🌾', w: 7, h: 6, stamp(w, ox, oy) {
    fenceRect(w, ox, oy, 7, 6, 3);
    const crops = ['sallad', 'morot', 'potatis', 'jordgubbe'];
    for (let y = oy + 1; y < oy + 5; y++) for (let x = ox + 1; x < ox + 6; x++) {
      w.setFarm(x, y, 1); w.plot(x, y, crops[(x - ox - 1) % crops.length], 2, true);
    }
  } },
  { key: 'emptyfield', name: 'Tom åker', emoji: '🟫', w: 6, h: 5, stamp(w, ox, oy) {
    fenceRect(w, ox, oy, 6, 5, 2);
    for (let y = oy + 1; y < oy + 4; y++) for (let x = ox + 1; x < ox + 5; x++) { w.setFarm(x, y, 1); w.plot(x, y, null, 0, false); }
  } },
  { key: 'pen', name: 'Djurgård', emoji: '🐄', w: 8, h: 7, stamp(w, ox, oy) {
    fenceRect(w, ox, oy, 8, 7, 3);
    for (let y = oy + 1; y < oy + 6; y++) for (let x = ox + 1; x < ox + 7; x++) dirt(w, x, y);
    decor(w, ox + 1, oy + 1, 'hay'); decor(w, ox + 6, oy + 1, 'hay2');
    decor(w, ox + 6, oy + 5, 'white'); decor(w, ox + 1, oy + 5, 'rock');
    w.animalSpawns.push({ type: 'chicken', x: ox + 3, y: oy + 3 }, { type: 'chicken', x: ox + 5, y: oy + 4 }, { type: 'cow', x: ox + 4, y: oy + 2.5 });
  } },
  { key: 'pond', name: 'Damm', emoji: '💧', w: 6, h: 4, stamp(w, ox, oy) {
    for (let y = oy; y < oy + 4; y++) for (let x = ox; x < ox + 6; x++) { w.setSolid(x, y, 1); w.setFarm(x, y, 0); w.setGround(x, y, w.waterCell(x, y, ox, oy, 6, 4)); }
  } },
  { key: 'flowers', name: 'Blomrabatt', emoji: '🌷', w: 4, h: 2, stamp(w, ox, oy) {
    const f = ['tulip', 'white', 'clover']; for (let y = oy; y < oy + 2; y++) for (let x = ox; x < ox + 4; x++) decor(w, x, y, f[(x + y) % 3]);
  } },
  { key: 'grove', name: 'Träddunge', emoji: '🌳', w: 5, h: 4, stamp(w, ox, oy) {
    tree(w, ox, oy + 1); tree(w, ox + 2, oy); tree(w, ox + 4, oy + 1); bush(w, ox + 1, oy + 3); bush(w, ox + 3, oy + 3);
  } },
  { key: 'stones', name: 'Stenar', emoji: '🪨', w: 3, h: 2, stamp(w, ox, oy) {
    decor(w, ox, oy, 'rock'); decor(w, ox + 2, oy + 1, 'rock'); decor(w, ox + 1, oy, 'white');
  } },
];
export const PREFAB_BY_KEY = Object.fromEntries(PREFABS.map((p) => [p.key, p]));

// -- Gräsdetalj + kant -------------------------------------------------
function grassDetail(w) {
  for (let y = 1; y < w.h - 1; y++) for (let x = 1; x < w.w - 1; x++) {
    if (w.ground[w.idx(x, y)] || w.solid[w.idx(x, y)]) continue;
    const r = w._hash(x, y);
    if (r > 0.9) w.setGround(x, y, ['farm_tiles', 0, [0, 1, 2][(r * 3) | 0]]);
    else if (r > 0.85) w.setGround(x, y, ['farm_tiles', 1, [1, 2][(r * 2) | 0]]);
  }
}
function treeBorder(w) {
  for (let x = 0; x < w.w; x++) { tree(w, x, 0); tree(w, x, w.h - 1); }
  for (let y = 1; y < w.h - 1; y++) { tree(w, 0, y); tree(w, w.w - 1, y); }
}

// -- Färdiga mysiga kartor ----------------------------------------------
function buildCozyFarm(w) {
  w.w = 46; w.h = 34; w._alloc();
  for (let y = 1; y < w.h - 1; y++) for (let x = 1; x < w.w - 1; x++) w.setFarm(x, y, 1);
  treeBorder(w);
  PREFAB_BY_KEY.house.stamp(w, 3, 3);
  w.shop = { x: 3, y: 10 }; w.chest = { x: 7, y: 10 };
  PREFAB_BY_KEY.pen.stamp(w, 34, 3);
  PREFAB_BY_KEY.field.stamp(w, 9, 15);
  PREFAB_BY_KEY.field.stamp(w, 19, 15);
  PREFAB_BY_KEY.emptyfield.stamp(w, 29, 16);
  PREFAB_BY_KEY.pond.stamp(w, 4, 26);
  PREFAB_BY_KEY.flowers.stamp(w, 15, 11);
  PREFAB_BY_KEY.grove.stamp(w, 30, 25);
  PREFAB_BY_KEY.stones.stamp(w, 12, 24);
  decor(w, 6, 13, 'tulip'); decor(w, 40, 26, 'white'); decor(w, 24, 27, 'clover');
  grassDetail(w);
  w.spawn = { x: 5, y: 12 };
  w._bake = null;
}
function buildMeadow(w) {
  w.w = 40; w.h = 28; w._alloc();
  for (let y = 1; y < w.h - 1; y++) for (let x = 1; x < w.w - 1; x++) w.setFarm(x, y, 1);
  treeBorder(w);
  PREFAB_BY_KEY.house.stamp(w, 16, 3);
  w.shop = { x: 15, y: 10 }; w.chest = { x: 21, y: 10 };
  PREFAB_BY_KEY.pond.stamp(w, 4, 4);
  PREFAB_BY_KEY.emptyfield.stamp(w, 5, 15);
  PREFAB_BY_KEY.emptyfield.stamp(w, 13, 15);
  PREFAB_BY_KEY.pen.stamp(w, 27, 15);
  PREFAB_BY_KEY.flowers.stamp(w, 12, 11);
  PREFAB_BY_KEY.grove.stamp(w, 4, 22);
  grassDetail(w);
  w.spawn = { x: 18, y: 12 };
  w._bake = null;
}
export const MAPS = {
  cozy: { name: 'Mysgården', build: buildCozyFarm },
  meadow: { name: 'Ängsgården', build: buildMeadow },
};

// -- Egna bitar: fånga en region + stämpla ------------------------------
export function captureRegion(w, x0, y0, x1, y1) {
  const cells = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = w.idx(x, y), g = w.ground[i], solid = w.solid[i], farm = w.farm[i], p = w.plots.get(i);
    if (g || solid || farm || p) cells.push({ dx: x - x0, dy: y - y0, g: g || null, solid, farm, plot: p || null });
  }
  const objects = w.objects.filter((o) => o.tx + o.fw > x0 && o.tx <= x1 && o.ty + o.fh > y0 && o.ty <= y1)
    .map((o) => ({ ...o, dx: o.tx - x0, dy: o.ty - y0 }));
  const animals = w.animalSpawns.filter((a) => a.x >= x0 && a.x <= x1 + 1 && a.y >= y0 && a.y <= y1 + 1)
    .map((a) => ({ type: a.type, dx: a.x - x0, dy: a.y - y0 }));
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, cells, objects, animals };
}
export function stampData(w, d, ox, oy) {
  for (const c of d.cells) {
    const x = ox + c.dx, y = oy + c.dy;
    if (c.g) w.setGround(x, y, c.g);
    if (c.solid) w.setSolid(x, y, 1);
    if (c.farm) w.setFarm(x, y, 1);
    if (c.plot) w.plots.set(w.idx(x, y), { ...c.plot });
  }
  for (const o of d.objects) w.addObject({ img: o.img, sx: o.sx, sy: o.sy, sw: o.sw, sh: o.sh, tx: ox + o.dx, ty: oy + o.dy, fw: o.fw, fh: o.fh });
  for (const a of d.animals) w.animalSpawns.push({ type: a.type, x: ox + a.dx, y: oy + a.dy });
  w._bake = null;
}
