import 'dart:ui' show Color;

import '../services/color_utils.dart';

/// A single upgrade option that can appear on the level-up screen.
///
/// [stat] is the run-modifier key applied when chosen (see PlayerStats).
/// [amount] is the magnitude per stack; [maxStacks] caps how many times it
/// can be offered/taken so the pool stays fresh.
class UpgradeData {
  final String id;
  final String name;
  final String description;
  final String icon;
  final Color color;
  final String stat;
  final double amount;
  final int maxStacks;

  const UpgradeData({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.color,
    required this.stat,
    required this.amount,
    required this.maxStacks,
  });

  factory UpgradeData.fromJson(Map<String, dynamic> json) {
    return UpgradeData(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      icon: json['icon'] as String,
      color: colorFromHex(json['color'] as String),
      stat: json['stat'] as String,
      amount: (json['amount'] as num).toDouble(),
      maxStacks: (json['maxStacks'] as num).toInt(),
    );
  }
}
