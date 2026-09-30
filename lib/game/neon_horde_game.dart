import 'dart:math' as math;
import 'dart:ui' show Color;

import 'package:flame/components.dart';
import 'package:flame/game.dart';

import '../components/enemy.dart';
import '../components/player.dart';
import '../components/projectile.dart';
import '../components/xp_gem.dart';
import '../models/upgrade_data.dart';
import '../models/weapon_data.dart';
import '../services/data_loader.dart';
import '../services/game_config.dart';
import '../systems/object_pool.dart';
import '../systems/player_stats.dart';
import '../systems/run_state.dart';
import '../systems/spatial_hash.dart';
import '../systems/spawn_director.dart';

/// Overlay identifiers registered on the GameWidget (see game_screen.dart).
class Overlays {
  static const joystick = 'joystick';
  static const hud = 'hud';
  static const levelUp = 'levelUp';
  static const gameOver = 'gameOver';
  static const debug = 'debug';
}

/// The core Flame game. Uses HasGameReference-free design: everything lives
/// here. We drive enemy/projectile/gem updates manually (not via Flame's
/// component update tree) so we control ordering and can iterate pools without
/// per-frame allocation.
class NeonHordeGame extends FlameGame {
  NeonHordeGame({required this.data});

  final GameData data;

  // ---- Core objects -----------------------------------------------------
  late final Player player;
  late final WeaponData weapon;
  late final SpawnDirector spawnDirector;
  final SpatialHash spatialHash = SpatialHash(cellSize: 48);
  final PlayerStats stats = PlayerStats();
  final RunState run = RunState();

  // ---- Pools ------------------------------------------------------------
  late final ObjectPool<Enemy> enemyPool;
  late final ObjectPool<Projectile> projectilePool;
  late final ObjectPool<XpGem> gemPool;

  // ---- Firing / timers --------------------------------------------------
  double _fireTimer = 0;
  final math.Random _rng = math.Random();

  // ---- Joystick (floating) ---------------------------------------------
  bool _joystickActive = false;
  final Vector2 _joystickOrigin = Vector2.zero(); // screen space
  final Vector2 _joystickCurrent = Vector2.zero(); // screen space
  final Vector2 _moveDir = Vector2.zero(); // normalized
  static const double _joystickMaxRadius = 70;

  /// Public accessors for the joystick painter overlay.
  bool get joystickActive => _joystickActive;
  Vector2 get joystickOrigin => _joystickOrigin;
  Vector2 get joystickCurrent => _joystickCurrent;
  double get joystickMaxRadius => _joystickMaxRadius;

  // Reusable scratch buffers (avoid per-frame allocation in hot loops).
  final List<Enemy> _queryBuf = <Enemy>[];
  final Vector2 _fireDir = Vector2.zero();
  final Vector2 _camTopLeft = Vector2.zero();

  bool _paused = false;
  bool get isPausedManually => _paused;

  @override
  Color backgroundColor() => const Color(0xFF0B0B14);

  @override
  Future<void> onLoad() async {
    weapon = data.plasmaPistol;

    // Preallocate pools sized for the perf target so mid-run growth is rare.
    enemyPool = ObjectPool<Enemy>(Enemy.new, preallocate: 350);
    projectilePool = ObjectPool<Projectile>(Projectile.new, preallocate: 200);
    gemPool = ObjectPool<XpGem>(XpGem.new, preallocate: 400);

    // Add all pooled components to the WORLD (not the game root) so they are
    // rendered through the camera transform and move relative to the player.
    // They render only when active (render() early-returns when inactive), and
    // we drive their logic manually. Adding once avoids add/remove churn.
    for (final e in enemyPool.all) {
      world.add(e);
    }
    for (final p in projectilePool.all) {
      world.add(p);
    }
    for (final g in gemPool.all) {
      world.add(g);
    }

    player = Player();
    await world.add(player);

    spawnDirector = SpawnDirector(data.enemies, rng: _rng);

    _startRun();

    // Camera follows the player; world is effectively infinite.
    camera.follow(player);
  }

