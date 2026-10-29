import { DIR } from './constants.js';

const KEY_DIR = {
  ArrowUp: DIR.UP, KeyW: DIR.UP, ArrowRight: DIR.RIGHT, KeyD: DIR.RIGHT,
  ArrowDown: DIR.DOWN, KeyS: DIR.DOWN, ArrowLeft: DIR.LEFT, KeyA: DIR.LEFT,
};
const FIRE_KEYS = new Set(['Space', 'KeyJ', 'KeyK']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export class Input {
  constructor() {
    this.dirStack = [];      // most recent key wins
    this.keyFire = false;
    this.touchDir = -1;
    this.touchFire = false;
    this.pauseRequested = false;
    this.enabled = true;

    addEventListener('keydown', e => {
      if (e.target.closest?.('input, textarea')) return;
      if (PAUSE_KEYS.has(e.code)) { if (!e.repeat) this.pauseRequested = true; return; }
      if (!this.enabled) return;
      if (e.code in KEY_DIR) {
        e.preventDefault();
        const d = KEY_DIR[e.code];
        this.dirStack = this.dirStack.filter(x => x !== d);
        this.dirStack.push(d);
      } else if (FIRE_KEYS.has(e.code)) { e.preventDefault(); this.keyFire = true; }
    });
    addEventListener('keyup', e => {
      if (e.code in KEY_DIR) this.dirStack = this.dirStack.filter(x => x !== KEY_DIR[e.code]);
      else if (FIRE_KEYS.has(e.code)) this.keyFire = false;
    });
    addEventListener('blur', () => this.reset());
  }

  reset() { this.dirStack = []; this.keyFire = false; this.touchDir = -1; this.touchFire = false; }

  get dir() { return this.touchDir >= 0 ? this.touchDir : (this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : -1); }
  get fire() { return this.keyFire || this.touchFire; }

  consumePause() { const p = this.pauseRequested; this.pauseRequested = false; return p; }

  /** Wire an on-screen joystick (pad element containing a knob) and fire button. */
  bindTouch(pad, knob, fireBtn) {
    let id = null, ox = 0, oy = 0;
    const R = 34;
    const move = (x, y) => {
      let dx = x - ox, dy = y - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      if (d < 10) this.touchDir = -1;
      else this.touchDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR.RIGHT : DIR.LEFT) : (dy > 0 ? DIR.DOWN : DIR.UP);
    };
    pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      id = e.pointerId;
      pad.setPointerCapture(id);
      const r = pad.getBoundingClientRect();
      ox = r.left + r.width / 2; oy = r.top + r.height / 2;
      move(e.clientX, e.clientY);
    });
    pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e.clientX, e.clientY); });
    const end = e => { if (e.pointerId !== id) return; id = null; this.touchDir = -1; knob.style.transform = ''; };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);

    fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); fireBtn.setPointerCapture(e.pointerId); this.touchFire = true; fireBtn.classList.add('down'); });
    const fend = () => { this.touchFire = false; fireBtn.classList.remove('down'); };
    fireBtn.addEventListener('pointerup', fend);
    fireBtn.addEventListener('pointercancel', fend);
  }
}
