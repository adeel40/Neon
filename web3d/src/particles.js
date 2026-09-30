// Lightweight GPU-friendly particle system using a single THREE.Points cloud.
// One pooled buffer of particles handles explosions, hit sparks, and death
// bursts. Particles are simple additive-blended points that fade and fall.
import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene, capacity = 1200) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.head = 0; // ring-buffer cursor

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.5, vertexColors: true, transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  // Emit `n` particles at (x,y,z) with a color and speed spread.
  burst(x, y, z, colorHex, n = 12, speed = 6, life = 0.5) {
    this._c.setHex(colorHex);
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % this.capacity;
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.3) * Math.PI;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.vx[i] = Math.cos(a) * Math.cos(el) * sp;
      this.vy[i] = Math.abs(Math.sin(el)) * sp + 2;
      this.vz[i] = Math.sin(a) * Math.cos(el) * sp;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      this.colors[i * 3] = this._c.r;
      this.colors[i * 3 + 1] = this._c.g;
      this.colors[i * 3 + 2] = this._c.b;
      this.life[i] = life; this.maxLife[i] = life;
    }
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt) {
    const grav = 14;
    for (let i = 0; i < this.capacity; i++) {
      const base = i * 3;
      if (this.life[i] <= 0) {
        // Park dead particles far below the floor so they don't show at origin.
        if (this.positions[base + 1] !== -9999) this.positions[base + 1] = -9999;
        continue;
      }
      this.life[i] -= dt;
      this.vy[i] -= grav * dt;
      this.positions[base] += this.vx[i] * dt;
      this.positions[base + 1] += this.vy[i] * dt;
      this.positions[base + 2] += this.vz[i] * dt;
      if (this.life[i] <= 0) this.positions[base + 1] = -9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  reset() {
    for (let i = 0; i < this.capacity; i++) {
      this.life[i] = 0;
      this.positions[i * 3 + 1] = -9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.head = 0;
  }
}