  /// Initializes/resets everything for a fresh run WITHOUT reloading assets.
  void _startRun() {
    stats.reset();
    run.reset(stats.maxHp);

    // Release any active pooled objects back to their pools.
    for (final e in enemyPool.all) {
      if (e.isActive) enemyPool.release(e);
    }
    for (final p in projectilePool.all) {
      if (p.isActive) projectilePool.release(p);
    }
    for (final g in gemPool.all) {
      if (g.isActive) gemPool.release(g);
    }

    player.position.setZero();
    player.invulnerable = false;
    _invulnTimer = 0;
    _fireTimer = 0;
    _joystickActive = false;
    _moveDir.setZero();
    spawnDirector.reset();
    _paused = false;
  }

  /// Called by the Game Over screen's RESTART button. Fast: no asset reload.
  void restart() {
    _startRun();
    overlays.remove(Overlays.gameOver);
    resumeEngine();
  }

  void togglePause() {
    if (run.gameOver) return;
    _paused = !_paused;
    if (_paused) {
      pauseEngine();
    } else {
      resumeEngine();
    }
  }

  // ---- Input: floating joystick ----------------------------------------
  // Input is fed from a Flutter GestureDetector in game_screen.dart using the
  // stable Flutter drag API (global positions in logical pixels). This avoids
  // depending on Flame's drag-info accessor names, which vary by version.

  /// Begins a floating-joystick drag at [screenPos] (logical px).
  void onJoystickStart(double x, double y) {
    if (run.gameOver || _paused) return;
    _joystickActive = true;
    _joystickOrigin.setValues(x, y);
    _joystickCurrent.setValues(x, y);
    _moveDir.setZero();
  }

  /// Updates the joystick knob to [screenPos] and recomputes the move vector.
  void onJoystickUpdate(double x, double y) {
    if (!_joystickActive) return;
    _joystickCurrent.setValues(x, y);
    final dx = _joystickCurrent.x - _joystickOrigin.x;
    final dy = _joystickCurrent.y - _joystickOrigin.y;
    final len = math.sqrt(dx * dx + dy * dy);
    if (len > 0.0001) {
      _moveDir
        ..x = dx / len
        ..y = dy / len;
    } else {
      _moveDir.setZero();
    }
  }

  /// Ends the drag; the player stops moving.
  void onJoystickEnd() {
    _joystickActive = false;
    _moveDir.setZero();
  }

  // ---- Main update ------------------------------------------------------
  double _invulnTimer = 0;

  @override
  void update(double dt) {
    super.update(dt); // updates camera + component render transforms
    if (_paused || run.gameOver) return;

    // Clamp dt so a hitch (e.g. app resume) can't teleport everything.
    if (dt > 0.05) dt = 0.05;

    run.elapsed += dt;

    _updatePlayer(dt);
    _updateInvulnerability(dt);
    _updateSpawns(dt);
    _updateEnemies(dt);
    _updateFiring(dt);
    _updateProjectiles(dt);

    // Rebuild the spatial hash AFTER movement, BEFORE collision queries.
    spatialHash.rebuild(enemyPool.all);
    _resolveProjectileHits();
    _resolveEnemyContact(dt);

    _updateGems(dt);

    _checkEndConditions();
  }

  void _updatePlayer(double dt) {
    // length2 == 0 means no direction (stick centered / not dragging).
    if (_joystickActive && _moveDir.length2 > 0) {
      final speed = stats.moveSpeed;
      player.position.x += _moveDir.x * speed * dt;
      player.position.y += _moveDir.y * speed * dt;
      player.facing = math.atan2(_moveDir.y, _moveDir.x);
    }
  }

  void _updateInvulnerability(double dt) {
    if (_invulnTimer > 0) {
      _invulnTimer -= dt;
      player.invulnerable = _invulnTimer > 0;
    }
  }

