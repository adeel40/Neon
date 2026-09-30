import 'dart:ui' show Color;

import '../services/color_utils.dart';

/// Definition of an enemy type, loaded from enemies.json.
///
/// [weight] controls how often this type is chosen by the spawn director
/// relative to the other types (weighted random selection).
class EnemyData {
  final String id;
  final String name;
  final Color color;
  final double radius;
  final double baseHp;
  final double speed;
  final double contactDamage;
  final int xp;
  final double weight;

  const EnemyData({
    required this.id,
    required this.name,
    required this.color,
    required this.radius,
    required this.baseHp,
    required this.speed,
    required this.contactDamage,
    required this.xp,
    required this.weight,
  });

  factory EnemyData.fromJson(Map<String, dynamic> json) {
    return EnemyData(
      id: json['id'] as String,
      name: json['name'] as String,
      color: colorFromHex(json['color'] as String),
      radius: (json['radius'] as num).toDouble(),
      baseHp: (json['baseHp'] as num).toDouble(),
      speed: (json['speed'] as num).toDouble(),
      contactDamage: (json['contactDamage'] as num).toDouble(),
      xp: (json['xp'] as num).toInt(),
      weight: (json['weight'] as num).toDouble(),
    );
  }
}
