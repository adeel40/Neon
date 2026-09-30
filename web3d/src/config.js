// Central, data-driven configuration for NEON HORDE 3D.
// Keeping tunables here (rather than scattered magic numbers) makes balancing
// a single-file edit — the same philosophy as the Flutter version's JSON data.

export const CONFIG = {
  // ---- Run rules --------------------------------------------------------
  runDuration: 600, // seconds (10 minutes)

  // ---- World ------------------------------------------------------------
  arenaRadius: 60, // soft bound; camera follows player over an infinite grid
  groundSize: 400,

  // ---- Player -----------------------------------------------------------
  player: {
    maxHp: 100,
    moveSpeed: 11, // world units / second
    radius: 0.9,
    magnetRadius: 5,
    invulnTime: 0.6, // seconds of i-frames after a hit
  },

  // ---- XP / leveling ----------------------------------------------------
  // xpToNext(L) = round(5 + 4L + 0.55 L^2). Gentle early, ramps up.
  xpBase: 5,
  xpLinear: 4,
  xpQuad: 0.55,

  gemMagnetSpeed: 26,

  // ---- Spawn director ---------------------------------------------------
  spawn: {
    baseInterval: 1.1, // seconds between spawn pulses at t=0
    minInterval: 0.14,
    intervalDecay: 0.86, // per difficulty tier
    hpGrowthPerTier: 0.18,
    tierSeconds: 60, // difficulty tier increases each minute
    maxAlive: 400, // hard cap (matches instanced buffer size)
    spawnDistance: 34, // how far off-camera enemies appear
  },

  // ---- Camera -----------------------------------------------------------
  camera: {
    height: 34,
    back: 20, // distance behind the player (angled top-down)
    fov: 55,
  },
};

// XP required to advance from `level` to `level+1`.
export function xpToNext(level) {
  const L = level;
  return Math.round(CONFIG.xpBase + CONFIG.xpLinear * L + CONFIG.xpQuad * L * L);
}

// ---- Weapons ------------------------------------------------------------
// Each weapon has a `kind` the WeaponSystem knows how to fire, plus 8 levels.
// `evolvesInto` + `evolvePassive` define the evolution recipe (Phase-2 concept
// carried over): max-level weapon + owned matching passive => evolved weapon.
export const WEAPONS = {
  plasma_pistol: {
    id: 'plasma_pistol', name: 'Plasma Pistol', kind: 'projectile',
    color: 0x00e5ff, projectileSpeed: 34, projectileLife: 2.2,
    evolvesInto: 'plasma_storm', evolvePassive: 'cooldown',
    levels: [
      { damage: 10, cooldown: 0.90, count: 1, pierce: 0 },
      { damage: 13, cooldown: 0.82, count: 1, pierce: 0 },
      { damage: 16, cooldown: 0.74, count: 1, pierce: 1 },
      { damage: 20, cooldown: 0.66, count: 2, pierce: 1 },
      { damage: 24, cooldown: 0.58, count: 2, pierce: 1 },
      { damage: 29, cooldown: 0.50, count: 2, pierce: 2 },
      { damage: 35, cooldown: 0.44, count: 3, pierce: 2 },
      { damage: 44, cooldown: 0.38, count: 3, pierce: 3 },
    ],
  },
  orbit_drones: {
    id: 'orbit_drones', name: 'Orbit Drones', kind: 'orbit',
    color: 0x00ff9c, orbitRadius: 3.4, orbitSpeed: 3.0, droneRadius: 0.45,
    evolvesInto: 'halo_swarm', evolvePassive: 'damage',
    levels: [
      { damage: 8,  cooldown: 0.35, count: 1 },
      { damage: 10, cooldown: 0.35, count: 1 },
      { damage: 12, cooldown: 0.30, count: 2 },
      { damage: 15, cooldown: 0.30, count: 2 },
      { damage: 18, cooldown: 0.28, count: 3 },
      { damage: 22, cooldown: 0.28, count: 3 },
      { damage: 27, cooldown: 0.25, count: 4 },
      { damage: 34, cooldown: 0.22, count: 5 },
    ],
  },
  shockwave: {
    id: 'shockwave', name: 'Shockwave', kind: 'shockwave',
    color: 0x7c4dff, ringSpeed: 22,
    evolvesInto: 'singularity', evolvePassive: 'speed',
    levels: [
      { damage: 16, cooldown: 2.2, count: 1, area: 7 },
      { damage: 20, cooldown: 2.1, count: 1, area: 7.5 },
      { damage: 25, cooldown: 2.0, count: 1, area: 8 },
      { damage: 31, cooldown: 1.9, count: 1, area: 9 },
      { damage: 38, cooldown: 1.8, count: 2, area: 10 },
      { damage: 46, cooldown: 1.7, count: 2, area: 11 },
      { damage: 56, cooldown: 1.6, count: 2, area: 12 },
      { damage: 70, cooldown: 1.5, count: 3, area: 14 },
    ],
  },

  // Evolved forms (single powerful level, obtained from a chest).
  plasma_storm: {
    id: 'plasma_storm', name: 'Plasma Storm (EVO)', kind: 'projectile',
    color: 0x66f6ff, projectileSpeed: 40, projectileLife: 2.4,
    evolvesInto: null, evolvePassive: null,
    levels: [{ damage: 55, cooldown: 0.24, count: 5, pierce: 6 }],
  },
  halo_swarm: {
    id: 'halo_swarm', name: 'Halo Swarm (EVO)', kind: 'orbit',
    color: 0x66ffc2, orbitRadius: 4.2, orbitSpeed: 4.0, droneRadius: 0.55,
    evolvesInto: null, evolvePassive: null,
    levels: [{ damage: 42, cooldown: 0.18, count: 8 }],
  },
  singularity: {
    id: 'singularity', name: 'Singularity (EVO)', kind: 'shockwave',
    color: 0xb39dff, ringSpeed: 28,
    evolvesInto: null, evolvePassive: null,
    levels: [{ damage: 90, cooldown: 1.1, count: 3, area: 16 }],
  },
};