  void _updateSpawns(double dt) {
    // Compute the world-space top-left of the visible viewport for edge spawns.
    final vp = camera.viewport.size;
    _camTopLeft
      ..setFrom(player.position)
      ..x -= vp.x / 2
      ..y -= vp.y / 2;

    spawnDirector.update(
      dt,
      run.difficultyTier,
      _camTopLeft,
      vp,
      enemyPool.activeCount,
      (def, pos, hp) {
        final e = enemyPool.obtain();
        e.spawn(def, pos, hp);
      },
    );
  }

  void _updateEnemies(double dt) {
    final list = enemyPool.all;
    for (var i = 0; i < list.length; i++) {
      final e = list[i];
      if (!e.isActive) continue;
      e.moveToward(player.position, dt);
    }
  }

  // ---- Firing: nearest-enemy targeting ---------------------------------
  void _updateFiring(double dt) {
    final lvl = stats.weaponLevel.clamp(1, weapon.maxLevel);
    final s = weapon.statsForLevel(lvl);
    final interval = s.fireInterval / stats.fireRateMult;

    _fireTimer -= dt;
    if (_fireTimer > 0) return;
    _fireTimer = interval;

    final target = _findNearestEnemy();
    if (target == null) return;

    _fireDir
      ..setFrom(target.position)
      ..sub(player.position);
    final len = _fireDir.length;
    if (len < 0.0001) return;
    _fireDir.scale(1 / len);

    final dmg = s.damage * stats.damageMult;

    // Fire `projectiles` bolts in a small spread when >1.
    final count = s.projectiles;
    const spread = 0.12; // radians between bolts
    final startAngle =
        math.atan2(_fireDir.y, _fireDir.x) - spread * (count - 1) / 2;
    for (var i = 0; i < count; i++) {
      final ang = startAngle + spread * i;
      final dir = Vector2(math.cos(ang), math.sin(ang));
      final proj = projectilePool.obtain();
      proj.fire(
        origin: player.position,
        dir: dir,
        speed: weapon.projectileSpeed,
        dmg: dmg,
        rad: weapon.projectileRadius,
        life: weapon.projectileLifetime,
        pierce: weapon.pierce,
        col: weapon.color,
      );
    }
  }

  Enemy? _findNearestEnemy() {
    // Query cells around the player within a generous radius first (cheap);
    // fall back to a wider scan only if nothing nearby.
    Enemy? best;
    var bestDistSq = double.infinity;

    // Two expanding rings keep this cheap in the common case.
    for (final radius in const [220.0, 600.0]) {
      spatialHash.queryInto(player.position, radius, _queryBuf);
      for (var i = 0; i < _queryBuf.length; i++) {
        final e = _queryBuf[i];
        final d = SpatialHash.distanceSq(e.position, player.position);
        if (d < bestDistSq) {
          bestDistSq = d;
          best = e;
        }
      }
      if (best != null) break;
    }
    return best;
  }

  void _updateProjectiles(double dt) {
    final list = projectilePool.all;
    for (var i = 0; i < list.length; i++) {
      final p = list[i];
      if (!p.isActive) continue;
      if (!p.advance(dt)) {
        projectilePool.release(p);
      }
    }
  }

  // ---- Collisions using the spatial hash --------------------------------
  void _resolveProjectileHits() {
    final projs = projectilePool.all;
    for (var i = 0; i < projs.length; i++) {
      final p = projs[i];
      if (!p.isActive) continue;

      spatialHash.queryInto(p.position, p.radius + 24, _queryBuf);
      for (var j = 0; j < _queryBuf.length; j++) {
        final e = _queryBuf[j];
        if (!e.isActive) continue;
        final rr = p.radius + e.data.radius;
        if (SpatialHash.distanceSq(p.position, e.position) <= rr * rr) {
          final killed = e.applyDamage(p.damage);
          if (killed) {
            _onEnemyKilled(e);
          }
          if (p.pierceLeft > 0) {
            p.pierceLeft -= 1;
          } else {
            projectilePool.release(p);
            break; // this projectile is done
          }
        }
      }
    }
  }

