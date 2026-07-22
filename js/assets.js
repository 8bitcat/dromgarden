// DRÖMGÅRDEN — laddning och ritning av sprite-ark (Little Dreamyland-paketet).
// Alla figur-/djurark: 48×48 px per frame, 4 rader = riktningar.
// Radordning bekräftad från arken: 0=UPP (rygg), 1=HÖGER, 2=VÄNSTER, 3=NER (ansikte).

export const FRAME = 48;
export const DIR = { UP: 0, RIGHT: 1, LEFT: 2, DOWN: 3 };

// antal animationsframes per ark (bredd/48)
export const SHEETS = {
  idle:   { src: 'assets/bunny_idle.png',   frames: 5,  fps: 6 },
  run:    { src: 'assets/bunny_run.png',    frames: 8,  fps: 12 },
  hoe:    { src: 'assets/bunny_hoe.png',    frames: 9,  fps: 14 },
  water:  { src: 'assets/bunny_water.png',  frames: 9,  fps: 14 },
  scythe: { src: 'assets/bunny_scythe.png', frames: 9,  fps: 14 },
  chicken:{ src: 'assets/chicken.png',      frames: 8,  fps: 6 },
  cow:    { src: 'assets/cow.png',          frames: 8,  fps: 4 },
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
  const out = { img: {} };
  const entries = Object.entries(SHEETS);
  await Promise.all(entries.map(async ([k, v]) => { out.img[k] = await loadImg(v.src); }));
  out.shadow = await loadImg('assets/shadow.png');
  return out;
}

// Rita en actor-frame. cx = världscentrum X (px), footY = fötternas Y (px), scale = pixelskala.
export function drawActor(ctx, img, frame, dir, cx, footY, scale) {
  const dw = FRAME * scale, dh = FRAME * scale;
  const dx = Math.round(cx - dw / 2);
  const dy = Math.round(footY - dh * 0.92); // fötter nära nederkant av 48px-rutan
  ctx.drawImage(img, frame * FRAME, dir * FRAME, FRAME, FRAME, dx, dy, dw, dh);
}

// Skugga (16×16) under en figur
export function drawShadow(ctx, shadow, cx, footY, scale, size = 1) {
  const w = 18 * scale * size, h = 8 * scale * size;
  ctx.globalAlpha = 0.35;
  ctx.drawImage(shadow, 0, 0, 16, 16, Math.round(cx - w / 2), Math.round(footY - h / 2), w, h);
  ctx.globalAlpha = 1;
}
