/// Central place for tunable game constants and the XP/level curve.
///
/// Keeping these in one file (rather than scattered magic numbers) makes
/// balancing a single-file edit. Anything data-driven per-entity lives in
/// the JSON files instead; this is for global run rules.
class GameConfig {
  GameConfig._();

  /// Length of a run in seconds (10 minutes).
  static const double runDurationSeconds = 600.0;

  /// Player defaults (base, before upgrades).
  static const double playerBaseMaxHp = 100.0;
  static const double playerBaseMoveSpeed = 140.0; // logical px/s
  static const double playerRadius = 12.0;
  static const double playerBaseMagnetRadius = 60.0;

  /// Seconds of invulnerability after taking a hit.
  static const double hitInvulnerabilitySeconds = 0.6;

  /// XP gem behavior.
  static const double gemRadius = 5.0;

  /// When a gem is within the magnet radius it accelerates toward the player.
  static const double gemMagnetSpeed = 420.0;

  /// Spawn director.
  static const double baseSpawnInterval = 1.10; // seconds between spawns at t=0
  static const double minSpawnInterval = 0.14; // hard floor so it never explodes
  static const int maxAliveEnemies = 350; // safety cap for perf target

  /// Every [difficultyStepSeconds] the difficulty tier increases by 1.
  static const double difficultyStepSeconds = 60.0;

  /// Per-tier multipliers applied by the spawn director.
  /// spawnInterval *= spawnIntervalDecay^tier  (faster spawns over time)
  /// enemyHp       *= (1 + hpGrowthPerTier * tier)
  static const double spawnIntervalDecay = 0.86;
  static const double hpGrowthPerTier = 0.18;

  /// How many enemies to spawn per spawn "pulse".
  static int spawnBatchForTier(int tier) => 1 + (tier ~/ 2);

  // ---- XP / Level curve -------------------------------------------------

  /// XP required to go from [level] to [level]+1.
  ///
  /// Formula (exact): xpToNext(L) = round(5 + 4*L + 0.55*L^2).
  /// This is gentle early (fast first levels for dopamine) and ramps up.
  ///   L1->2:   10        L5->6:   39        L10->11: 100
  ///   L2->3:   15        L6->7:   49        L20->21: 305
  ///   L3->4:   22        L7->8:   60
  ///   L4->5:   30        L8->9:   72
  static int xpToNext(int level) {
    final l = level.toDouble();
    return (5 + 4 * l + 0.55 * l * l).round();
  }
}
