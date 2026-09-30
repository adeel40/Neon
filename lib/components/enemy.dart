import 'dart:ui';

import 'package:flame/components.dart';

import '../models/enemy_data.dart';
import '../systems/object_pool.dart';

/// A pooled enemy. Never created/destroyed during play — only activated and
/// deactivated. When active it chases the player each frame.
///
/// Rendering is a glowing neon circle (pure Canvas). We keep paints as fields
/// so no Paint is allocated per frame.
class Enemy extends PositionComponent implements Poolable {
  Enemy() : super(anchor: Anchor.center);

  // ---- Poolable ---------------------------------------------------------
  bool _active = false;
  @override
  bool get isActive => _active;
  @override
  set isActive(bool value) => _active = value;

  // ---- Runtime state ----------------------------------------------------
  late EnemyData data;
  double hp = 1;
  double maxHp = 1;

  final Vector2 velocity = Vector2.zero();
  final Vector2 _toPlayer = Vector2.zero();

  final Paint _glowPaint = Paint()
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
  final Paint _bodyPaint = Paint()..style = PaintingStyle.fill;
  final Paint _ringPaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2;

  /// Activates this enemy at [spawnPos] using [def] with a scaled HP value.
  void spawn(EnemyData def, Vector2 spawnPos, double scaledHp) {
    data = def;
    hp = scaledHp;
    maxHp = scaledHp;
    position.setFrom(spawnPos);
    size = Vector2.all(def.radius * 2);
    velocity.setZero();
    isActive = true;
  }

  /// Moves toward [playerPos]. Called by the game each tick (not Flame's update
  /// tree, so we control ordering and can skip inactive enemies cheaply).
  void moveToward(Vector2 playerPos, double dt) {
    _toPlayer
      ..setFrom(playerPos)
      ..sub(position);
    final len = _toPlayer.length;
    if (len > 0.0001) {
      _toPlayer.scale(1 / len); // normalize without allocating
    }
    velocity
      ..setFrom(_toPlayer)
      ..scale(data.speed);
    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
  }

  /// Applies [amount] damage. Returns true if this hit killed the enemy.
  bool applyDamage(double amount) {
    hp -= amount;
    return hp <= 0;
  }

  @override
  void render(Canvas canvas) {
    if (!isActive) return;
    final r = data.radius;
    final center = Offset(r, r); // component origin is top-left

    _glowPaint.color = data.color.withValues(alpha: 0.85);
    canvas.drawCircle(center, r, _glowPaint);

    _bodyPaint.color = data.color.withValues(alpha: 0.55);
    canvas.drawCircle(center, r * 0.8, _bodyPaint);

    _ringPaint.color = data.color;
    canvas.drawCircle(center, r * 0.8, _ringPaint);

    // Thin HP arc shown only when damaged, so full-HP hordes stay clean.
    if (hp < maxHp) {
      final frac = (hp / maxHp).clamp(0.0, 1.0);
      _ringPaint.color = const Color(0xFF00FF9C);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: r + 3),
        -1.5708, // start at top (-90 deg)
        6.28318 * frac,
        false,
        _ringPaint,
      );
    }
  }
}
