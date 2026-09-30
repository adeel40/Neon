// DOM UI controller: HUD updates, level-up cards (with reroll/banish, rarity
// colors, luck-weighted rolls), and the game-over screen.
import { WEAPONS, PASSIVES, RARITY } from './config.js';

function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      xpFill: document.getElementById('xpFill'),
      hpFill: document.getElementById('hpFill'),
      hpText: document.getElementById('hpText'),
      level: document.getElementById('statLevel'),
      time: document.getElementById('statTime'),
      kills: document.getElementById('statKills'),
      combo: document.getElementById('combo'),
      pauseBtn: document.getElementById('pauseBtn'),
      startScreen: document.getElementById('startScreen'),
      startBtn: document.getElementById('startBtn'),
      levelUp: document.getElementById('levelUp'),
      levelUpSub: document.getElementById('levelUpSub'),
      cards: document.getElementById('cards'),
      rerollBtn: document.getElementById('rerollBtn'),
      banishBtn: document.getElementById('banishBtn'),
      rerollCount: document.getElementById('rerollCount'),
      banishCount: document.getElementById('banishCount'),
      gameOver: document.getElementById('gameOver'),
      gameOverTitle: document.getElementById('gameOverTitle'),
      gameOverSub: document.getElementById('gameOverSub'),
      resTime: document.getElementById('resTime'),
      resLevel: document.getElementById('resLevel'),
      resKills: document.getElementById('resKills'),
      restartBtn: document.getElementById('restartBtn'),
      debug: document.getElementById('debug'),
    };

    this.banished = new Set();
    this.rerolls = 2;
    this.banishes = 1;

    this.el.startBtn.onclick = () => this.game.start();
    this.el.restartBtn.onclick = () => this.game.restart();
    this.el.pauseBtn.onclick = () => this.game.togglePause();
    this.el.rerollBtn.onclick = () => this._reroll();
    this.el.banishBtn.onclick = () => { this._banishMode = true; this._flashBanish(); };
  }

  showHud() { this.el.hud.classList.remove('hidden'); }
  hideStart() { this.el.startScreen.classList.add('hidden'); }

  resetMeta() { this.banished.clear(); this.rerolls = 2; this.banishes = 1; }

  updateHud(run) {
    this.el.xpFill.style.transform = `scaleX(${run.xpProgress})`;
    this.el.hpFill.style.transform = `scaleX(${run.hpProgress})`;
    this.el.hpFill.style.background = run.hpProgress > 0.3 ? '' : '#ff2e97';
    this.el.hpText.textContent = `${Math.ceil(run.hp)} / ${Math.ceil(run.maxHp)}`;
    this.el.level.textContent = run.level;
    this.el.time.textContent = run.formattedTime;
    this.el.kills.textContent = run.kills;

    if (run.combo >= 5) {
      this.el.combo.textContent = `${run.combo} COMBO`;
      this.el.combo.style.opacity = '1';
    } else {
      this.el.combo.style.opacity = '0';
    }
  }

  // ---- Level up ---------------------------------------------------------
  showLevelUp(run) {
    this.el.levelUpSub.textContent = `Level ${run.level} — choose an upgrade`;
    this._currentChoices = this._roll(3);
    this._renderCards();
    this._updateMetaButtons();
    this.el.levelUp.classList.remove('hidden');
  }

  hideLevelUp() { this.el.levelUp.classList.add('hidden'); this._banishMode = false; }

  // A weapon id is "evolved" if its recipe has no further evolution AND it is
  // not one of the base weapons offered to the player.
  _isBaseWeapon(id) {
    const def = WEAPONS[id];
    // Base weapons define an evolution recipe; evolved forms have evolvesInto:null.
    return def && def.evolvesInto !== null;
  }

  // Build the pool of eligible choices (weapon adds, weapon level-ups, passives).
  _pool() {
    const g = this.game;
    const out = [];

    // Weapon level-ups for owned, non-maxed weapons (including evolved ones
    // that still have levels — evolved forms have only 1 level so they're
    // naturally excluded by weaponMaxed()).
    for (const w of g.weapons.weapons) {
      if (!g.weapons.weaponMaxed(w.def.id)) {
        out.push({
          type: 'weaponLevel', id: w.def.id,
          name: `${w.def.name} +`,
          desc: `Level ${w.level} → ${w.level + 1}`,
          color: w.def.color, icon: '\u{1F52B}',
        });
      }
    }

    // New base weapons, capped at 4 owned weapons.
    if (g.weapons.weapons.length < 4) {
      for (const id of Object.keys(WEAPONS)) {
        if (!this._isBaseWeapon(id)) continue; // never offer evolved forms directly
        if (!g.weapons.hasWeapon(id)) {
          out.push({
            type: 'weaponNew', id,
            name: WEAPONS[id].name, desc: 'New weapon',
            color: WEAPONS[id].color, icon: '\u2795',
          });
        }
      }
    }

    // Passives (respect per-passive max stacks).
    for (const id of Object.keys(PASSIVES)) {
      const p = PASSIVES[id];
      if (g.stats.stacksOf(id) < p.max) {
        out.push({
          type: 'passive', id,
          name: p.name, desc: this._passiveDesc(p),
          color: p.color, icon: p.icon,
        });
      }
    }

    return out.filter((c) => !this.banished.has(c.type + ':' + c.id));
  }

  _passiveDesc(p) {
    const pct = Math.round(p.amount * 100);
    switch (p.stat) {
      case 'damageMult': return `+${pct}% damage`;
      case 'moveSpeedMult': return `+${pct}% move speed`;
      case 'magnetMult': return `+${pct}% pickup radius`;
      case 'cooldownMult': return `+${pct}% fire rate`;
      case 'armorFlat': return `+${p.amount} armor`;
      case 'luck': return `+${pct}% luck`;
      default: return '';
    }
  }

  // Assign a luck-weighted rarity to each choice and pick `count` distinct ones.
  _roll(count) {
    const pool = this._pool();
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = pool.slice(0, count);
    // Rarity roll shifted by luck: higher luck nudges toward rarer tiers.
    const luck = this.game.stats.luck;
    for (const c of chosen) c.rarity = this._rollRarity(luck);
    return chosen;
  }

  _rollRarity(luck) {
    // Boost rare+ weights by luck.
    const weights = RARITY.map((r, i) => r.weight * (i === 0 ? 1 : 1 + luck * i));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < RARITY.length; i++) {
      if (roll <= weights[i]) return RARITY[i];
      roll -= weights[i];
    }
    return RARITY[0];
  }

  _renderCards() {
    this.el.cards.innerHTML = '';
    for (const c of this._currentChoices) {
      const card = document.createElement('button');
      card.className = 'card';
      const col = hex(c.rarity ? c.rarity.color : c.color);
      card.style.borderColor = col;
      card.style.boxShadow = `0 0 14px ${col}55`;
      card.innerHTML = `
        <span class="icon" style="color:${hex(c.color)}">${c.icon}</span>
        <span class="body">
          <span class="rarity" style="color:${col}">${c.rarity ? c.rarity.name : ''}</span>
          <div class="name">${c.name}</div>
          <div class="desc">${c.desc}</div>
        </span>`;
      card.onclick = () => {
        if (this._banishMode) { this._banish(c); return; }
        this.game.chooseUpgrade(c);
      };
      this.el.cards.appendChild(card);
    }
    if (this._currentChoices.length === 0) {
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = `<span class="body"><div class="name">Nothing left — carry on!</div></span>`;
      card.onclick = () => this.game.chooseUpgrade(null);
      this.el.cards.appendChild(card);
    }
  }

  _reroll() {
    if (this.rerolls <= 0) return;
    this.rerolls--;
    this._currentChoices = this._roll(3);
    this._renderCards();
    this._updateMetaButtons();
  }

  _banish(choice) {
    if (this.banishes <= 0) return;
    this.banishes--;
    this.banished.add(choice.type + ':' + choice.id);
    this._banishMode = false;
    this._currentChoices = this._roll(3);
    this._renderCards();
    this._updateMetaButtons();
  }

  _flashBanish() {
    this.el.banishBtn.style.background = 'rgba(255,46,151,0.25)';
    setTimeout(() => { this.el.banishBtn.style.background = ''; }, 300);
  }

  _updateMetaButtons() {
    this.el.rerollCount.textContent = `(${this.rerolls})`;
    this.el.banishCount.textContent = `(${this.banishes})`;
    this.el.rerollBtn.disabled = this.rerolls <= 0;
    this.el.banishBtn.disabled = this.banishes <= 0;
  }

  // ---- Game over --------------------------------------------------------
  showGameOver(run) {
    this.el.gameOverTitle.textContent = run.victory ? 'SIGNAL SENT' : 'CONNECTION LOST';
    this.el.gameOverTitle.style.color = run.victory ? '#00ff9c' : '#ff2e97';
    this.el.gameOverSub.textContent = run.victory ? 'You survived 10:00' : 'You were overrun';
    this.el.resTime.textContent = run.formattedTime;
    this.el.resLevel.textContent = run.level;
    this.el.resKills.textContent = run.kills;
    this.el.gameOver.classList.remove('hidden');
  }
  hideGameOver() { this.el.gameOver.classList.add('hidden'); }

  updateDebug(text) { this.el.debug.textContent = text; }
  toggleDebug() { this.el.debug.classList.toggle('hidden'); }
}
