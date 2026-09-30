// Weapon system: owns the player's weapons and fires each `kind` appropriately.
// Kinds implemented: projectile (aim nearest), orbit (circling drones),
// shockwave (expanding damage ring). Evolved forms reuse the same kinds.
import * as THREE from 'three';
import { WEAPONS } from './config.js';

const _tmp = [];

export class WeaponSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game; // back-reference for pools, player pos, stats

    // A weapon instance: { def, level, timer }.
    this.weapons = [];

    // Orbit drone meshes (added/removed as drone count changes).
    this.orbitGroup = new THREE.Group();
    scene.add(this.orbitGroup);
    this.orbitAngle = 0;
    this.orbitMeshes = [];

    // Active shockwave rings: { mesh, radius, maxRadius, damage, hitSet }.
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.9, 1.0, 48);
  }

  reset() {
    this.weapons.length = 0;
    this.orbitAngle = 0;
    this._clearOrbitMeshes();
    for (const r of this.rings) this.scene.remove(r.mesh);
    this.rings.length = 0;
  }

  addWeapon(id) {
    if (this.weapons.find((w) => w.def.id === id)) return;
    this.weapons.push({ def: WEAPONS[id], level: 1, timer: 0 });
  }

  levelUpWeapon(id) {
    const w = this.weapons.find((x) => x.def.id === id);
    if (w && w.level < w.def.levels.length) w.level += 1;
  }

  hasWeapon(id) { return !!this.weapons.find((w) => w.def.id === id); }
  weaponLevel(id) {
    const w = this.weapons.find((x) => x.def.id === id);
    return w ? w.level : 0;
  }
  weaponMaxed(id) {
    const w = this.weapons.find((x) => x.def.id === id);
    return w ? w.level >= w.def.levels.length : false;
  }

  // Replace a base weapon with its evolved form (chest reward).
  evolve(baseId, evoId) {
    const w = this.weapons.find((x) => x.def.id === baseId);
    if (!w) return;
    w.def = WEAPONS[evoId];
    w.level = 1;
  }

  _clearOrbitMeshes() {
    for (const m of this.orbitMeshes) this.orbitGroup.remove(m);
    this.orbitMeshes.length = 0;
  }

  _ensureOrbitMeshes(count, color, r) {
    if (this.orbitMeshes.length === count) return;
    this._clearOrbitMeshes();
    const geo = new THREE.SphereGeometry(r, 10, 8);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: color, emissiveIntensity: 2.0, roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.orbitGroup.add(mesh);
      this.orbitMeshes.push(mesh);
    }
  }

  update(dt) {
    const g = this.game;
    const cd = g.stats.cooldownMult;

    for (const w of this.weapons) {
      const s = w.def.levels[w.level - 1];
      switch (w.def.kind) {
        case 'projectile': {
          w.timer -= dt;
          if (w.timer <= 0) {
            w.timer = s.cooldown * cd;
            this._fireProjectile(w, s);
          }
          break;
        }
        case 'orbit':
          this._updateOrbit(w, s, dt);
          break;
        case 'shockwave': {
          w.timer -= dt;
          if (w.timer <= 0) {
            w.timer = s.cooldown * cd;
            for (let i = 0; i < s.count; i++) this._spawnRing(w, s);
          }
          break;
        }
        default: break;
      }
    }

    this._updateRings(dt);
  }

  // ---- projectile: aim at nearest enemy --------------------------------
  _fireProjectile(w, s) {
    const g = this.game;
    const target = g.findNearestEnemy(g.player.x, g.player.z, 60);
    if (target < 0) return;
    const ex = g.enemies.px[target], ez = g.enemies.pz[target];
    let dx = ex - g.player.x, dz = ez - g.player.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;

    const dmg = s.damage * g.stats.damageMult;
    const spread = 0.14;
    const base = Math.atan2(dz, dx) - (spread * (s.count - 1)) / 2;
    for (let i = 0; i < s.count; i++) {
      const a = base + spread * i;
      const vx = Math.cos(a) * w.def.projectileSpeed;
      const vz = Math.sin(a) * w.def.projectileSpeed;
      g.projectiles.fire(
        g.player.x, g.player.z, vx, vz, dmg,
        w.def.projectileLife, s.pierce || 0, w.def.color
      );
    }
    g.audio.play('shoot');
  }

  // ---- orbit: drones circle the player, damage on contact --------------
  _updateOrbit(w, s, dt) {
    const g = this.game;
    this._ensureOrbitMeshes(s.count, w.def.color, w.def.droneRadius);
    this.orbitAngle += w.def.orbitSpeed * dt;
    const dmg = s.damage * g.stats.damageMult * dt; // continuous-ish DPS
    const R = w.def.orbitRadius;

    for (let i = 0; i < this.orbitMeshes.length; i++) {
      const a = this.orbitAngle + (i / this.orbitMeshes.length) * Math.PI * 2;
      const ox = g.player.x + Math.cos(a) * R;
      const oz = g.player.z + Math.sin(a) * R;
      const mesh = this.orbitMeshes[i];
      mesh.position.set(ox, 1.0, oz);

      // Damage enemies the drone overlaps.
      g.spatialHash.query(ox, oz, w.def.droneRadius + 1.5, _tmp);
      for (let k = 0; k < _tmp.length; k++) {
        const e = _tmp[k];
        if (!g.enemies.active[e]) continue;
        const rr = w.def.droneRadius + g.enemies.radius[e];
        const ddx = g.enemies.px[e] - ox, ddz = g.enemies.pz[e] - oz;
        if (ddx * ddx + ddz * ddz <= rr * rr) {
          if (g.enemies.damageAt(e, dmg)) g.onEnemyKilled(e);
        }
      }
    }
  }

  // ---- shockwave: expanding ring of force ------------------------------
  _spawnRing(w, s) {
    const g = this.game;
    const mat = new THREE.MeshBasicMaterial({
      color: w.def.color, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(g.player.x, 0.2, g.player.z);
    this.scene.add(mesh);
    this.rings.push({
      mesh, radius: 1, maxRadius: s.area,
      damage: s.damage * g.stats.damageMult,
      speed: w.def.ringSpeed, hit: new Set(),
    });
    g.audio.play('shock');
  }

  _updateRings(dt) {
    const g = this.game;
    for (let r = this.rings.length - 1; r >= 0; r--) {
      const ring = this.rings[r];
      ring.radius += ring.speed * dt;
      const scl = ring.radius;
      ring.mesh.scale.set(scl, scl, scl);
      ring.mesh.material.opacity = 0.8 * (1 - ring.radius / ring.maxRadius);

      // Damage enemies crossing the ring's leading edge (once each).
      g.spatialHash.query(ring.mesh.position.x, ring.mesh.position.z, ring.radius + 1, _tmp);
      for (let k = 0; k < _tmp.length; k++) {
        const e = _tmp[k];
        if (!g.enemies.active[e] || ring.hit.has(e)) continue;
        const dx = g.enemies.px[e] - ring.mesh.position.x;
        const dz = g.enemies.pz[e] - ring.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (Math.abs(dist - ring.radius) <= g.enemies.radius[e] + 1) {
          ring.hit.add(e);
          if (g.enemies.damageAt(e, ring.damage)) g.onEnemyKilled(e);
        }
      }

      if (ring.radius >= ring.maxRadius) {
        this.scene.remove(ring.mesh);
        ring.mesh.material.dispose();
        this.rings.splice(r, 1);
      }
    }
  }
}
