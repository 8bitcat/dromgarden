// DRÖMGÅRDEN — styrning. Tangentbord (WASD/piltangenter) + touch: dynamisk joystick
// var som helst på vänster/fri yta, plus en stor actionknapp. Byggd för mobil i familjen.

export class Input {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts || {};
    this.keys = new Set();
    this.joyId = null;
    this.joyStart = null;   // {x,y} skärmpixlar
    this.joyCur = null;
    this.joyVec = { x: 0, y: 0 };
    this.radius = 55;
    this._bindKeys();
    this._bindTouch();
    this._bindButtons();
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k >= '1' && k <= '9') { this.opts.onTool?.(parseInt(k, 10) - 1); return; }
      if (k === ' ' || k === 'e' || k === 'enter') { this.opts.onAction?.(); return; }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindTouch() {
    const rectPt = (t) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (this.joyId === null) {
          this.joyId = t.identifier;
          this.joyStart = rectPt(t);
          this.joyCur = { ...this.joyStart };
        }
      }
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          this.joyCur = rectPt(t);
          let dx = this.joyCur.x - this.joyStart.x;
          let dy = this.joyCur.y - this.joyStart.y;
          const m = Math.hypot(dx, dy) || 1;
          const cl = Math.min(m, this.radius) / this.radius;
          this.joyVec = { x: (dx / m) * cl, y: (dy / m) * cl };
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          this.joyId = null; this.joyStart = null; this.joyCur = null;
          this.joyVec = { x: 0, y: 0 };
        }
      }
    };
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
  }

  _bindButtons() {
    const btn = document.getElementById('actionBtn');
    if (btn) {
      // pointerdown triggar en gång för både touch och mus (inga dubbla syntetiska events)
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.blur(); this.opts.onAction?.(); });
    }
  }

  getMove() {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x || y) { const m = Math.hypot(x, y); return { x: x / m, y: y / m }; }
    return this.joyVec;
  }

  // Rita joystick-overlay (anropas från render)
  drawJoystick(ctx) {
    if (this.joyId === null || !this.joyStart) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.joyStart.x, this.joyStart.y, this.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#ffffff';
    const kx = this.joyStart.x + this.joyVec.x * this.radius;
    const ky = this.joyStart.y + this.joyVec.y * this.radius;
    ctx.beginPath(); ctx.arc(kx, ky, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
