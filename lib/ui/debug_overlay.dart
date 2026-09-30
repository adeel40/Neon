import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show Ticker;

import '../game/neon_horde_game.dart';

/// Bottom-left developer overlay: FPS, active entity counts, and pool
/// utilization. Toggled by a small button (wired in game_screen.dart).
/// FPS is measured here from frame deltas so it doesn't depend on Flame's
/// internal counters.
class DebugOverlay extends StatefulWidget {
  final NeonHordeGame game;
  const DebugOverlay({super.key, required this.game});

  @override
  State<DebugOverlay> createState() => _DebugOverlayState();
}

class _DebugOverlayState extends State<DebugOverlay>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  Duration _last = Duration.zero;

  // Smoothed FPS via exponential moving average.
  double _fps = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((elapsed) {
      if (_last != Duration.zero) {
        final dtMs = (elapsed - _last).inMicroseconds / 1000.0;
        if (dtMs > 0) {
          final instant = 1000.0 / dtMs;
          _fps = _fps == 0 ? instant : _fps * 0.9 + instant * 0.1;
        }
      }
      _last = elapsed;
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
    final g = widget.game;
    final lines = <String>[
      'FPS ${_fps.toStringAsFixed(0)}',
      'enemies ${g.enemyPool.activeCount}/${g.enemyPool.capacity}',
      'proj    ${g.projectilePool.activeCount}/${g.projectilePool.capacity}',
      'gems    ${g.gemPool.activeCount}/${g.gemPool.capacity}',
      'cells   ${g.spatialHash.activeCellCount}',
      'tier    ${g.run.difficultyTier}',
    ];
    return Align(
      alignment: Alignment.bottomLeft,
      child: Padding(
        padding: const EdgeInsets.only(left: 8, bottom: 8),
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF00FF9C), width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: lines
                .map((l) => Text(
                      l,
                      style: const TextStyle(
                        color: Color(0xFF00FF9C),
                        fontSize: 11,
                        fontFamily: 'monospace',
                        height: 1.4,
                      ),
                    ))
                .toList(),
          ),
        ),
      ),
    );
  }
}
