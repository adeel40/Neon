// NEON HORDE: Last Signal — 3D. Main game orchestrator.
//
// Builds the Three.js scene (neon grid arena, bloom post-processing, angled
// top-down camera that follows the player) and runs the fixed game loop:
// input -> weapons -> enemies -> collisions -> xp/level-up -> render.
//
// Performance: enemies/projectiles/gems are InstancedMeshes with pooled
// structure-of-arrays data (see entities.js) and broad-phase collisions use a
// spatial hash (spatial_hash.js), so hundreds of enemies stay a handful of
// draw calls.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { CONFIG, WEAPONS, PASSIVES } from './config.js';
import { PlayerStats, RunState } from './state.js';
import { EnemyManager, ProjectileManager, GemManager } from './entities.js';
import { SpatialHash } from './spatial_hash.js';
import { WeaponSystem } from './weapons.js';
import { SpawnDirector, updateEnemies } from './enemy_ai.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';

class Game {
  constructor() {
    this.stats = new PlayerStats();
    this.run = new RunState();
    this.player = { x: 0, z: 0, facing: 0 };

    this.paused = false;
    this.running = false;
    this._queryBuf = [];
    this._invuln = 0;
    this._hitFlash = 0;
    this._shake = 0;
    this._hitStop = 0;
    this._slowmo = 1;

    this._initThree();
    this._initEntities();
    this._initSystems();

    this.ui = new UI(this);
    this._bindResize();

    this._last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  // ---- Three.js scene, renderer, camera, lights, ground ----------------
  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060d);
    this.scene.fog = new THREE.FogExp2(0x05060d, 0.012);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 500
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('app').appendChild(this.renderer.domElement);

