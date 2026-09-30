import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show Ticker;

import '../game/neon_horde_game.dart';

/// Top-of-screen HUD: HP bar, XP bar, run timer, kill count, pause button.
/// Rebuilds each frame via a ticker so bars/timer stay live.
class HudOverlay extends StatefulWidget {
  final NeonHordeGame game;
  const HudOverlay({super.key, required this.game});

  @override
  State<HudOverlay> createState() => _HudOverlayState();
}

class _HudOverlayState extends State<HudOverlay>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;

  @override
  void initState() {
    super.initState();
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
    final run = widget.game.run;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // XP bar (full width, thin, top).
            _NeonBar(
              value: run.xpProgress,
              color: const Color(0xFF00FF9C),
              height: 8,
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                // HP bar takes most of the row.
                Expanded(
                  child: _NeonBar(
                    value: run.hpProgress,
                    color: run.hpProgress > 0.3
                        ? const Color(0xFF00E5FF)
                        : const Color(0xFFFF2E97),
                    height: 14,
                    label:
                        'HP ${run.hp.ceil()}/${run.maxHp.ceil()}',
                  ),
                ),
                const SizedBox(width: 10),
                // Pause button.
                _NeonButton(
                  icon: widget.game.isPausedManually
                      ? Icons.play_arrow
                      : Icons.pause,
                  onTap: widget.game.togglePause,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _Stat(label: 'LV', value: '${run.level}'),
                _Stat(label: 'TIME', value: run.formattedTime),
                _Stat(label: 'KILLS', value: '${run.kills}'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _NeonBar extends StatelessWidget {
  final double value; // 0..1
  final Color color;
  final double height;
  final String? label;

  const _NeonBar({
    required this.value,
    required this.color,
    required this.height,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          height: height,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(height / 2),
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: value.clamp(0.0, 1.0),
            child: Container(
              height: height,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(height / 2),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.7),
                    blurRadius: 8,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (label != null)
          Text(
            label!,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              shadows: [Shadow(color: Colors.black, blurRadius: 2)],
            ),
          ),
      ],
    );
  }
}

class _NeonButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _NeonButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF00E5FF), width: 1.5),
        ),
        child: Icon(icon, color: const Color(0xFF00E5FF), size: 22),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.6),
            fontSize: 9,
            letterSpacing: 1.5,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
            shadows: [Shadow(color: Color(0xFF00E5FF), blurRadius: 6)],
          ),
        ),
      ],
    );
  }
}
