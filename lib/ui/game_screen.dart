import 'package:flame/game.dart';
import 'package:flutter/material.dart';

import '../game/neon_horde_game.dart';
import '../services/data_loader.dart';
import 'debug_overlay.dart';
import 'game_over_overlay.dart';
import 'hud_overlay.dart';
import 'joystick_overlay.dart';
import 'level_up_overlay.dart';

/// Hosts the GameWidget and registers all overlays. Loads game data once,
/// then builds the game. A small button toggles the debug overlay.
class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late final Future<NeonHordeGame> _gameFuture;

  @override
  void initState() {
    super.initState();
    _gameFuture = _buildGame();
  }

  Future<NeonHordeGame> _buildGame() async {
    final data = await GameData.load();
    return NeonHordeGame(data: data);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B14),
      body: FutureBuilder<NeonHordeGame>(
        future: _gameFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFF00E5FF)),
            );
          }
          final game = snapshot.data!;
          // Pan input is handled by a Flutter GestureDetector (stable API)
          // and forwarded to the game. Overlays render in registration order,
          // so joystick draws under the HUD, which draws under debug.
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onPanStart: (d) =>
                game.onJoystickStart(d.globalPosition.dx, d.globalPosition.dy),
            onPanUpdate: (d) =>
                game.onJoystickUpdate(d.globalPosition.dx, d.globalPosition.dy),
            onPanEnd: (_) => game.onJoystickEnd(),
            onPanCancel: game.onJoystickEnd,
            child: GameWidget<NeonHordeGame>(
              game: game,
              overlayBuilderMap: {
                Overlays.joystick: (_, g) => JoystickOverlay(game: g),
                Overlays.hud: (_, g) => HudOverlay(game: g),
                Overlays.levelUp: (_, g) => LevelUpOverlay(game: g),
                Overlays.gameOver: (_, g) => GameOverOverlay(game: g),
                Overlays.debug: (_, g) => DebugOverlay(game: g),
              },
              initialActiveOverlays: const [
                Overlays.joystick,
                Overlays.hud,
                Overlays.debug,
              ],
            ),
          );
        },
      ),
    );
  }
}
