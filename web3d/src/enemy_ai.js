// Enemy AI behaviors and the spawn director.
// Behaviors: chase (move at player), exploder (chase then burst near player),
// teleporter (chase, periodically blink toward the player).
import { CONFIG, ENEMIES } from './config.js';

const _types = Object.values(ENEMIES);
const _cum = [];
let _total = 0;
for (const t of _types) { _total += t.weight; _cum.push(_total); }

export class SpawnDirector {
  constructor() { this.timer = 0; }
  reset() { this.timer = 0; }

  _intervalForTier(tier) {
    const v = CONFIG.spawn.baseInterval * Math.pow(CONFIG.spawn.intervalDecay, tier);
    return Math.max(CONFIG.spawn.minInterval, v);
  }
  hpMult(tier) { return 1 + CONFIG.spawn.hpGrowthPerTier * tier; }
  _batch(tier) { return 1 + Math.floor(tier / 2); }

  _pickType() {
    const roll = Math.random() * _total;
    for (let i = 0; i < _cum.length; i++) if (roll <= _cum[i]) return _types[i];
    return _types[_types.length - 1];
  }

  // Spawn point just outside the camera view, on a ring around the player.
  _spawnPoint(px, pz) {
    const a = Math.random() * Math.PI * 2;
    const d = CONFIG.spawn.spawnDistance;
    return [px + Math.cos(a) * d, pz + Math.sin(a) * d];
  }

  update(dt, tier, px, pz, alive, spawnFn) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this._intervalForTier(tier);
    const batch = this._batch(tier);
    const mult = this.hpMult(tier);
    for (let i = 0; i < batch; i++) {
      if (alive + i >= CONFIG.spawn.maxAlive) break;
      const type = this._pickType();
      const [x, z] = this._spawnPoint(px, pz);
      spawnFn(type, x, z, type.hp * mult);
    }
  }
}

// Advance every active enemy according to its behavior.
// `game` provides player position and a way to deal AoE damage (exploder).
export function updateEnemies(game, dt) {
  const e = game.enemies;
  const px = game.player.x, pz = game.player.z;

  for (let i = 0; i < e.capacity; i++) {
    if (!e.active[i]) continue;
    let dx = px - e.px[i];
    let dz = pz - e.pz[i];
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist, nz = dz / dist;

    switch (e.behavior[i]) {
      case 'chase': {
        e.px[i] += nx * e.speed[i] * dt;
        e.pz[i] += nz * e.speed[i] * dt;
        break;
      }
      case 'exploder': {
        e.px[i] += nx * e.speed[i] * dt;
        e.pz[i] += nz * e.speed[i] * dt;
        // When very close, detonate: AoE + self-destruct.
        if (dist < 1.6) {
          const rad = e.def[i].explodeRadius || 4;
          game.explodeAt(e.px[i], e.pz[i], rad, e.damage[i]);
          game.enemies.kill(i);
        }
        break;
      }
      case 'teleporter': {
        e.px[i] += nx * e.speed[i] * 0.6 * dt;
        e.pz[i] += nz * e.speed[i] * 0.6 * dt;
        e.timer[i] -= dt;
        if (e.timer[i] <= 0) {
          e.timer[i] = e.def[i].blinkEvery || 2.5;
          const bd = e.def[i].blinkDist || 12;
          // Blink closer to the player (but not on top of them).
          const blink = Math.min(bd, Math.max(0, dist - 3));
          e.px[i] += nx * blink;
          e.pz[i] += nz * blink;
        }
        break;
      }
      default: {
        e.px[i] += nx * e.speed[i] * dt;
        e.pz[i] += nz * e.speed[i] * dt;
      }
    }
  }
}
