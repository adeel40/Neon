import '../services/game_config.dart';

/// Mutable, per-run modifiers applied on top of base values.
///
/// Upgrades mutate these (see UpgradeData.stat keys). Derived getters combine
/// the base constants with the accumulated multipliers/flats so the rest of
/// the game reads final numbers without knowing about upgrade math.
class PlayerStats {
  // Multipliers start at 1.0 (no change); flats start at 0.
  double damageMult = 1.0;
  double fireRateMult = 1.0;
  double moveSpeedMult = 1.0;
  double magnetMult = 1.0;
  double maxHpFlat = 0.0;

  /// Current weapon level (1..maxLevel). Bumped by the "weapon_level" upgrade.
  int weaponLevel = 1;

  /// Tracks how many times each upgrade id has been taken (for maxStacks).
  final Map<String, int> stacks = {};

  double get maxHp => GameConfig.playerBaseMaxHp + maxHpFlat;
  double get moveSpeed => GameConfig.playerBaseMoveSpeed * moveSpeedMult;
  double get magnetRadius => GameConfig.playerBaseMagnetRadius * magnetMult;

  /// Applies a chosen upgrade by its stat key. Returns the new stack count.
  int apply(String stat, double amount, String upgradeId) {
    switch (stat) {
      case 'damageMult':
        damageMult += amount;
        break;
      case 'fireRateMult':
        fireRateMult += amount;
        break;
      case 'moveSpeedMult':
        moveSpeedMult += amount;
        break;
      case 'magnetMult':
        magnetMult += amount;
        break;
      case 'maxHpFlat':
        maxHpFlat += amount;
        break;
      case 'weaponLevel':
        weaponLevel += amount.toInt();
        break;
      default:
        // Unknown stat: ignore rather than crash (data-driven safety).
        break;
    }
    final next = (stacks[upgradeId] ?? 0) + 1;
    stacks[upgradeId] = next;
    return next;
  }

  int stacksOf(String upgradeId) => stacks[upgradeId] ?? 0;

  /// Resets all modifiers to defaults for a fresh run (fast restart).
  void reset() {
    damageMult = 1.0;
    fireRateMult = 1.0;
    moveSpeedMult = 1.0;
    magnetMult = 1.0;
    maxHpFlat = 0.0;
    weaponLevel = 1;
    stacks.clear();
  }
}
