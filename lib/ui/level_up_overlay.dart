import 'package:flutter/material.dart';

import '../game/neon_horde_game.dart';
import '../models/upgrade_data.dart';

/// Modal shown when the player levels up. The engine is paused while this is
/// visible. Presents up to 3 upgrade cards; tapping one applies it and resumes.
class LevelUpOverlay extends StatelessWidget {
  final NeonHordeGame game;
  const LevelUpOverlay({super.key, required this.game});

  @override
  Widget build(BuildContext context) {
    final choices = game.currentChoices;
    return Container(
      color: Colors.black.withValues(alpha: 0.78),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'LEVEL UP',
                style: TextStyle(
                  color: Color(0xFF00FF9C),
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 4,
                  shadows: [Shadow(color: Color(0xFF00FF9C), blurRadius: 16)],
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Level ${game.run.level} — choose an upgrade',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
              ),
              const SizedBox(height: 24),
              ...choices.map((u) => _UpgradeCard(
                    upgrade: u,
                    stacks: game.stats.stacksOf(u.id),
                    onTap: () => game.chooseUpgrade(u),
                  )),
              if (choices.isEmpty)
                // Edge case: everything maxed. Offer a heal-and-continue.
                _UpgradeCard.custom(
                  title: 'Nothing left — carry on!',
                  subtitle: 'Tap to continue',
                  color: const Color(0xFF00E5FF),
                  onTap: () => game.chooseUpgrade(_noop),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // A harmless placeholder upgrade for the "everything maxed" edge case.
  static final UpgradeData _noop = const UpgradeData(
    id: 'noop',
    name: 'Continue',
    description: '',
    icon: 'none',
    color: Color(0xFF00E5FF),
    stat: 'none',
    amount: 0,
    maxStacks: 9999,
  );
}

class _UpgradeCard extends StatelessWidget {
  final UpgradeData? upgrade;
  final int stacks;
  final VoidCallback onTap;
  final String? _title;
  final String? _subtitle;
  final Color _color;

  const _UpgradeCard({
    required this.upgrade,
    required this.stacks,
    required this.onTap,
  })  : _title = null,
        _subtitle = null,
        _color = const Color(0xFF00E5FF);

  const _UpgradeCard.custom({
    required String title,
    required String subtitle,
    required Color color,
    required this.onTap,
  })  : upgrade = null,
        stacks = 0,
        _title = title,
        _subtitle = subtitle,
        _color = color;

  @override
  Widget build(BuildContext context) {
    final color = upgrade?.color ?? _color;
    final title = upgrade?.name ?? _title ?? '';
    final subtitle = upgrade?.description ?? _subtitle ?? '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color, width: 2),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.35),
                blurRadius: 14,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: color, width: 2),
                ),
                child: Icon(_iconFor(upgrade?.icon), color: color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: color,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              if (upgrade != null && stacks > 0)
                Text(
                  'x$stacks',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _iconFor(String? icon) {
    switch (icon) {
      case 'damage':
        return Icons.flash_on;
      case 'firerate':
        return Icons.speed;
      case 'movespeed':
        return Icons.directions_run;
      case 'magnet':
        return Icons.adjust;
      case 'maxhp':
        return Icons.favorite;
      case 'weapon':
        return Icons.gps_fixed;
      default:
        return Icons.star;
    }
  }
}