  void _resolveEnemyContact(double dt) {
    if (_invulnTimer > 0) return; // still invulnerable, skip damage
    spatialHash.queryInto(
      player.position,
      GameConfig.playerRadius + 30,
      _queryBuf,
    );
    for (var i = 0; i < _queryBuf.length; i++) {
      final e = _queryBuf[i];
      if (!e.isActive) continue;
      final rr = GameConfig.playerRadius + e.data.radius;
      if (SpatialHash.distanceSq(player.position, e.position) <= rr * rr) {
        _damagePlayer(e.data.contactDamage);
        break; // one hit per invulnerability window
      }
    }
  }

  void _damagePlayer(double amount) {
    run.hp -= amount;
    _invulnTimer = GameConfig.hitInvulnerabilitySeconds;
    player.invulnerable = true;
    if (run.hp <= 0) {
      run.hp = 0;
      _triggerGameOver();
    }
  }

  void _onEnemyKilled(Enemy e) {
    run.kills += 1;
    // Drop an XP gem at the enemy position.
    final gem = gemPool.obtain();
    gem.spawn(e.position, e.data.xp);
    enemyPool.release(e);
  }

  void _updateGems(double dt) {
    final list = gemPool.all;
    var levelUps = 0;
    for (var i = 0; i < list.length; i++) {
      final g = list[i];
      if (!g.isActive) continue;
      final collected =
          g.updateTowardPlayer(player.position, stats.magnetRadius, dt);
      if (collected) {
        levelUps += run.addXp(g.xpValue);
        gemPool.release(g);
      }
    }
    if (levelUps > 0 && !run.gameOver) {
      _triggerLevelUp();
    }
  }

  // ---- Level-up ---------------------------------------------------------
  /// The 3 choices currently offered. Read by the level-up overlay.
  List<UpgradeData> currentChoices = const [];

  void _triggerLevelUp() {
    currentChoices = _rollUpgradeChoices(3);
    pauseEngine();
    overlays.add(Overlays.levelUp);
  }

  /// Picks [count] distinct upgrades that still have stacks remaining.
  List<UpgradeData> _rollUpgradeChoices(int count) {
    final pool = data.upgrades.where((u) {
      // Weapon-level upgrade only offered while below max weapon level.
      if (u.stat == 'weaponLevel') {
        return stats.weaponLevel < weapon.maxLevel;
      }
      return stats.stacksOf(u.id) < u.maxStacks;
    }).toList();

    pool.shuffle(_rng);
    if (pool.length <= count) return pool;
    return pool.sublist(0, count);
  }

  /// Called by the level-up overlay when the player taps a card.
  void chooseUpgrade(UpgradeData upgrade) {
    stats.apply(upgrade.stat, upgrade.amount, upgrade.id);
    // Max HP upgrades also heal by the same amount, and update run.maxHp.
    if (upgrade.stat == 'maxHpFlat') {
      run.maxHp = stats.maxHp;
      run.hp = math.min(run.maxHp, run.hp + upgrade.amount);
    }
    overlays.remove(Overlays.levelUp);
    resumeEngine();
  }

  // ---- End conditions ---------------------------------------------------
  void _checkEndConditions() {
    if (run.elapsed >= GameConfig.runDurationSeconds && !run.gameOver) {
      // Survived the full run — treat as a win for the prototype.
      _triggerGameOver(victory: true);
    }
  }

  bool lastRunVictory = false;

  void _triggerGameOver({bool victory = false}) {
    run.gameOver = true;
    lastRunVictory = victory;
    pauseEngine();
    overlays.add(Overlays.gameOver);
  }
}
