# NEON HORDE: Last Signal — Phase 1 Setup

This document has everything you need to turn the `lib/` + `assets/` code in
this repo into a runnable Flutter project. I do **not** pin package versions —
run the `flutter pub add` commands below so pub.dev resolves current, mutually
compatible versions for your Flutter SDK.

---

## 1. Create the Flutter project shell

If you're starting from an empty machine, create the project, then copy the
`lib/` and `assets/` folders from here into it. If you already have a project,
skip to step 2.

```bash
# Latest stable Flutter assumed. Check: flutter --version
flutter create --org com.neonhorde --platforms=android neon_horde
cd neon_horde
```

> Portrait/one-hand Android is the Phase 1 target. iOS/web can be added later;
> `--platforms=android` keeps the scaffold lean for now.

Then copy these into the new project root, replacing the generated ones:
- `lib/`   (all of it)
- `assets/` (the `assets/data/*.json` files)

---

## 2. Add dependencies (versions resolved by pub.dev)

Run these **in the project root**. `flutter pub add` picks the newest version
compatible with your SDK and writes it into `pubspec.yaml` for you.

```bash
# Core engine + state + storage used in Phase 1 and beyond.
flutter pub add flame
flutter pub add flutter_riverpod
flutter pub add hive
flutter pub add hive_flutter

# Dev-only codegen for Hive type adapters (we'll use these in a later phase).
flutter pub add --dev hive_generator
flutter pub add --dev build_runner
```

> Phase 1 only actually imports `flame` and Flutter SDK packages. `riverpod`
> and `hive` are added now so the project structure is ready for meta-progression
> and settings in later phases — nothing in Phase 1 code will break if you defer
> the Hive/Riverpod adds, but adding them now avoids churn.

After adding, fetch everything:

```bash
flutter pub get
```

---

## 3. `pubspec.yaml` — assets section

`flutter pub add` handles the `dependencies:` block. You must manually add the
**assets** declaration under `flutter:` so the JSON data files are bundled.
Your `pubspec.yaml` should contain (indentation matters — 2 spaces):

```yaml
flutter:
  uses-material-design: true
  assets:
    - assets/data/weapons.json
    - assets/data/enemies.json
    - assets/data/upgrades.json
```

> When you add real art later, add `assets/images/` (a trailing-slash directory
> entry bundles everything inside it).

---

## 4. AndroidManifest — portrait lock + fullscreen immersive

Portrait lock and immersive mode are applied **at runtime** in `lib/main.dart`
(`Flame.device.setPortrait()` and `SystemChrome.setEnabledSystemUIMode(...)`),
which is the most reliable cross-device approach. To also lock it at the OS
level (prevents a brief rotation flash on some launchers), edit:

`android/app/src/main/AndroidManifest.xml`

Add `android:screenOrientation="portrait"` to the `<activity>` tag:

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTop"
    android:screenOrientation="portrait"
    android:theme="@style/LaunchTheme"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
    android:hardwareAccelerated="true"
    android:windowSoftInputMode="adjustResize">
```

> Keep the existing `android:configChanges` value your `flutter create` produced
> — just append `android:screenOrientation="portrait"`. The runtime immersive
> call in `main.dart` handles hiding the status/nav bars; no manifest change is
> needed for that.

---

## 5. Folder structure under `lib/`

```
lib/
├── main.dart                     # entry: portrait lock, immersive, runApp
├── game/
│   └── neon_horde_game.dart      # FlameGame: loop, pools, collisions, firing
├── components/                   # Flame components (drawn in the world)
│   ├── player.dart
│   ├── enemy.dart                # poolable
│   ├── projectile.dart           # poolable
│   └── xp_gem.dart               # poolable
├── systems/                      # pure game logic, no rendering
│   ├── object_pool.dart          # generic pool + Poolable
│   ├── spatial_hash.dart         # uniform-grid broad-phase collisions
│   ├── spawn_director.dart       # what/when/where enemies spawn
│   ├── player_stats.dart         # per-run upgrade modifiers
│   └── run_state.dart            # timer, xp/level, hp, kills
├── services/
│   ├── data_loader.dart          # loads assets/data/*.json once
│   ├── game_config.dart          # global constants + XP curve
│   └── color_utils.dart          # hex -> Color
├── models/                       # typed views of the JSON data
│   ├── weapon_data.dart
│   ├── enemy_data.dart
│   └── upgrade_data.dart
└── ui/                           # Flutter overlays (above the game canvas)
    ├── game_screen.dart          # GameWidget + overlays + gesture input
    ├── hud_overlay.dart          # HP/XP bars, timer, kills, pause
    ├── joystick_overlay.dart     # floating joystick painter
    ├── level_up_overlay.dart     # 3 upgrade cards
    ├── game_over_overlay.dart    # stats + RESTART
    └── debug_overlay.dart        # FPS, entity counts, pool sizes

assets/
└── data/
    ├── weapons.json
    ├── enemies.json
    └── upgrades.json
```

---

## 6. Run it

```bash
flutter analyze          # should be clean (or only style lints)
flutter run              # on a connected Android device/emulator
```

For a quick perf read, run a **profile** build (debug is much slower and not
representative of real FPS):

```bash
flutter run --profile
```
