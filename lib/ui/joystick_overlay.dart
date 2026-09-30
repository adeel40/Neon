import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show Ticker;

import '../game/neon_horde_game.dart';

/// Draws the floating joystick where the thumb touched. This is a Flutter
/// overlay (not a Flame component) rebuilt each frame via a ticker so it
/// tracks the drag smoothly. It reads the joystick state exposed by the game.
class JoystickOverlay extends StatefulWidget {
  final NeonHordeGame game;
  const JoystickOverlay({super.key, required this.game});

  @override
  State<JoystickOverlay> createState() => _JoystickOverlayState();
}

class _JoystickOverlayState extends State<JoystickOverlay>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;

  @override
  void initState() {
    super.initState();
    // Repaint each frame so the stick follows the drag.
    _ticker = createTicker((_) {
      if (mounted) setState(() {});
    })..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // IgnorePointer: input is handled by the game's PanDetector underneath.
    return IgnorePointer(
      child: CustomPaint(
        size: Size.infinite,
        painter: _JoystickPainter(widget.game),
      ),
    );
  }
}

class _JoystickPainter extends CustomPainter {
  final NeonHordeGame game;
  _JoystickPainter(this.game);

  @override
  void paint(Canvas canvas, Size size) {
    if (!game.joystickActive) return;

    final origin = Offset(game.joystickOrigin.x, game.joystickOrigin.y);

    // Clamp the knob to the max radius from the origin.
    var dx = game.joystickCurrent.x - game.joystickOrigin.x;
    var dy = game.joystickCurrent.y - game.joystickOrigin.y;
    final maxR = game.joystickMaxRadius;
    final len = math.sqrt(dx * dx + dy * dy);
    if (len > maxR && len > 0) {
      final scale = maxR / len;
      dx *= scale;
      dy *= scale;
    }
    final knob = origin + Offset(dx, dy);

    const baseColor = Color(0xFF00E5FF);

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..color = baseColor.withValues(alpha: 0.35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    canvas.drawCircle(origin, maxR, ring);

    final knobGlow = Paint()
      ..color = baseColor.withValues(alpha: 0.9)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
    canvas.drawCircle(knob, 26, knobGlow);

    final knobCore = Paint()..color = baseColor;
    canvas.drawCircle(knob, 20, knobCore);
  }

  @override
  bool shouldRepaint(covariant _JoystickPainter oldDelegate) => true;
}
