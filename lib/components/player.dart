import 'dart:ui';

import 'package:flame/components.dart';

import '../services/game_config.dart';
import '../services/color_utils.dart';

/// The player avatar: a neon triangle that points in the movement direction.
///
/// Rendered with pure Canvas + a blurred glow (MaskFilter) so we can test
/// gameplay before real art. Movement is driven by the joystick each frame;
/// the game component owns HP/invulnerability in RunState and toggles the
/// invulnerability flash here.
class Player extends PositionComponent {
  Player() : super(anchor: Anchor.center, priority: 100);

  /// Current facing angle in radians (for drawing the triangle nose).
  double facing = -3.14159 / 2; // pointing "up" by default

  /// Set true while invulnerable so we can flash the sprite.
  bool invulnerable = false;

  /// Ticks up while invulnerable to drive the flash blink.
  double _flashClock = 0;

  final Color _bodyColor = colorFromHex('#00E5FF');
  final Color _coreColor = colorFromHex('#FFFFFF');

  final Paint _glowPaint = Paint()
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
  final Paint _bodyPaint = Paint()..style = PaintingStyle.fill;
  final Paint _corePaint = Paint()..style = PaintingStyle.fill;

  @override
  Future<void> onLoad() async {
    size = Vector2.all(GameConfig.playerRadius * 2);
  }

  @override
  void update(double dt) {
    super.update(dt);
    if (invulnerable) {
      _flashClock += dt;
    } else {
      _flashClock = 0;
    }
  }

  @override
  void render(Canvas canvas) {
    final r = GameConfig.playerRadius;

    // Blink: while invulnerable, skip drawing ~half the time for a flash.
    final visible = !invulnerable || (_flashClock * 12).floor().isEven;
    if (!visible) return;

    // Build a triangle pointing along `facing`, centered on the component.
    final path = Path();
    final nose = Offset(r * 1.2, 0);
    final left = Offset(-r * 0.9, -r * 0.9);
    final right = Offset(-r * 0.9, r * 0.9);

    canvas.save();
    // Component origin is top-left; move to center then rotate to facing.
    canvas.translate(r, r);
    canvas.rotate(facing);
    path.moveTo(nose.dx, nose.dy);
    path.lineTo(left.dx, left.dy);
    path.lineTo(right.dx, right.dy);
    path.close();

    // Glow pass (blurred, semi-transparent), then solid body, then bright core.
    _glowPaint.color = _bodyColor.withValues(alpha: 0.9);
    canvas.drawPath(path, _glowPaint);

    _bodyPaint.color = _bodyColor;
    canvas.drawPath(path, _bodyPaint);

    _corePaint.color = _coreColor;
    canvas.drawCircle(Offset.zero, r * 0.35, _corePaint);
    canvas.restore();
  }
}
