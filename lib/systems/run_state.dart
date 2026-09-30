import '../services/game_config.dart';

/// Holds the live, per-run gameplay state (timer, score, XP, level, HP).
///
/// Kept separate from the Flame game object so the HUD/overlays can read it
/// cheaply and so a restart is just `reset()` — no asset reloads.
class RunState {
  double elapsed = 0.0; // seconds since run start
  int kills = 0;
  int level = 1;
  int xp = 0; // XP toward the current level
  int xpToNext = GameConfig.xpToNext(1);

  double hp = GameConfig.playerBaseMaxHp;
  double maxHp = GameConfig.playerBaseMaxHp;

  bool gameOver = false;

  /// Difficulty tier increases every difficultyStepSeconds.
  int get difficultyTier => (elapsed / GameConfig.difficultyStepSeconds).floor();

  /// Fraction of the current level's XP bar that is filled, 0..1.
  double get xpProgress => xpToNext == 0 ? 0 : (xp / xpToNext).clamp(0.0, 1.0);

  /// Fraction of HP remaining, 0..1.
  double get hpProgress => maxHp == 0 ? 0 : (hp / maxHp).clamp(0.0, 1.0);

  /// Adds XP; returns the number of level-ups triggered this call
  /// (can be >1 if a big gem overflows several levels).
  int addXp(int amount) {
    xp += amount;
    var levelUps = 0;
    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      levelUps += 1;
      xpToNext = GameConfig.xpToNext(level);
    }
    return levelUps;
  }

  /// mm:ss formatted timer for the HUD.
  String get formattedTime {
    final total = elapsed.floor();
    final m = (total ~/ 60).toString().padLeft(2, '0');
    final s = (total % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  /// Resets everything for a new run using the given (possibly upgraded) maxHp.
  void reset(double startingMaxHp) {
    elapsed = 0;
    kills = 0;
    level = 1;
    xp = 0;
    xpToNext = GameConfig.xpToNext(1);
    maxHp = startingMaxHp;
    hp = startingMaxHp;
    gameOver = false;
  }
}
