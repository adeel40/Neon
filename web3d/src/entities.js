// Entity managers built on THREE.InstancedMesh for performance.
//
// Key idea: instead of one Mesh per enemy (hundreds of draw calls + GC churn),
// we keep ONE InstancedMesh per pool and write each live entity's transform
// into the instance matrix buffer every frame. This gives us hundreds of
// enemies in a single draw call — the 3D equivalent of the Flutter version's
// object pooling + no-per-frame-allocation goal.
//
// Each manager keeps a plain-array "soul" per slot (position, velocity, hp,
// etc.) and an active flag. Spawning = find a free slot + init. Death = mark
// free. We compact nothing; we just skip inactive slots and hide them.

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const HIDDEN = new THREE.Vector3(0, -9999, 0); // park inactive instances

// -------------------------------------------------------------------------
// Enemies
// -------------------------------------------------------------------------
export class EnemyManager {
  constructor(scene, capacity) {
    this.capacity = capacity;
    // Unit sphere geometry; per-instance scale sets the real radius.
    // MeshBasicMaterial is fully tinted by per-instance color and reads as
    // "emissive" under the bloom pass — so each enemy type glows its own hue.
    const geo = new THREE.SphereGeometry(1, 12, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // we manage visibility ourselves
    // Per-instance color so different enemy types glow differently.
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3), 3
    );
    scene.add(this.mesh);

    // Parallel "soul" arrays (structure-of-arrays for cache friendliness).
    this.active = new Uint8Array(capacity);
    this.px = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.hp = new Float32Array(capacity);
    this.maxHp = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.speed = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.xp = new Int16Array(capacity);
    this.behavior = new Array(capacity);     // string
    this.def = new Array(capacity);          // enemy config ref
    this.timer = new Float32Array(capacity); // per-behavior timer (blink etc.)
    this._color = new THREE.Color();

    this._freeTop = capacity;
    this._free = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) this._free[i] = capacity - 1 - i;
    this.aliveCount = 0;
  }

  spawn(def, x, z, hpScaled) {
    if (this._freeTop === 0) return -1;
    const i = this._free[--this._freeTop];
    this.active[i] = 1;
    this.px[i] = x; this.pz[i] = z;
    this.hp[i] = hpScaled; this.maxHp[i] = hpScaled;
    this.radius[i] = def.radius;
    this.speed[i] = def.speed;
    this.damage[i] = def.damage;
    this.xp[i] = def.xp;
    this.behavior[i] = def.behavior;
    this.def[i] = def;
    this.timer[i] = def.blinkEvery || 0;

    this._color.setHex(def.color);
    this.mesh.setColorAt(i, this._color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.aliveCount++;
    return i;
  }

  kill(i) {
    if (!this.active[i]) return;
    this.active[i] = 0;
    this._free[this._freeTop++] = i;
    this.aliveCount--;
  }

  // Applies damage; returns true if killed.
  damageAt(i, amount) {
    this.hp[i] -= amount;
    return this.hp[i] <= 0;
  }

  // Write all transforms into the instance buffer for rendering.
  syncMatrices() {
    for (let i = 0; i < this.capacity; i++) {
      if (this.active[i]) {
        _p.set(this.px[i], this.radius[i], this.pz[i]);
        _s.set(this.radius[i], this.radius[i], this.radius[i]);
        _m.compose(_p, _q, _s);
      } else {
        _m.compose(HIDDEN, _q, _s.set(0.0001, 0.0001, 0.0001));
      }
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// -------------------------------------------------------------------------
// Projectiles
// -------------------------------------------------------------------------
export class ProjectileManager {
  constructor(scene, capacity) {
    this.capacity = capacity;
    const geo = new THREE.SphereGeometry(0.28, 8, 8);
    // Basic material so per-instance color drives the glow under bloom.
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3), 3
    );
    scene.add(this.mesh);

    this.active = new Uint8Array(capacity);
    this.px = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.pierce = new Int16Array(capacity);
    this._color = new THREE.Color();

    this._freeTop = capacity;
    this._free = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) this._free[i] = capacity - 1 - i;
    this.aliveCount = 0;
  }

  fire(x, z, vx, vz, damage, life, pierce, colorHex) {
    if (this._freeTop === 0) return -1;
    const i = this._free[--this._freeTop];
    this.active[i] = 1;
    this.px[i] = x; this.pz[i] = z;
    this.vx[i] = vx; this.vz[i] = vz;
    this.life[i] = life; this.damage[i] = damage; this.pierce[i] = pierce;
    this._color.setHex(colorHex);
    this.mesh.setColorAt(i, this._color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.aliveCount++;
    return i;
  }

  release(i) {
    if (!this.active[i]) return;
    this.active[i] = 0;
    this._free[this._freeTop++] = i;
    this.aliveCount--;
  }

  syncMatrices() {
    for (let i = 0; i < this.capacity; i++) {
      if (this.active[i]) {
        _p.set(this.px[i], 1.0, this.pz[i]);
        _s.set(1, 1, 1);
        _m.compose(_p, _q, _s);
      } else {
        _m.compose(HIDDEN, _q, _s.set(0.0001, 0.0001, 0.0001));
      }
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// -------------------------------------------------------------------------
// XP gems
// -------------------------------------------------------------------------
export class GemManager {
  constructor(scene, capacity) {
    this.capacity = capacity;
    const geo = new THREE.OctahedronGeometry(0.35, 0);
    // All gems share the same neon-green glow; no per-instance color needed.
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff9c });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.active = new Uint8Array(capacity);
    this.px = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.value = new Int16Array(capacity);
    this.magnetized = new Uint8Array(capacity);

    this._freeTop = capacity;
    this._free = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) this._free[i] = capacity - 1 - i;
    this.aliveCount = 0;
    this._spin = 0;
  }

  spawn(x, z, value) {
    if (this._freeTop === 0) return -1;
    const i = this._free[--this._freeTop];
    this.active[i] = 1;
    this.px[i] = x; this.pz[i] = z;
    this.value[i] = value; this.magnetized[i] = 0;
    this.aliveCount++;
    return i;
  }

  release(i) {
    if (!this.active[i]) return;
    this.active[i] = 0;
    this._free[this._freeTop++] = i;
    this.aliveCount--;
  }

  syncMatrices(dt) {
    this._spin += dt * 2;
    _q.setFromAxisAngle(_UP, this._spin);
    for (let i = 0; i < this.capacity; i++) {
      if (this.active[i]) {
        _p.set(this.px[i], 0.6, this.pz[i]);
        _s.set(1, 1, 1);
        _m.compose(_p, _q, _s);
      } else {
        _m.compose(HIDDEN, _q0, _s.set(0.0001, 0.0001, 0.0001));
      }
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const _UP = new THREE.Vector3(0, 1, 0);
const _q0 = new THREE.Quaternion();
