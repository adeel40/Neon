import 'package:flutter/material.dart';

import '../game/neon_horde_game.dart';

/// Shown at death or at the 10-minute survival mark. Displays run stats and a
/// RESTART button that resets in <2s (no asset reload — see game.restart()).
class GameOverOverlay extends StatelessWidget {
  final NeonHordeGame game;
  const GameOverOverlay({super.key, required this.game});

  @override
  Widget build(BuildContext context) {
    final run = game.run;
    final win = game.lastRunVictory;
    final accent = win ? const Color(0xFF00FF9C) : const Color(0xFFFF2E97);

    return Container(
      color: Colors.black.withValues(alpha: 0.85),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  win ? 'SIGNAL SENT' : 'CONNECTION LOST',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: accent,
                    fontSize: 36,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 3,
                    shadows: [Shadow(color: accent, blurRadius: 18)],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  win ? 'You survived 10:00' : 'You were overrun',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
                ),
                const SizedBox(height: 28),
                _StatRow(label: 'Survived', value: run.formattedTime),
                _StatRow(label: 'Level reached', value: '${run.level}'),
                _StatRow(label: 'Kills', value: '${run.kills}'),
                const SizedBox(height: 28),
                GestureDetector(
                  onTap: game.restart,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 48, vertical: 16),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: accent, width: 2.5),
                      boxShadow: [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.5),
                          blurRadius: 18,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: Text(
                      'RESTART',
                      style: TextStyle(
                        color: accent,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 3,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final String value;
  const _StatRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 16,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