// ---- Passive items ------------------------------------------------------
export const PASSIVES = {
  damage:   { id: 'damage',   name: 'Overclock',   stat: 'damageMult',   amount: 0.15, max: 8, color: 0xff2e97, icon: '\u26A1' },
  speed:    { id: 'speed',    name: 'Servo Legs',  stat: 'moveSpeedMult',amount: 0.10, max: 6, color: 0x00ff9c, icon: '\u{1F45F}' },
  magnet:   { id: 'magnet',   name: 'Mag Field',   stat: 'magnetMult',   amount: 0.30, max: 6, color: 0xffe600, icon: '\u{1F9F2}' },
  cooldown: { id: 'cooldown', name: 'Coolant',     stat: 'cooldownMult', amount: 0.10, max: 6, color: 0x00e5ff, icon: '\u23F1' },
  armor:    { id: 'armor',    name: 'Nano Plating',stat: 'armorFlat',    amount: 2,    max: 6, color: 0x7c4dff, icon: '\u{1F6E1}' },
  luck:     { id: 'luck',     name: 'Lucky Chip',  stat: 'luck',         amount: 0.20, max: 5, color: 0xffffff, icon: '\u2728' },
};

// ---- Enemies ------------------------------------------------------------
// `behavior` selects the AI in the enemy system. `weight` drives weighted-random
// selection in the spawn director.
export const ENEMIES = {
  chaser:     { id: 'chaser',     name: 'Chaser',   behavior: 'chase',     color: 0xff2e97, radius: 0.8,  hp: 20,  speed: 6.5,  damage: 8,  xp: 1, weight: 55 },
  swarm:      { id: 'swarm',      name: 'Swarm',    behavior: 'chase',     color: 0xffe600, radius: 0.5,  hp: 8,   speed: 10.5, damage: 4,  xp: 1, weight: 28 },
  tank:       { id: 'tank',       name: 'Tank',     behavior: 'chase',     color: 0x7c4dff, radius: 1.4,  hp: 90,  speed: 3.6,  damage: 16, xp: 4, weight: 6 },
  exploder:   { id: 'exploder',   name: 'Exploder', behavior: 'exploder',  color: 0xff7a00, radius: 0.9,  hp: 18,  speed: 7.5,  damage: 22, xp: 2, weight: 6, explodeRadius: 4 },
  teleporter: { id: 'teleporter', name: 'Blinker',  behavior: 'teleporter',color: 0x00e5ff, radius: 0.7,  hp: 16,  speed: 5.0,  damage: 10, xp: 2, weight: 5, blinkEvery: 2.5, blinkDist: 12 },
};

// ---- Rarity (for upgrade cards) ----------------------------------------
export const RARITY = [
  { id: 'common',    name: 'Common',    weight: 60, color: 0xbfc7d5 },
  { id: 'rare',      name: 'Rare',      weight: 28, color: 0x00e5ff },
  { id: 'epic',      name: 'Epic',      weight: 10, color: 0xb14dff },
  { id: 'legendary', name: 'Legendary', weight: 2,  color: 0xffd23f },
];
