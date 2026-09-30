import 'dart:ui';

import 'package:flame/components.dart';

import '../services/game_config.dart';
import '../systems/object_pool.dart';

/// A pooled XP gem dropped when an enemy dies. Idles in place until the player
/// comes within magnet range, then accelerates toward the player. Collected on
/// contact.
class XpGem extends PositionComponent implements Poolable {
  XpGem() : super(anchor: Anchor.center);

  bool _active = false;
  @override
  bool get isActive => _active;
  @override
  set isActive(bool value) => _active = value;

  int xpValue = 1;
  bool _magnetized = false;
  final Vector2 _dir = Vector2.zero();

  final Paint _glowPaint = Paint()
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
  final Paint _corePaint = Paint()..style = PaintingStyle.fill;
  final Color _color = const Color(0xFF00FF9C);

  void spawn(Vector2 pos, int value) {
    position.setFrom(pos);
    xpValue = value;
    _magnetized = false;
    size = Vector2.all(GameConfig.gemRadius * 2);
    isActive = true;
  }

  /// Updates gem movement toward [playerPos] if within [magnetRadius].
  /// Returns true if the gem was collected (touching the player).
  bool updateTowardPlayer(Vector2 playerPos, double magnetRadius, double dt) {
    _dir
      ..setFrom(playerPos)
      ..sub(position);
    final distSq = _dir.x * _dir.x + _dir.y * _dir.y;

    // Collected when overlapping the player's pickup core.
    const collectDist = GameConfig.playerRadius + GameConfig.gemRadius;
    if (distSq <= collectDist * collectDist) return true;

    if (_magnetized || distSq <= magnetRadius * magnetRadius) {
      _magnetized = true;
      final len = _dir.length;
      if (len > 0.0001) _dir.scale(1 / len);
      position.x += _dir.x * GameConfig.gemMagnetSpeed * dt;
      position.y += _dir.y * GameConfig.gemMagnetSpeed * dt;
    }
    return false;
  }

  @override
  void render(Canvas canvas) {
    if (!isActive) return;
    final r = GameConfig.gemRadius;
    final center = Offset(r, r);
    _glowPaint.color = _color.withValues(alpha: 0.9);
    canvas.drawCircle(center, r * 1.6, _glowPaint);
    _corePaint.color = _color;
    // Diamond shape for the gem.
    final path = Path()
      ..moveTo(center.dx, center.dy - r)
      ..lineTo(center.dx + r, center.dy)
      ..lineTo(center.dx, center.dy + r)
      ..lineTo(center.dx - r, center.dy)
      ..close();
    canvas.drawPath(path, _corePaint);
  }
}
