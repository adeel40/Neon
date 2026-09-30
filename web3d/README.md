# NEON HORDE: Last Signal — 3D (Three.js / WebGL)

A real-time 3D horde-survivor. You are a lone signal-runner in a neon city;
survive the robot horde for 10 minutes. Auto-firing weapons, XP gems, level-up
choices with reroll/banish, weapon evolutions, combo streaks — rendered in 3D
with bloom, particles, camera shake, hit-stop and slow-mo.

> **Why Three.js and not Flutter?** You asked for a *real 3D* game. Flutter/Flame
> is a 2D engine; genuine 3D at horde scale isn't something it does well. Three.js
> is a real WebGL 3D engine, needs no SDK install, and runs in any modern browser —
> so this is playable immediately. The earlier Flutter prototype lives on the
> `main` branch; this 3D game is on `3d-neon-horde`.

---

## Run it

There is **no build step**. Three.js loads from a CDN via an import map. You just
need to serve the folder over HTTP (ES modules don't load from `file://`).

Pick any one:

```bash
# Python (already on most machines)
cd web3d
python3 -m http.server 8000
# then open http://localhost:8000

# or Node
npx serve web3d

# or VS Code: right-click index.html -> "Open with Live Server"
```

Open the URL, click **START RUN**.

**Controls**
- Desktop: **WASD** or **arrow keys** to move. Weapons fire automatically.
- Touch: **drag anywhere** — a floating joystick appears under your thumb.
- **`** (backtick): toggle the debug overlay (FPS, entity/pool counts).
- **P** or the pause button: pause.

Requires an internet connection on first load (to fetch Three.js from unpkg).
To run fully offline, download `three@0.160.0` locally and change the import map
URLs in `index.html` to point at your local copies.

---

## What's in the game

- **6 weapons** in `config.js` (3 base + 3 evolved): plasma pistol (aimed bolts,
  pierce), orbit drones (circling contact damage), shockwave (expanding ring),
  and their evolutions Plasma Storm / Halo Swarm / Singularity.
- **6 passives**: damage, speed, magnet, cooldown, armor, luck.
- **Evolution**: max a base weapon **and** own its matching passive → it evolves
  into a much stronger form with a slow-mo + particle flourish.
- **Enemy types with distinct AI**: chaser, swarm, tank, exploder (detonates on
  contact for AoE), teleporter (blinks toward you). Weighted spawns that scale
  spawn rate and HP every minute.
- **Level-up UX**: 3 cards, **reroll** and **banish**, rarity colors, and
  **luck-weighted** rarity rolls.
- **Combo / kill-streak** counter with on-screen feedback.
- **Juice**: bloom glow, additive particle bursts, camera shake on hits/explosions,
  hit-stop, slow-mo on evolution.
- **Procedural audio** (Web Audio): adaptive synthwave whose layers fade in as the
  horde grows, plus SFX with pitch variation. No audio files needed.

---

## Performance design (how it holds up with a big horde)

- **InstancedMesh** for enemies, projectiles, and gems: hundreds of entities render
  in a *single draw call each* instead of one mesh per entity.
- **Structure-of-arrays pooling** (`entities.js`): spawning is a free-list pop +
  field writes; death is a push. No per-entity object allocation during play.
- **Spatial hash** (`spatial_hash.js`): broad-phase collisions query only nearby
  grid cells, not every enemy.
- **Particles** are one pooled `THREE.Points` cloud (ring buffer).

Entity cap is `CONFIG.spawn.maxAlive` (default 400), matching the instance buffer.

### Quality tiers (edit in `config.js` / `main.js`)

| Setting                | Low        | Medium      | High        |
|------------------------|------------|-------------|-------------|
| `spawn.maxAlive`       | 150        | 250         | 400         |
| Bloom pass             | off        | on (light)  | on (full)   |
| `renderer` pixelRatio  | 1          | min(dpr,1.5)| min(dpr,2)  |
| Particle capacity      | 500        | 1000        | 1500        |
| Fog                    | on         | on          | on          |

Quick device heuristic: on load, check `navigator.hardwareConcurrency` and
`window.devicePixelRatio`; ≤4 cores or a small screen → Low. This isn't wired to
a settings menu yet (it's a one-line change in `_initThree`); say the word and I'll
add a toggle.

---

## Honest note on shaders (you asked about GLSL / Impeller)

Your original shader questions were about **Flutter's `FragmentProgram` + Impeller**.
This build is **WebGL via Three.js**, so that specific pipeline doesn't apply here.
The mapping is:

- **Neon glow / bloom** — done with Three's `UnrealBloomPass` (a multi-pass GLSL
  bloom). This is the WebGL equivalent of the bloom effect we wanted; it works
  everywhere WebGL2 does.
- **Chromatic aberration on hit / CRT-scanline / screen ripple** — these are
  postprocessing shader passes in Three (`ShaderPass` with a custom `.glsl`
  fragment). They are straightforward to add here and **have none of the Impeller
  caveats** that Flutter has, because the browser's WebGL backend is stable and
  uniform across devices. I left them out of this first playable to keep the file
  count down; I can add a `shaders/` folder with real `.glsl` fragment passes next.
- If you still want the **Flutter + Impeller** shader analysis specifically, that
  belongs with the 2D build on `main` — ask and I'll write it there.

Bottom line: no invented APIs. Bloom is real and active; the other effects are
one `ShaderPass` each away and I'll add them on request.

---

## Files

```
web3d/
├── index.html          # shell, import map (Three.js CDN), DOM overlays
├── styles.css          # neon UI styling
├── README.md           # this file
└── src/
    ├── main.js         # scene, renderer, bloom, camera, game loop, collisions
    ├── config.js       # all tunables: weapons, passives, enemies, rarity, XP
    ├── state.js        # PlayerStats (modifiers) + RunState (timer/xp/hp/combo)
    ├── entities.js     # InstancedMesh pools: enemies, projectiles, gems
    ├── spatial_hash.js # broad-phase collision grid
    ├── weapons.js      # WeaponSystem: fires projectile/orbit/shockwave kinds
    ├── enemy_ai.js     # behaviors (chase/exploder/teleporter) + spawn director
    ├── particles.js    # pooled additive Points particle system
    ├── audio.js        # Web Audio adaptive music + SFX
    ├── input.js        # keyboard + floating touch joystick
    └── ui.js           # HUD, level-up cards (reroll/banish/rarity/luck), game over
```

---

## Known limitations (being straight with you)

- I could not run this in my build environment (no browser there), so please load
  it and tell me anything that breaks — paste the browser console error and I'll
  fix it fast.
- First load needs internet (CDN). Offline needs local Three.js copies.
- Bosses (mini at 3:00/7:00, final at 10:00) from the design doc are **not yet in**
  this build — the enemy/AI framework is built to host them; that's the natural
  next addition along with the extra weapons/enemies and the shader passes.
