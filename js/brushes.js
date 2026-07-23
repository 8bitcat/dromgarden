// DRÖMGÅRDEN — palett för kartbyggaren. Skär varje sprite-ark i 16×16-celler
// (hoppar över helt tomma celler) och lägger till några stora objekt-"stämplar".
export const TS = 16;

// Alla ark som blir målbara mark-celler, grupperade i kategorier.
const SHEETS = [
  { key: 'farm_tiles', cat: '🌱 Gräs & mark' },
  { key: 'farm_bridges', cat: '🌉 Broar & golv' },
  { key: 'plants', cat: '🌾 Växter' },
  { key: 'farm_objects', cat: '🏡 Farm-objekt' },
  { key: 'farm_items', cat: '📦 Saker' },
  { key: 'farm_furniture', cat: '🪑 Möbler' },
  { key: 'farm_inside', cat: '🏠 Inomhus' },
  { key: 'forest_spring', cat: '🌳 Skog vår' },
  { key: 'forest_summer', cat: '☀️ Skog sommar' },
  { key: 'forest_autumn', cat: '🍂 Skog höst' },
  { key: 'forest_winter', cat: '❄️ Skog vinter' },
  { key: 'forest_objects', cat: '🪵 Skog-objekt' },
  { key: 'forest_items_spring', cat: '🌼 Skog-saker' },
  { key: 'forest_items_autumn', cat: '🍁 Höst-saker' },
  { key: 'forest_items_winter', cat: '⛄ Vinter-saker' },
  { key: 'forest_furniture', cat: '🛋️ Skog-möbler' },
  { key: 'forest_bridges', cat: '🌁 Skog-broar' },
  { key: 'forest_inside', cat: '🚪 Skog inomhus' },
];

// Stora objekt (ritas ovanpå, spelaren går bakom). foot = kollisions-fotavtryck.
export const STAMPS = [
  { name: 'Träd', img: 'farm_objects', sx: 48, sy: 0, sw: 32, sh: 80, fw: 1, fh: 1 },
  { name: 'Träd 2', img: 'farm_objects', sx: 96, sy: 0, sw: 32, sh: 80, fw: 1, fh: 1 },
  { name: 'Hus', img: 'farm_objects', sx: 0, sy: 96, sw: 80, sh: 95, fw: 5, fh: 4 },
];

function nonEmptyCells(img) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
  const cols = Math.floor(img.width / TS), rows = Math.floor(img.height / TS);
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const d = c.getImageData(col * TS, r * TS, TS, TS).data;
      let any = false;
      for (let i = 3; i < d.length; i += 4) { if (d[i] > 12) { any = true; break; } }
      if (any) out.push([col, r]);
    }
  }
  return out;
}

// Bygg palettkategorier från laddade bilder. Returnerar [{cat, brushes:[...]}].
export function buildPalette(assets) {
  const cats = [];
  // Objekt-stämplar först
  cats.push({ cat: '🌳 Stora objekt', brushes: STAMPS.map((s) => ({ kind: 'stamp', ...s })) });
  for (const sh of SHEETS) {
    const img = assets.img[sh.key];
    if (!img) continue;
    const cells = nonEmptyCells(img);
    if (!cells.length) continue;
    const brushes = cells.map(([col, r]) => ({ kind: 'cell', img: sh.key, sx: col * TS, sy: r * TS, sw: TS, sh: TS, col, row: r }));
    cats.push({ cat: sh.cat, brushes });
  }
  return cats;
}
