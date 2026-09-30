import 'dart:math' as math;

import 'package:flame/components.dart' show Vector2;

import '../models/enemy_data.dart';
import '../services/game_config.dart';

/// Decides WHAT, WHEN, and WHERE enemies spawn.
///
///  - Spawn interval shrinks every difficulty tier (spawnIntervalDecay^tier),
///    floored at minSpawnInterval so it never runs away.
///  - Enemy HP scales up per tier (hpGrowthPerTier).
///  - Enemies spawn just outside the visible rect so they walk on-screen.
///  - Type is chosen by weighted random from the enemy definitions.
///
/// The director is pure logic: it tells the game "spawn this EnemyData at this
/// position with this HP". The game handles pooling and adding to the world.
class SpawnDirector {
  final List<EnemyData> _types;
  final List<double> _cumulativeWeights = [];
  double _totalWeight = 0;
  final math.Random _rng;

  double _timer = 0;

  SpawnDirector(Map<String, EnemyData> enemies, {math.Random? rng})
      : _types = enemies.values.toList(),
        _rng = rng ?? math.Random() {
    for (final t in _types) {
      _totalWeight += t.weight;
      _cumulativeWeights.add(_totalWeight);
    }
  }

  /// Current spawn interval for a given difficulty [tier].
  double _intervalForTier(int tier) {
    final scaled = GameConfig.baseSpawnInterval *
        math.pow(GameConfig.spawnIntervalDecay, tier);
    return math.max(GameConfig.minSpawnInterval, scaled.toDouble());
  }

  /// HP multiplier for a given [tier].
  double hpMultiplier(int tier) => 1.0 + GameConfig.hpGrowthPerTier * tier;

  /// Picks a weighted-random enemy type.
  EnemyData _pickType() {
    final roll = _rng.nextDouble() * _totalWeight;
    for (var i = 0; i < _cumulativeWeights.length; i++) {
      if (roll <= _cumulativeWeights[i]) return _types[i];
    }
    return _types.last;
  }

  /// A point just outside the given world-space visible rectangle.
  /// [camTopLeft] is the world coordinate of the screen's top-left corner and
  /// [viewSize] is the visible size in world units.
  Vector2 _spawnPointOutside(Vector2 camTopLeft, Vector2 viewSize) {
    const margin = 40.0;
    final side = _rng.nextInt(4);
    switch (side) {
      case 0: // top
        return Vector2(
          camTopLeft.x + _rng.nextDouble() * viewSize.x,
          camTopLeft.y - margin,
        );
      case 1: // bottom
        return Vector2(
          camTopLeft.x + _rng.nextDouble() * viewSize.x,
          camTopLeft.y + viewSize.y + margin,
        );
      case 2: // left
        return Vector2(
          camTopLeft.x - margin,
          camTopLeft.y + _rng.nextDouble() * viewSize.y,
        );
      default: // right
        return Vector2(
          camTopLeft.x + viewSize.x + margin,
          camTopLeft.y + _rng.nextDouble() * viewSize.y,
        );
    }
  }

  /// Advances the director. When a spawn is due it invokes [spawn] once per
  /// enemy in the batch. Respects [aliveCount] against the global cap.
  void update(
    double dt,
    int tier,
    Vector2 camTopLeft,
    Vector2 viewSize,
    int aliveCount,
    void Function(EnemyData def, Vector2 pos, double hp) spawn,
  ) {
    _timer -= dt;
    if (_timer > 0) return;
    _timer = _intervalForTier(tier);

    final batch = GameConfig.spawnBatchForTier(tier);
    final mult = hpMultiplier(tier);
    for (var i = 0; i < batch; i++) {
      if (aliveCount + i >= GameConfig.maxAliveEnemies) break;
      final type = _pickType();
      final pos = _spawnPointOutside(camTopLeft, viewSize);
      spawn(type, pos, type.baseHp * mult);
    }
  }

  void reset() => _timer = 0;
}
