// Unified input: keyboard (WASD/arrows) on desktop and a floating touch
// joystick on mobile. Exposes a normalized move vector { x, z } in world space
// (screen-up maps to -z so "up" moves away from the camera).
export class InputManager {
  constructor(joystickEl, knobEl) {
    this.joystickEl = joystickEl;
    this.knobEl = knobEl;
    this.moveX = 0;
    this.moveZ = 0;
    this._keys = new Set();
    this._touchId = null;
    this._originX = 0;
    this._originY = 0;
    this.maxRadius = 60;
    this.onDebugToggle = null;
    this.onPauseToggle = null;

    this._bindKeyboard();
    this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.key.toLowerCase());
      if (e.key === '`') this.onDebugToggle && this.onDebugToggle();
      if (e.key.toLowerCase() === 'p') this.onPauseToggle && this.onPauseToggle();
    });
    window.addEventListener('keyup', (e) => this._keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this._keys.clear());
  }

  _bindTouch() {
    const start = (x, y, id) => {
      this._touchId = id;
      this._originX = x; this._originY = y;
      this.joystickEl.style.left = `${x}px`;
      this.joystickEl.style.top = `${y}px`;
      this.joystickEl.classList.remove('hidden');
      this._updateKnob(x, y);
    };
    const move = (x, y) => {
      let dx = x - this._originX;
      let dy = y - this._originY;
      const len = Math.hypot(dx, dy);
      if (len > this.maxRadius) { dx = (dx / len) * this.maxRadius; dy = (dy / len) * this.maxRadius; }
      this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      if (len > 0.001) {
        // Screen +y (down) -> world +z; screen +x -> world +x.
        this.moveX = dx / (len || 1);
        this.moveZ = dy / (len || 1);
      } else { this.moveX = 0; this.moveZ = 0; }
    };
    const end = () => {
      this._touchId = null;
      this.moveX = 0; this.moveZ = 0;
      this.joystickEl.classList.add('hidden');
      this.knobEl.style.transform = 'translate(0,0)';
    };

    // Touch events
    window.addEventListener('touchstart', (e) => {
      if (this._touchId !== null) return;
      const t = e.changedTouches[0];
      if (this._isUiTarget(t.target)) return; // let buttons work
      start(t.clientX, t.clientY, t.identifier);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) move(t.clientX, t.clientY);
      }
    }, { passive: true });
    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) if (t.identifier === this._touchId) end();
    }, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });

    // Mouse drag (desktop testing of the joystick)
    let mouseDown = false;
    window.addEventListener('mousedown', (e) => {
      if (this._isUiTarget(e.target)) return;
      mouseDown = true; start(e.clientX, e.clientY, 'mouse');
    });
    window.addEventListener('mousemove', (e) => { if (mouseDown) move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (mouseDown) { mouseDown = false; end(); } });
  }

  _isUiTarget(el) {
    return el && el.closest && el.closest('button, .overlay, .card');
  }

  _updateKnob(x, y) { this.knobEl.style.transform = 'translate(0,0)'; }

  // Final move vector (keyboard overrides joystick when pressed).
  get vector() {
    let x = 0, z = 0;
    if (this._keys.has('w') || this._keys.has('arrowup')) z -= 1;
    if (this._keys.has('s') || this._keys.has('arrowdown')) z += 1;
    if (this._keys.has('a') || this._keys.has('arrowleft')) x -= 1;
    if (this._keys.has('d') || this._keys.has('arrowright')) x += 1;
    if (x !== 0 || z !== 0) {
      const len = Math.hypot(x, z);
      return { x: x / len, z: z / len };
    }
    return { x: this.moveX, z: this.moveZ };
  }
}
