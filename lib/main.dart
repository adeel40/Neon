import 'package:flame/flame.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'ui/game_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait — this is a one-hand portrait game.
  await Flame.device.setPortrait();

  // Fullscreen immersive: hide system status/nav bars for an edge-to-edge feel.
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  runApp(const NeonHordeApp());
}

class NeonHordeApp extends StatelessWidget {
  const NeonHordeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'NEON HORDE: Last Signal',
      debugShowCheckedModeBanner: false,
      home: GameScreen(),
    );
  }
}
