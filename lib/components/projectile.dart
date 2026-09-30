import 'dart:ui';

import 'package:flame/components.dart';

import '../systems/object_pool.dart';

/// A pooled weapon projectile. Travels in a straight line, deals [damage] on
/// hit, and can [pierce] a number of enemies before deactivating. Lifetime is
/// capped so off-screen bolts return to the pool.
class Projectile extends PositionComponent implements Poolable {
  Projectile() : super(anchor: Anchor.center);

  bool _active = false;
  @override
  bool get isActive => _active;
  @override
  set isActive(bool value) => _active = value;

  final Vector2 velocity = Vector2.zero();
  double damage = 0;
  double radius = 4;
  double lifetime = 0; // remaining seconds
  int pierceLeft = 0;
  Color color = const Color(0xFF00E5FF);

  final Paint _glowPaint = Paint()
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5);
  final Paint _corePaint = Paint()..style = PaintingStyle.fill;

  /// Fires the projectile from [origin] toward [dir] (unit vector expected).
  void fire({
    required Vector2 origin,
    required Vector2 dir,
    required double speed,
    required double dmg,
    required double rad,
    required double life,
    required int pierce,
    required Color col,
  }) {
    position.setFrom(origin);
    velocity
      ..setFrom(dir)
      ..scale(speed);
    damage = dmg;
    radius = rad;
    lifetime = life;
    pierceLeft = pierce;
    color = col;
    size = Vector2.all(rad * 2);
    isActive = true;
  }

  /// Advances the projectile. Returns false when it should be released
  /// (lifetime elapsed).
  bool advance(double dt) {
    lifetime -= dt;
    if (lifetime <= 0) return false;
    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
    return true;
  }

  @override
  void render(Canvas canvas) {
    if (!isActive) return;
    final center = Offset(radius, radius);
    _glowPaint.color = color.withValues(alpha: 0.9);
    canvas.drawCircle(center, radius * 1.4, _glowPaint);
    _corePaint.color = const Color(0xFFFFFFFF);
    canvas.drawCircle(center, radius, _corePaint);
  }
}
