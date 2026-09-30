import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import '../models/enemy_data.dart';
import '../models/upgrade_data.dart';
import '../models/weapon_data.dart';

/// Loads all data-driven definitions from assets/data/*.json once at startup.
///
/// The game reads these maps/lists in memory afterwards, so there are no
/// per-frame allocations or repeated asset reads during play. Call [load]
/// before starting the game (see main.dart / GameScreen bootstrap).
class GameData {
  final Map<String, WeaponData> weapons;
  final Map<String, EnemyData> enemies;
  final List<UpgradeData> upgrades;

  const GameData({
    required this.weapons,
    required this.enemies,
    required this.upgrades,
  });

  /// Convenience: the starting weapon for the prototype.
  WeaponData get plasmaPistol => weapons['plasma_pistol']!;

  static Future<GameData> load() async {
    final weaponsRaw = await rootBundle.loadString('assets/data/weapons.json');
    final enemiesRaw = await rootBundle.loadString('assets/data/enemies.json');
    final upgradesRaw =
        await rootBundle.loadString('assets/data/upgrades.json');

    final weaponsJson = json.decode(weaponsRaw) as Map<String, dynamic>;
    final enemiesJson = json.decode(enemiesRaw) as Map<String, dynamic>;
    final upgradesJson = json.decode(upgradesRaw) as Map<String, dynamic>;

    final weapons = <String, WeaponData>{};
    weaponsJson.forEach((key, value) {
      weapons[key] = WeaponData.fromJson(value as Map<String, dynamic>);
    });

    final enemies = <String, EnemyData>{};
    enemiesJson.forEach((key, value) {
      enemies[key] = EnemyData.fromJson(value as Map<String, dynamic>);
    });

    final upgrades = (upgradesJson['upgrades'] as List<dynamic>)
        .map((e) => UpgradeData.fromJson(e as Map<String, dynamic>))
        .toList();

    return GameData(weapons: weapons, enemies: enemies, upgrades: upgrades);
  }
}
