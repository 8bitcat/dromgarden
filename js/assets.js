// DRÖMGÅRDEN — laddning och ritning av Tiny Wonder Farm-grafik.
// Karaktär: 24×24 px/frame, rad 0 = idle (4 frames, framåtvänd), rad 1 = gång (8 frames).
// Fri-versionen har bara framåtvy → vi speglar horisontellt för höger/vänster-känsla.
// Djur (ko/höns) kommer från Little Dreamyland-arken: 48×48, 4 rader (upp/höger/vänster/ner).

export const CFRAME = 24;       // karaktärsruta
export const AFRAME = 48;       // djurruta
export const TS = 16;           // tileset-ruta
export const DIR = { UP: 0, RIGHT: 1, LEFT: 2, DOWN: 3 };

export const CHAR = {
  idle: { row: 0, frames: 4, fps: 5 },
  walk: { row: 1, frames: 8, fps: 12 },
};
export const ANIM = {
  chicken: { frames: 8, fps: 6 },
  cow: { frames: 8, fps: 4 },
};

const SOURCES = {
  farmer: 'assets/farmer.png',
  chicken: 'assets/chicken.png',
  cow: 'assets/cow.png',
  shadow: 'assets/shadow.png',
  // tileset-ark (används av kartan + palett)
  farm_tiles: 'assets/farm_tiles.png',
  farm_objects: 'assets/farm_objects.png',
  plants: 'assets/plants.png',
  farm_items: 'assets/farm_items.png',
  farm_furniture: 'assets/farm_furniture.png',
  farm_bridges: 'assets/farm_bridges.png',
  farm_inside: 'assets/farm_inside.png',
  forest_spring: 'assets/forest_spring.png',
  forest_summer: 'assets/forest_summer.png',
  forest_autumn: 'assets/forest_autumn.png',
  forest_winter: 'assets/forest_winter.png',
  forest_bridges: 'assets/forest_bridges.png',
  forest_inside: 'assets/forest_inside.png',
  forest_objects: 'assets/forest_objects.png',
  forest_items_spring: 'assets/forest_items_spring.png',
  forest_items_autumn: 'assets/forest_items_autumn.png',
  forest_items_winter: 'assets/forest_items_winter.png',
  forest_furniture: 'assets/forest_furniture.png',
  mushroom_brown: 'assets/mushroom_brown.png',
  mushroom_blue: 'assets/mushroom_blue.png',
};

function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('kunde inte ladda ' + src));
    im.src = src;
  });
}

export async function loadAssets() {
  const img = {};
  await Promise.all(Object.entries(SOURCES).map(async ([k, v]) => { img[k] = await loadImg(v); }));
  return { img };
}

// Rita en 16×16-cell (col,row) från ett tileset skalad till size×size.
export function blitCell(ctx, img, col, row, dx, dy, size) {
  ctx.drawImage(img, col * TS, row * TS, TS, TS, Math.round(dx), Math.round(dy), Math.ceil(size), Math.ceil(size));
}
// Rita en godtycklig källruta (px) till dest (px).
export function blit(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  ctx.drawImage(img, sx, sy, sw, sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
}

// Karaktär. cx = centrum X (px), footY = fötterna (px), scale = pixelskala, flip = spegla.
export function drawFarmer(ctx, img, row, frame, cx, footY, scale, flip) {
  const dw = CFRAME * scale, dh = CFRAME * scale;
  const dy = Math.round(footY - dh * 0.92);
  const sx = frame * CFRAME, sy = row * CFRAME;
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(cx), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, CFRAME, CFRAME, Math.round(-dw / 2), dy, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy, CFRAME, CFRAME, Math.round(cx - dw / 2), dy, dw, dh);
  }
}

// Djur (48×48, 4-riktningsark)
export function drawAnimalSprite(ctx, img, frame, dir, cx, footY, scale) {
  const dw = AFRAME * scale, dh = AFRAME * scale;
  const dx = Math.round(cx - dw / 2);
  const dy = Math.round(footY - dh * 0.9);
  ctx.drawImage(img, frame * AFRAME, dir * AFRAME, AFRAME, AFRAME, dx, dy, dw, dh);
}

export function drawShadow(ctx, shadow, cx, footY, w, h) {
  ctx.globalAlpha = 0.3;
  ctx.drawImage(shadow, 0, 0, 16, 16, Math.round(cx - w / 2), Math.round(footY - h / 2), w, h);
  ctx.globalAlpha = 1;
}