    // Bloom post-processing gives the neon glow.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9,  // strength
      0.6,  // radius
      0.15  // threshold
    );
    this.composer.addPass(this.bloom);

    // Lighting: low ambient + a cool key light so emissive materials pop.
    this.scene.add(new THREE.AmbientLight(0x222244, 1.2));
    const key = new THREE.DirectionalLight(0x88aaff, 0.8);
    key.position.set(10, 30, 10);
    this.scene.add(key);

    // Neon grid ground (huge, so it reads as infinite as the camera moves).
    const grid = new THREE.GridHelper(CONFIG.groundSize, CONFIG.groundSize / 4, 0x00e5ff, 0x1a1a3a);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    this.scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.groundSize, CONFIG.groundSize),
      new THREE.MeshStandardMaterial({ color: 0x070914, roughness: 1, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(floor);

    // Player mesh: glowing cyan cone pointing in the move direction.
    const pgeo = new THREE.ConeGeometry(CONFIG.player.radius, CONFIG.player.radius * 2.2, 6);
    pgeo.rotateX(Math.PI / 2); // point along +z by default
    this.playerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x00e5ff, emissiveIntensity: 2.0, roughness: 0.3,
    });
    this.playerMesh = new THREE.Mesh(pgeo, this.playerMat);
    this.playerMesh.position.set(0, CONFIG.player.radius, 0);
    this.scene.add(this.playerMesh);

    // A glowing ring under the player showing magnet radius.
    this.magnetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.0, 40),
      new THREE.MeshBasicMaterial({ color: 0x00ff9c, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    this.magnetRing.rotation.x = -Math.PI / 2;
    this.magnetRing.position.y = 0.05;
    this.scene.add(this.magnetRing);
  }

  _initEntities() {
    this.enemies = new EnemyManager(this.scene, CONFIG.spawn.maxAlive);
    this.projectiles = new ProjectileManager(this.scene, 300);
    this.gems = new GemManager(this.scene, 600);
    this.particles = new ParticleSystem(this.scene, 1500);
  }

  _initSystems() {
    this.spatialHash = new SpatialHash(4);
    this.weapons = new WeaponSystem(this.scene, this);
    this.spawnDirector = new SpawnDirector();
    this.audio = new AudioManager();

    this.input = new InputManager(
      document.getElementById('joystick'),
      document.getElementById('joystickKnob')
    );
    this.input.onDebugToggle = () => this.ui.toggleDebug();
    this.input.onPauseToggle = () => this.togglePause();
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ---- Lifecycle --------------------------------------------------------
  start() {
    this.audio.init();
    this.audio.resume();
    this.audio.startMusic();
    this.ui.hideStart();
    this.ui.showHud();
    this._resetRun();
    this.running = true;
    this.paused = false;
  }

  restart() {
    this.ui.hideGameOver();
    this._resetRun();
    this.running = true;
    this.paused = false;
    this.audio.startMusic();
  }

  _resetRun() {
    this.stats.reset();
    this.run.reset(CONFIG.player.maxHp);
    this.player.x = 0; this.player.z = 0;
    this._invuln = 0; this._hitFlash = 0; this._shake = 0; this._hitStop = 0; this._slowmo = 1;

    // Clear all pools.
    for (let i = 0; i < this.enemies.capacity; i++) if (this.enemies.active[i]) this.enemies.kill(i);
    for (let i = 0; i < this.projectiles.capacity; i++) if (this.projectiles.active[i]) this.projectiles.release(i);
    for (let i = 0; i < this.gems.capacity; i++) if (this.gems.active[i]) this.gems.release(i);
    this.particles.reset();

    this.weapons.reset();
    this.weapons.addWeapon('plasma_pistol'); // starting weapon
    this.spawnDirector.reset();
    this.ui.resetMeta();
  }

  togglePause() {
    if (!this.running || this.run.gameOver) return;
    // Don't allow manual pause while the level-up modal is open.
    if (!this.ui.el.levelUp.classList.contains('hidden')) return;
    this.paused = !this.paused;
    this.ui.el.pauseBtn.textContent = this.paused ? '\u25B6' : 'II';
    if (this.paused) this.audio.stopMusic(); else this.audio.startMusic();
  }

  // ---- Main loop --------------------------------------------------------
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.05) dt = 0.05; // clamp hitches

    this.audio.updateMusic(now / 1000);

    if (this.running && !this.paused && !this.run.gameOver) {
      // Hit-stop freezes the sim briefly for impact; slow-mo scales dt.
      if (this._hitStop > 0) { this._hitStop -= dt; }
      else { this._update(dt * this._slowmo); }
      if (this._slowmo < 1) { this._slowmo = Math.min(1, this._slowmo + dt * 1.5); }
    }

    this._render(dt);
  }

  _update(dt) {
    this.run.elapsed += dt;
    this.run.tickCombo(dt);

    // Player movement.
    const v = this.input.vector;
    if (v.x !== 0 || v.z !== 0) {
      this.player.x += v.x * this.stats.moveSpeed * dt;
      this.player.z += v.z * this.stats.moveSpeed * dt;
      this.player.facing = Math.atan2(v.x, v.z);
    }

    // Invulnerability / hit flash timers.
    if (this._invuln > 0) this._invuln -= dt;
    if (this._hitFlash > 0) this._hitFlash -= dt;

    // Spawn director.
    this.spawnDirector.update(
      dt, this.run.difficultyTier, this.player.x, this.player.z,
      this.enemies.aliveCount,
      (def, x, z, hp) => this.enemies.spawn(def, x, z, hp)
    );

    // Enemy AI.
    updateEnemies(this, dt);

    // Rebuild spatial hash after movement, before collisions.
    this.spatialHash.rebuild(this.enemies);

    // Weapons (uses spatial hash for targeting/aoe).
    this.weapons.update(dt);

    // Projectiles + projectile-vs-enemy.
    this._updateProjectiles(dt);

    // Enemy-vs-player contact.
    this._resolveContact();

    // Gems: magnet + pickup.
    this._updateGems(dt);

    // Adaptive music intensity from alive-enemy pressure.
    this.audio.setIntensity(Math.min(1, this.enemies.aliveCount / 120));

    // End conditions.
    if (this.run.elapsed >= CONFIG.runDuration && !this.run.gameOver) this._gameOver(true);
  }

  findNearestEnemy(x, z, maxDist) {
    // Expanding-ring query keeps this cheap when enemies are near.
    for (const r of [12, 30, maxDist]) {
      this.spatialHash.query(x, z, r, this._queryBuf);
      let best = -1, bestD = Infinity;
      for (let k = 0; k < this._queryBuf.length; k++) {
        const e = this._queryBuf[k];
        if (!this.enemies.active[e]) continue;
        const dx = this.enemies.px[e] - x, dz = this.enemies.pz[e] - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  _updateProjectiles(dt) {
    const P = this.projectiles;
    for (let i = 0; i < P.capacity; i++) {
      if (!P.active[i]) continue;
      P.life[i] -= dt;
      if (P.life[i] <= 0) { P.release(i); continue; }
      P.px[i] += P.vx[i] * dt;
      P.pz[i] += P.vz[i] * dt;

      // Collide with enemies via spatial hash.
      this.spatialHash.query(P.px[i], P.pz[i], 2.5, this._queryBuf);
      for (let k = 0; k < this._queryBuf.length; k++) {
        const e = this._queryBuf[k];
        if (!this.enemies.active[e]) continue;
        const rr = 0.28 + this.enemies.radius[e];
        const dx = this.enemies.px[e] - P.px[i], dz = this.enemies.pz[e] - P.pz[i];
        if (dx * dx + dz * dz <= rr * rr) {
          this.particles.burst(P.px[i], 1, P.pz[i], 0x00e5ff, 5, 5, 0.3);
          if (this.enemies.damageAt(e, P.damage[i])) this.onEnemyKilled(e);
          this.audio.play('hit');
          if (P.pierce[i] > 0) P.pierce[i] -= 1;
          else { P.release(i); break; }
        }
      }
    }
  }

  _resolveContact() {
    if (this._invuln > 0) return;
    this.spatialHash.query(this.player.x, this.player.z, CONFIG.player.radius + 2, this._queryBuf);
    for (let k = 0; k < this._queryBuf.length; k++) {
      const e = this._queryBuf[k];
      if (!this.enemies.active[e]) continue;
      const rr = CONFIG.player.radius + this.enemies.radius[e];
      const dx = this.enemies.px[e] - this.player.x, dz = this.enemies.pz[e] - this.player.z;
      if (dx * dx + dz * dz <= rr * rr) {
        this._damagePlayer(this.enemies.damage[e]);
        break;
      }
    }
  }

  _damagePlayer(amount) {
    const dmg = Math.max(1, amount - this.stats.armorFlat);
    this.run.hp -= dmg;
    this._invuln = CONFIG.player.invulnTime;
    this._hitFlash = 0.25;
    this._shake = 0.4;
    this.audio.play('hurt');
    if (this.run.hp <= 0) { this.run.hp = 0; this._gameOver(false); }
  }

  onEnemyKilled(e) {
    const ex = this.enemies.px[e], ez = this.enemies.pz[e];
    const col = this.enemies.def[e].color;
    const xp = this.enemies.xp[e];
    this.particles.burst(ex, this.enemies.radius[e], ez, col, 12, 7, 0.5);
    this.gems.spawn(ex, ez, xp);
    this.run.registerKill();
    this.audio.play('kill');
    this.enemies.kill(e);
  }

  // AoE damage (exploder, evolved effects).
  explodeAt(x, z, radius, damage) {
    this.particles.burst(x, 1, z, 0xff7a00, 24, 10, 0.6);
    this._shake = Math.max(this._shake, 0.35);
    this.spatialHash.query(x, z, radius, this._queryBuf);
    for (let k = 0; k < this._queryBuf.length; k++) {
      const e = this._queryBuf[k];
      if (!this.enemies.active[e]) continue;
      const dx = this.enemies.px[e] - x, dz = this.enemies.pz[e] - z;
      if (dx * dx + dz * dz <= radius * radius) {
        if (this.enemies.damageAt(e, damage)) this.onEnemyKilled(e);
      }
    }
    // Exploders also hurt the player if in range.
    const pdx = this.player.x - x, pdz = this.player.z - z;
    if (pdx * pdx + pdz * pdz <= radius * radius && this._invuln <= 0) {
      this._damagePlayer(damage);
    }
  }

  _updateGems(dt) {
    const G = this.gems;
    const mr = this.stats.magnetRadius;
    let ups = 0;
    for (let i = 0; i < G.capacity; i++) {
      if (!G.active[i]) continue;
      const dx = this.player.x - G.px[i], dz = this.player.z - G.pz[i];
      const d2 = dx * dx + dz * dz;
      const collect = (CONFIG.player.radius + 0.5);
      if (d2 <= collect * collect) {
        ups += this.run.addXp(G.value[i]);
        this.particles.burst(G.px[i], 0.6, G.pz[i], 0x00ff9c, 4, 3, 0.25);
        G.release(i);
        continue;
      }
      if (G.magnetized[i] || d2 <= mr * mr) {
        G.magnetized[i] = 1;
        const d = Math.sqrt(d2) || 1;
        G.px[i] += (dx / d) * CONFIG.gemMagnetSpeed * dt;
        G.pz[i] += (dz / d) * CONFIG.gemMagnetSpeed * dt;
      }
    }
    if (ups > 0 && !this.run.gameOver) this._levelUp();
  }

  // ---- Level up + upgrades ---------------------------------------------
  _levelUp() {
    this.paused = true;
    this.audio.play('levelup');
    this.ui.showLevelUp(this.run);
  }

  chooseUpgrade(choice) {
    if (choice) {
      if (choice.type === 'passive') {
        const p = PASSIVES[choice.id];
        this.stats.apply(p.stat, p.amount, p.id);
      } else if (choice.type === 'weaponNew') {
        this.weapons.addWeapon(choice.id);
      } else if (choice.type === 'weaponLevel') {
        this.weapons.levelUpWeapon(choice.id);
      }
    }
    // After ANY choice, re-check every weapon for an evolution (a weapon may
    // evolve either by reaching max level, or by later acquiring the matching
    // passive while already maxed).
    this._checkEvolutions();
    this.ui.hideLevelUp();
    this.paused = false;
  }

  // Evolution: a maxed base weapon + its matching owned passive => evolved form.
  // Delivered as a "chest" flourish (slow-mo + burst) per the design concept.
  _checkEvolutions() {
    for (const w of this.weapons.weapons.slice()) {
      const def = WEAPONS[w.def.id];
      if (!def || !def.evolvesInto) continue;               // already evolved / no recipe
      if (!this.weapons.weaponMaxed(w.def.id)) continue;     // not maxed yet
      if (this.stats.stacksOf(def.evolvePassive) <= 0) continue; // missing passive
      this.weapons.evolve(w.def.id, def.evolvesInto);
      this.audio.play('chest');
      this._slowmo = 0.35; // brief cinematic flourish
      this.particles.burst(this.player.x, 1.5, this.player.z, WEAPONS[def.evolvesInto].color, 40, 12, 0.8);
    }
  }

  _gameOver(victory) {
    this.run.gameOver = true;
    this.run.victory = victory;
    this.audio.stopMusic();
    if (victory) this.audio.play('chest');
    this.ui.showGameOver(this.run);
  }

  // ---- Render -----------------------------------------------------------
  _render(dt) {
    // Sync instanced buffers.
    this.enemies.syncMatrices();
    this.projectiles.syncMatrices();
    this.gems.syncMatrices(dt);
    this.particles.update(dt);

    // Player mesh transform + hit flash.
    this.playerMesh.position.set(this.player.x, CONFIG.player.radius, this.player.z);
    this.playerMesh.rotation.y = this.player.facing;
    const flashing = this._hitFlash > 0 && Math.floor(this._hitFlash * 20) % 2 === 0;
    this.playerMat.emissive.setHex(flashing ? 0xff2e97 : 0x00e5ff);
    this.playerMat.visible = !(this._invuln > 0 && Math.floor(this._invuln * 12) % 2 === 0);

    // Magnet ring follows player + scales to radius.
    const mr = this.stats.magnetRadius;
    this.magnetRing.position.set(this.player.x, 0.05, this.player.z);
    this.magnetRing.scale.set(mr, mr, mr);

    // Camera follows player (angled top-down) with screen shake.
    let camX = this.player.x;
    let camZ = this.player.z + CONFIG.camera.back;
    if (this._shake > 0) {
      this._shake -= dt;
      const s = this._shake * 2;
      camX += (Math.random() - 0.5) * s;
      camZ += (Math.random() - 0.5) * s;
    }
    this.camera.position.set(camX, CONFIG.camera.height, camZ);
    this.camera.lookAt(this.player.x, 0, this.player.z);

    // HUD.
    if (this.running) this.ui.updateHud(this.run);

    // Debug overlay.
    this.ui.updateDebug(
      `FPS   ${(1 / Math.max(dt, 0.0001)).toFixed(0)}\n` +
      `enemy ${this.enemies.aliveCount}/${this.enemies.capacity}\n` +
      `proj  ${this.projectiles.aliveCount}\n` +
      `gems  ${this.gems.aliveCount}\n` +
      `cells ${this.spatialHash.activeCellCount}\n` +
      `tier  ${this.run.difficultyTier}  combo ${this.run.combo}`
    );

    this.composer.render();
  }
}

// Boot.
window.addEventListener('DOMContentLoaded', () => {
  // Store a reference on window for debugging in the console.
  window.game = new Game();
});
