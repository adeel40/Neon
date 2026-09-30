import 'dart:ui' show Color;

import '../services/color_utils.dart';

/// Stats for a single level of a weapon, loaded from weapons.json.
class WeaponLevelStats {
  final int level;
  final double damage;

  /// Seconds between shots at this level (lower = faster).
  final double fireInterval;

  /// How many projectiles are fired per shot.
  final int projectiles;

  const WeaponLevelStats({
    required this.level,
    required this.damage,
    required this.fireInterval,
    required this.projectiles,
  });

  factory WeaponLevelStats.fromJson(Map<String, dynamic> json) {
    return WeaponLevelStats(
      level: (json['level'] as num).toInt(),
      damage: (json['damage'] as num).toDouble(),
      fireInterval: (json['fireInterval'] as num).toDouble(),
      projectiles: (json['projectiles'] as num).toInt(),
    );
  }
}

/// Full definition of a weapon, including every level's stats.
class WeaponData {
  final String id;
  final String name;
  final String description;
  final Color color;
  final double projectileSpeed;
  final double projectileRadius;
  final double projectileLifetime;
  final int pierce;
  final List<WeaponLevelStats> levels;

  const WeaponData({
    required this.id,
    required this.name,
    required this.description,
    required this.color,
    required this.projectileSpeed,
    required this.projectileRadius,
    required this.projectileLifetime,
    required this.pierce,
    required this.levels,
  });

  /// Max weapon level available (1-based).
  int get maxLevel => levels.length;

  /// Returns stats for [level], clamped to the valid range.
  WeaponLevelStats statsForLevel(int level) {
    final clamped = level.clamp(1, levels.length);
    return levels[clamped - 1];
  }

  factory WeaponData.fromJson(Map<String, dynamic> json) {
    final levelList = (json['levels'] as List<dynamic>)
        .map((e) => WeaponLevelStats.fromJson(e as Map<String, dynamic>))
        .toList();
    return WeaponData(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      color: colorFromHex(json['color'] as String),
      projectileSpeed: (json['projectileSpeed'] as num).toDouble(),
      projectileRadius: (json['projectileRadius'] as num).toDouble(),
      projectileLifetime: (json['projectileLifetime'] as num).toDouble(),
      pierce: (json['pierce'] as num).toInt(),
      levels: levelList,
    );
  }
}
