// ===================================================
// HUKMDOR: QIROLLIKLAR JANGI - ASOSIY O'YIN MOTORASI
// Bino ko'rinishidagi qal'alar, dona-dona askarlar va uzluksiz oqim tizimi
// ===================================================

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // O'yin holati
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'VICTORY', 'DEFEAT'
    this.currentLevel = null;
    this.levelIndex = 1;
    this.isSkirmish = false;

    // Dunyo obyektlari
    this.castles = [];
    this.soldiers = [];          // Dona-dona individual askarlar
    this.activeStreams = [];     // Uzluksiz yuborish oqimlari (bir marta bosganda tugaguncha borish)
    this.projectiles = [];       // Fort kamonchilarining o'qlari
    this.particles = [];         // Zarrachalar va chang effektlari

    // Boshqaruv
    this.selectedCastles = new Set();
    this.hoveredCastle = null;
    this.dragStartCastle = null;
    this.dragMousePos = null;
    this.sendAllMode = true;     // "tugaguncha yuborish" rejimi (100% yoki 50%)
    this.isBoxSelecting = false;
    this.boxSelectStart = { x: 0, y: 0 };
    this.boxSelectCurrent = { x: 0, y: 0 };

    // Sehr holati
    this.activeSpellTargeting = null;
    this.spellCooldowns = { lightning: 0, shield: 0, rush: 0, meteor: 0 };
    this.spellBuffs = { rushDuration: 0 };

    // Resurslar va Statistika
    this.gold = 100;
    this.stats = {
      startTime: 0,
      elapsedSeconds: 0,
      castlesCaptured: 0,
      enemiesKilled: 0
    };

    // AI Taymeri
    this.aiTickTimer = 0;

    // Saqlangan ma'lumotlar
    this.saveData = this.loadSaveData();

    // Init
    this.initCanvasSize();
    this.setupEventListeners();
    this.renderCampaignLevels();
    this.updateHUD();

    // Animatsiya sikli
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  loadSaveData() {
    try {
      const data = localStorage.getItem('hukmdor_save');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return { unlockedLevel: 1, levelStars: {} };
  }

  saveGameData() {
    try {
      localStorage.setItem('hukmdor_save', JSON.stringify(this.saveData));
    } catch (e) {}
  }

  initCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.ctx.scale(dpr, dpr);
  }

  // ================= EVENT LISTENERLAR =================
  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      if (this.currentLevel) {
        this.recalculateCastlePositions();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelAction();
    });

    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    // UI Tugmalari
    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart-level').addEventListener('click', () => this.restartLevel());
    document.getElementById('btn-quit-to-menu').addEventListener('click', () => this.quitToMenu());
    document.getElementById('btn-victory-menu').addEventListener('click', () => this.quitToMenu());
    document.getElementById('btn-defeat-menu').addEventListener('click', () => this.quitToMenu());
    document.getElementById('btn-retry-level').addEventListener('click', () => this.restartLevel());
    document.getElementById('btn-next-level').addEventListener('click', () => this.startNextLevel());

    document.getElementById('btn-audio').addEventListener('click', () => {
      const muted = sound.toggleMute();
      document.getElementById('audio-icon').textContent = muted ? '🔇' : '🔊';
    });

    // Yuborish rejimi (Barchasi tugaguncha yoki 50%)
    const btn100 = document.getElementById('btn-dispatch-100');
    const btn50 = document.getElementById('btn-dispatch-50');
    if (btn100 && btn50) {
      btn100.textContent = "Barchasi (Tugaguncha)";
      btn50.textContent = "Yarmi (50%)";
      btn100.classList.add('active');
      btn50.classList.remove('active');

      btn100.addEventListener('click', () => {
        this.sendAllMode = true;
        btn100.classList.add('active');
        btn50.classList.remove('active');
        sound.playClick();
      });
      btn50.addEventListener('click', () => {
        this.sendAllMode = false;
        btn50.classList.add('active');
        btn100.classList.remove('active');
        sound.playClick();
      });
    }

    document.getElementById('btn-select-all').addEventListener('click', () => this.selectAllPlayerCastles());
    document.getElementById('btn-upgrade-selected').addEventListener('click', () => this.upgradeSelectedCastles());

    // Menyu navigatsiyasi
    document.getElementById('btn-campaign').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('main-menu').classList.add('hidden');
      document.getElementById('level-select-modal').classList.remove('hidden');
      this.renderCampaignLevels();
    });

    document.getElementById('btn-close-levels').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('level-select-modal').classList.add('hidden');
      document.getElementById('main-menu').classList.remove('hidden');
    });
    document.getElementById('btn-back-from-levels').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('level-select-modal').classList.add('hidden');
      document.getElementById('main-menu').classList.remove('hidden');
    });

    document.getElementById('btn-skirmish').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('main-menu').classList.add('hidden');
      document.getElementById('skirmish-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-skirmish').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('skirmish-modal').classList.add('hidden');
      document.getElementById('main-menu').classList.remove('hidden');
    });

    document.getElementById('btn-instructions').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('instructions-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-info').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('instructions-modal').classList.add('hidden');
    });
    document.getElementById('btn-info-gotit').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('instructions-modal').classList.add('hidden');
    });

    this.setupSkirmishOptions();

    // Sehrlar
    document.getElementById('spell-lightning').addEventListener('click', () => this.activateSpell('lightning'));
    document.getElementById('spell-shield').addEventListener('click', () => this.activateSpell('shield'));
    document.getElementById('spell-rush').addEventListener('click', () => this.castRushSpell());
    document.getElementById('spell-meteor').addEventListener('click', () => this.activateSpell('meteor'));
  }

  setupSkirmishOptions() {
    const bindGroup = (containerId) => {
      const container = document.getElementById(containerId);
      const btns = container.querySelectorAll('.btn-opt');
      btns.forEach((btn) => {
        btn.addEventListener('click', () => {
          btns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          sound.playClick();
        });
      });
    };

    bindGroup('opt-map-size');
    bindGroup('opt-ai-count');
    bindGroup('opt-ai-diff');

    document.getElementById('btn-start-skirmish').addEventListener('click', () => {
      sound.playClick();
      const size = document.querySelector('#opt-map-size .btn-opt.active').dataset.val;
      const aiCount = parseInt(document.querySelector('#opt-ai-count .btn-opt.active').dataset.val, 10);
      const diff = document.querySelector('#opt-ai-diff .btn-opt.active').dataset.val;

      const skirmishLevel = generateSkirmishLevel(size, aiCount, diff);
      document.getElementById('skirmish-modal').classList.add('hidden');
      this.startLevel(skirmishLevel, true);
    });
  }

  renderCampaignLevels() {
    const container = document.getElementById('levels-container');
    container.innerHTML = '';

    CAMPAIGN_LEVELS.forEach((lvl) => {
      const isLocked = lvl.id > this.saveData.unlockedLevel;
      const starsEarned = this.saveData.levelStars[lvl.id] || 0;

      const card = document.createElement('div');
      card.className = `level-card-btn ${isLocked ? 'locked' : ''}`;

      let starsHtml = '';
      for (let s = 1; s <= 3; s++) {
        starsHtml += `<span class="star ${s <= starsEarned ? 'earned' : ''}">★</span>`;
      }

      card.innerHTML = `
        <div class="level-num">${isLocked ? '🔒' : lvl.id + '-Bosqich'}</div>
        <div class="level-name">${lvl.title}</div>
        <div class="level-stars">${isLocked ? 'Qulflangan' : starsHtml}</div>
      `;

      if (!isLocked) {
        card.addEventListener('click', () => {
          sound.playClick();
          document.getElementById('level-select-modal').classList.add('hidden');
          this.startLevel(lvl, false);
        });
      }

      container.appendChild(card);
    });
  }

  // ================= DARAJA BOSHLASH =================
  startLevel(levelData, isSkirmish = false) {
    this.currentLevel = levelData;
    this.isSkirmish = isSkirmish;
    this.levelIndex = levelData.id;
    this.state = 'PLAYING';

    this.selectedCastles.clear();
    this.dragStartCastle = null;
    this.dragMousePos = null;
    this.soldiers = [];
    this.activeStreams = [];
    this.projectiles = [];
    this.particles = [];
    this.gold = 80;
    this.activeSpellTargeting = null;
    document.getElementById('spell-target-hint').classList.add('hidden');

    this.spellCooldowns = { lightning: 0, shield: 0, rush: 0, meteor: 0 };
    this.spellBuffs.rushDuration = 0;

    this.stats = {
      startTime: Date.now(),
      elapsedSeconds: 0,
      castlesCaptured: 0,
      enemiesKilled: 0
    };

    this.recalculateCastlePositions();

    // UI oynalari
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('level-select-modal').classList.add('hidden');
    document.getElementById('skirmish-modal').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('victory-modal').classList.add('hidden');
    document.getElementById('defeat-modal').classList.add('hidden');

    document.getElementById('top-bar').classList.remove('hidden');
    document.getElementById('bottom-bar').classList.remove('hidden');

    document.getElementById('level-badge').textContent = isSkirmish ? 'Erkin Jang' : `${this.levelIndex}-Bosqich`;
    document.getElementById('level-title').textContent = levelData.title;

    sound.playWarHorn();
    this.updateHUD();
  }

  recalculateCastlePositions() {
    if (!this.currentLevel) return;

    const paddingX = Math.max(85, this.width * 0.10);
    const paddingY = Math.max(95, this.height * 0.15);
    const usableWidth = this.width - paddingX * 2;
    const usableHeight = this.height - paddingY * 2;

    this.castles = this.currentLevel.castles.map((c) => {
      const typeDef = CASTLE_TYPES[c.type] || CASTLE_TYPES.capital;
      return {
        id: c.id,
        x: paddingX + c.x * usableWidth,
        y: paddingY + c.y * usableHeight,
        owner: c.owner,
        type: c.type,
        troops: c.troops,
        level: c.level || 1,
        maxCap: typeDef.baseCap * (1 + (c.level - 1) * 0.35),
        growthRate: typeDef.growthRate * (1 + (c.level - 1) * 0.25),
        defenseBonus: typeDef.defenseBonus + (c.level - 1) * 0.15,
        radius: typeDef.radius || 40,
        bWidth: typeDef.bWidth || 80,
        bHeight: typeDef.bHeight || 82,
        shieldTimer: 0,
        shootTimer: 0,
        productionAccumulator: 0,
        flagWave: Math.random() * Math.PI * 2,
        chimneyTimer: 0
      };
    });
  }

  restartLevel() {
    sound.playClick();
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('defeat-modal').classList.add('hidden');
    this.startLevel(this.currentLevel, this.isSkirmish);
  }

  startNextLevel() {
    sound.playClick();
    document.getElementById('victory-modal').classList.add('hidden');
    const nextId = this.levelIndex + 1;
    const nextLvl = CAMPAIGN_LEVELS.find((l) => l.id === nextId);
    if (nextLvl) {
      this.startLevel(nextLvl, false);
    } else {
      this.quitToMenu();
    }
  }

  quitToMenu() {
    sound.playClick();
    this.state = 'MENU';
    document.getElementById('top-bar').classList.add('hidden');
    document.getElementById('bottom-bar').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('victory-modal').classList.add('hidden');
    document.getElementById('defeat-modal').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('pause-modal').classList.remove('hidden');
      sound.playClick();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('pause-modal').classList.add('hidden');
      sound.playClick();
    }
  }

  // ================= FOYDALANUVCHI BOSHQARUVI =================
  getCastleAt(x, y) {
    for (const c of this.castles) {
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist <= c.radius + 12) {
        return c;
      }
    }
    return null;
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.mousePos = { x: mouseX, y: mouseY };
    this.hoveredCastle = this.getCastleAt(mouseX, mouseY);

    const tooltip = document.getElementById('castle-tooltip');
    if (this.hoveredCastle && this.state === 'PLAYING' && !this.activeSpellTargeting) {
      const c = this.hoveredCastle;
      const typeDef = CASTLE_TYPES[c.type];
      const faction = FACTIONS[c.owner];

      document.getElementById('tt-name').textContent = typeDef.name;
      document.getElementById('tt-owner').textContent = faction.name;
      document.getElementById('tt-owner').style.color = faction.lightColor;
      document.getElementById('tt-type').textContent = `${typeDef.icon} ${typeDef.name}`;
      document.getElementById('tt-level').textContent = `${c.level}-daraja`;
      document.getElementById('tt-def').textContent = `+${Math.round(c.defenseBonus * 100)}%`;
      document.getElementById('tt-growth').textContent = `+${c.growthRate.toFixed(1)} / sek`;

      tooltip.style.left = Math.min(window.innerWidth - 190, mouseX + 16) + 'px';
      tooltip.style.top = Math.min(window.innerHeight - 150, mouseY + 16) + 'px';
      tooltip.classList.remove('hidden');
    } else {
      tooltip.classList.add('hidden');
    }

    if (this.dragStartCastle) {
      this.dragMousePos = { x: mouseX, y: mouseY };
    }

    if (this.isBoxSelecting) {
      this.boxSelectCurrent = { x: mouseX, y: mouseY };
    }
  }

  onMouseDown(e) {
    if (this.state !== 'PLAYING') return;
    if (e.button === 2) return; // O'ng tugma

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (this.activeSpellTargeting) {
      this.resolveSpellCast(mouseX, mouseY);
      return;
    }

    const clickedCastle = this.getCastleAt(mouseX, mouseY);

    if (clickedCastle) {
      if (clickedCastle.owner === 'player') {
        if (!e.shiftKey && !this.selectedCastles.has(clickedCastle)) {
          this.selectedCastles.clear();
        }
        this.selectedCastles.add(clickedCastle);
        this.dragStartCastle = clickedCastle;
        this.dragMousePos = { x: mouseX, y: mouseY };
        sound.playClick();
      } else {
        // Dushman yoki neytral qal'a bosildi -> tanlangan barcha o'z qal'alarimizdan uzluksiz oqim boshlanadi!
        if (this.selectedCastles.size > 0) {
          this.startStreamingTroopsTo(clickedCastle);
        }
      }
    } else {
      // Bo'sh maydon bosildi -> Ramka bilan guruhlab tanlash
      if (!e.shiftKey) {
        this.selectedCastles.clear();
      }
      this.isBoxSelecting = true;
      this.boxSelectStart = { x: mouseX, y: mouseY };
      this.boxSelectCurrent = { x: mouseX, y: mouseY };
    }
  }

  onMouseUp(e) {
    if (this.state !== 'PLAYING') return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (this.dragStartCastle) {
      const targetCastle = this.getCastleAt(mouseX, mouseY);
      if (targetCastle && targetCastle !== this.dragStartCastle) {
        this.startStreamingTroopsTo(targetCastle);
      }
      this.dragStartCastle = null;
      this.dragMousePos = null;
    }

    if (this.isBoxSelecting) {
      this.isBoxSelecting = false;
      const minX = Math.min(this.boxSelectStart.x, this.boxSelectCurrent.x);
      const maxX = Math.max(this.boxSelectStart.x, this.boxSelectCurrent.x);
      const minY = Math.min(this.boxSelectStart.y, this.boxSelectCurrent.y);
      const maxY = Math.max(this.boxSelectStart.y, this.boxSelectCurrent.y);

      if (maxX - minX > 15 || maxY - minY > 15) {
        for (const c of this.castles) {
          if (c.owner === 'player' && c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
            this.selectedCastles.add(c);
          }
        }
      }
    }
  }

  onDoubleClick(e) {
    if (this.state !== 'PLAYING') return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clicked = this.getCastleAt(mouseX, mouseY);
    if (clicked && clicked.owner === 'player') {
      this.selectAllPlayerCastles();
    }
  }

  onKeyDown(e) {
    if (this.state !== 'PLAYING') {
      if (e.key === 'Escape' && this.state === 'PAUSED') {
        this.togglePause();
      }
      return;
    }

    if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
      this.togglePause();
    } else if (e.key === 'Escape') {
      this.cancelAction();
    } else if (e.key === 'a' || e.key === 'A') {
      this.selectAllPlayerCastles();
    } else if (e.key === 'u' || e.key === 'U') {
      this.upgradeSelectedCastles();
    } else if (e.key === '1') {
      this.activateSpell('lightning');
    } else if (e.key === '2') {
      this.activateSpell('shield');
    } else if (e.key === '3') {
      this.castRushSpell();
    } else if (e.key === '4') {
      this.activateSpell('meteor');
    }
  }

  cancelAction() {
    if (this.activeSpellTargeting) {
      this.activeSpellTargeting = null;
      document.getElementById('spell-target-hint').classList.add('hidden');
      return;
    }
    // Barcha o'yinchi oqimlarini va tanlovlarni to'xtatish
    this.activeStreams = this.activeStreams.filter((s) => s.owner !== 'player');
    this.selectedCastles.clear();
    this.dragStartCastle = null;
    this.dragMousePos = null;
    this.isBoxSelecting = false;
  }

  selectAllPlayerCastles() {
    this.selectedCastles.clear();
    this.castles.forEach((c) => {
      if (c.owner === 'player') this.selectedCastles.add(c);
    });
    sound.playClick();
  }

  // ================= UZLUKSIZ OQIM TIZIMI (STREAMING) =================
  // "Bir marta bossa tugamaguncha dona-dona borsin"
  startStreamingTroopsTo(targetCastle) {
    let started = false;

    this.selectedCastles.forEach((sourceCastle) => {
      if (sourceCastle === targetCastle) return;

      // Agar ushbu qal'adan nishonga allaqachon oqim bo'lsa, uni bekor qilamiz
      const existingIdx = this.activeStreams.findIndex(
        (s) => s.source === sourceCastle && s.target === targetCastle
      );

      if (existingIdx !== -1) {
        this.activeStreams.splice(existingIdx, 1);
        return;
      }

      // Qancha askar yuborish kerakligini hisoblaymiz (Hamma mavjudi yoki 50%)
      const targetCount = this.sendAllMode
        ? Math.floor(sourceCastle.troops)
        : Math.floor(sourceCastle.troops * 0.5);

      if (targetCount > 0) {
        this.activeStreams.push({
          id: Math.random().toString(36).substr(2, 9),
          source: sourceCastle,
          target: targetCastle,
          owner: sourceCastle.owner,
          quotaTotal: targetCount,
          quotaSent: 0,
          spawnCooldown: 0.12, // Har 120ms da bitta dona askar chiqadi
          timer: 0
        });
        started = true;
      }
    });

    if (started) {
      sound.playMarch();
    }
  }

  // Dona-dona individual askar yaratish
  spawnIndividualSoldier(source, target, owner) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);

    // Boshlang'ich bino eshigidan chiqish nuqtasi
    const offsetAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
    const spawnX = source.x + Math.cos(offsetAngle) * (source.radius - 8);
    const spawnY = source.y + Math.sin(offsetAngle) * (source.radius - 8);

    this.soldiers.push({
      id: Math.random().toString(36).substr(2, 9),
      source: source,
      target: target,
      owner: owner,
      x: spawnX,
      y: spawnY,
      vx: dx / distance,
      vy: dy / distance,
      distanceTotal: distance,
      distanceTraveled: 0,
      baseSpeed: 105, // px/s
      walkCycle: Math.random() * Math.PI * 2,
      hp: 1,
      inCombatWith: null
    });
  }

  // ================= QAL'ANI YANGILASH =================
  upgradeSelectedCastles() {
    if (this.selectedCastles.size === 0) return;

    this.selectedCastles.forEach((c) => {
      if (c.owner !== 'player') return;
      if (c.level >= 3) return;

      const cost = c.level === 1 ? 50 : 100;
      if (this.gold >= cost) {
        this.gold -= cost;
        c.level += 1;
        const typeDef = CASTLE_TYPES[c.type];
        c.maxCap = typeDef.baseCap * (1 + (c.level - 1) * 0.35);
        c.growthRate = typeDef.growthRate * (1 + (c.level - 1) * 0.3);
        c.defenseBonus = typeDef.defenseBonus + (c.level - 1) * 0.15;

        this.createUpgradeParticles(c.x, c.y);
        sound.playUpgrade();
      }
    });
    this.updateHUD();
  }

  // ================= SEHRLAR TIZIMI =================
  activateSpell(spellType) {
    const costs = { lightning: 60, shield: 50, meteor: 100 };
    const cost = costs[spellType];

    if (this.gold < cost) return;
    if (this.spellCooldowns[spellType] > 0) return;

    this.activeSpellTargeting = spellType;
    document.getElementById('spell-target-hint').classList.remove('hidden');
    sound.playClick();
  }

  castRushSpell() {
    const cost = 75;
    if (this.gold < cost || this.spellCooldowns.rush > 0) return;

    this.gold -= cost;
    this.spellCooldowns.rush = 25;
    this.spellBuffs.rushDuration = 8;
    sound.playShield();
    this.updateHUD();
  }

  resolveSpellCast(x, y) {
    const spell = this.activeSpellTargeting;
    this.activeSpellTargeting = null;
    document.getElementById('spell-target-hint').classList.add('hidden');

    const clicked = this.getCastleAt(x, y);

    if (spell === 'lightning') {
      if (this.gold < 60) return;
      this.gold -= 60;
      this.spellCooldowns.lightning = 20;

      if (clicked) {
        const damage = Math.floor(clicked.troops * 0.5) + 8;
        clicked.troops = Math.max(0, clicked.troops - damage);
        this.createLightningEffect(clicked.x, clicked.y);
      } else {
        // Yo'ldagi barcha dushman askarlarini uradi
        this.createLightningEffect(x, y);
        for (let i = this.soldiers.length - 1; i >= 0; i--) {
          const s = this.soldiers[i];
          if (s.owner !== 'player' && Math.hypot(s.x - x, s.y - y) < 85) {
            this.createClashSparks(s.x, s.y);
            this.soldiers.splice(i, 1);
            this.stats.enemiesKilled += 1;
          }
        }
      }
      sound.playLightning();
    } else if (spell === 'shield') {
      if (!clicked || clicked.owner !== 'player') return;
      if (this.gold < 50) return;
      this.gold -= 50;
      this.spellCooldowns.shield = 22;

      clicked.shieldTimer = 12;
      sound.playShield();
    } else if (spell === 'meteor') {
      if (this.gold < 100) return;
      this.gold -= 100;
      this.spellCooldowns.meteor = 30;

      const targetX = clicked ? clicked.x : x;
      const targetY = clicked ? clicked.y : y;

      sound.playMeteor();
      setTimeout(() => {
        if (clicked) {
          const dmg = Math.floor(20 + clicked.troops * 0.4);
          clicked.troops = Math.max(0, clicked.troops - dmg);
          if (clicked.level > 1 && Math.random() < 0.5) {
            clicked.level -= 1;
          }
        }
        this.createExplosionParticles(targetX, targetY);
      }, 400);
    }

    this.updateHUD();
  }

  // ================= SUN'IY INTELLEKT (AI LOGIC) =================
  updateAI(dt) {
    this.aiTickTimer += dt;
    if (this.aiTickTimer < 2.0) return;
    this.aiTickTimer = 0;

    const aiFactions = this.currentLevel.factions.filter((f) => f !== 'player');

    aiFactions.forEach((fId) => {
      const owned = this.castles.filter((c) => c.owner === fId);
      if (owned.length === 0) return;

      const otherCastles = this.castles.filter((c) => c.owner !== fId);
      if (otherCastles.length === 0) return;

      const fConfig = FACTIONS[fId];
      const personality = fConfig.personality || 'aggressive';

      // 1. Qal'ani kuchaytirish
      owned.forEach((c) => {
        if (c.level < 3 && c.troops > 35 && Math.random() < 0.25) {
          c.level += 1;
          const typeDef = CASTLE_TYPES[c.type];
          c.maxCap = typeDef.baseCap * (1 + (c.level - 1) * 0.35);
          c.growthRate = typeDef.growthRate * (1 + (c.level - 1) * 0.3);
          c.defenseBonus = typeDef.defenseBonus + (c.level - 1) * 0.15;
          this.createUpgradeParticles(c.x, c.y);
        }
      });

      // 2. Hujum manbasi tanlash
      const readySources = owned.filter((c) => c.troops >= 15);
      if (readySources.length === 0) return;

      const source = readySources[Math.floor(Math.random() * readySources.length)];

      // 3. Nishon topish
      let bestTarget = null;
      let bestScore = -9999;

      otherCastles.forEach((target) => {
        const dist = Math.hypot(target.x - source.x, target.y - source.y);
        let score = 0;

        if (target.owner === 'neutral') score += 50;
        score -= target.troops * 1.5;
        score -= dist * 0.12;

        if (target.type === 'mine') score += 30;
        if (target.type === 'barracks') score += 25;
        if (personality === 'aggressive' && target.owner === 'player') score += 40;

        if (score > bestScore) {
          bestScore = score;
          bestTarget = target;
        }
      });

      if (bestTarget) {
        // AI ham uzluksiz oqim boshlaydi
        const toSend = Math.floor(source.troops * (personality === 'aggressive' ? 0.75 : 0.6));
        if (toSend >= 8) {
          this.activeStreams.push({
            id: Math.random().toString(36).substr(2, 9),
            source: source,
            target: bestTarget,
            owner: fId,
            quotaTotal: toSend,
            quotaSent: 0,
            spawnCooldown: 0.14,
            timer: 0
          });
        }
      }
    });
  }

  // ================= YANGILANISH (UPDATE TICK) =================
  update(dt) {
    if (this.state !== 'PLAYING') return;

    this.stats.elapsedSeconds = Math.floor((Date.now() - this.stats.startTime) / 1000);

    for (const s in this.spellCooldowns) {
      if (this.spellCooldowns[s] > 0) {
        this.spellCooldowns[s] = Math.max(0, this.spellCooldowns[s] - dt);
      }
    }
    if (this.spellBuffs.rushDuration > 0) {
      this.spellBuffs.rushDuration = Math.max(0, this.spellBuffs.rushDuration - dt);
    }

    // 1. Qal'alar yangilanishi
    this.castles.forEach((c) => {
      c.flagWave += dt * 3.5;

      if (c.shieldTimer > 0) {
        c.shieldTimer = Math.max(0, c.shieldTimer - dt);
      }

      // Kazarma tutuni
      if (c.type === 'barracks' && c.owner !== 'neutral') {
        c.chimneyTimer = (c.chimneyTimer || 0) + dt;
        if (c.chimneyTimer > 0.4) {
          c.chimneyTimer = 0;
          this.particles.push({
            x: c.x + 18,
            y: c.y - c.radius - 8,
            vx: (Math.random() - 0.5) * 5,
            vy: -15 - Math.random() * 10,
            radius: 3 + Math.random() * 2,
            color: 'rgba(200, 200, 210, 0.4)',
            life: 0.8,
            maxLife: 0.8
          });
        }
      }

      if (c.owner !== 'neutral') {
        c.productionAccumulator += c.growthRate * dt;
        if (c.productionAccumulator >= 1) {
          const add = Math.floor(c.productionAccumulator);
          c.productionAccumulator -= add;
          if (c.troops < c.maxCap) {
            c.troops = Math.min(c.maxCap, c.troops + add);
          }
        }

        const typeDef = CASTLE_TYPES[c.type];
        if (c.owner === 'player') {
          this.gold += (typeDef.goldRate || 1) * dt;
        }

        if (typeDef.canShoot) {
          c.shootTimer = (c.shootTimer || 0) + dt * 1000;
          if (c.shootTimer >= typeDef.shootInterval) {
            c.shootTimer = 0;
            this.handleFortShooting(c, typeDef.shootRange);
          }
        }
      }
    });

    // 2. Uzluksiz oqimlar: binodan askarlarni dona-dona chiqarish
    for (let i = this.activeStreams.length - 1; i >= 0; i--) {
      const stream = this.activeStreams[i];
      const src = stream.source;
      const tgt = stream.target;

      // Agar manba qal'a egasi o'zgargan bo'lsa, oqim bekor
      if (src.owner !== stream.owner) {
        this.activeStreams.splice(i, 1);
        continue;
      }

      // Har bir intervalda 1 dona askar chiqarish
      stream.timer += dt;
      if (stream.timer >= stream.spawnCooldown) {
        stream.timer = 0;

        if (src.troops >= 1 && stream.quotaSent < stream.quotaTotal) {
          src.troops -= 1;
          stream.quotaSent += 1;
          this.spawnIndividualSoldier(src, tgt, stream.owner);
        }

        // Barcha belgilangan askarlar tugagach oqim yopiladi
        if (stream.quotaSent >= stream.quotaTotal || src.troops <= 0) {
          this.activeStreams.splice(i, 1);
        }
      }
    }

    // 3. Dona-dona askarlar harakati
    const speedMultiplier = this.spellBuffs.rushDuration > 0 ? 1.8 : 1.0;

    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      const s = this.soldiers[i];
      const currentSpeed = s.baseSpeed * (s.owner === 'player' ? speedMultiplier : 1.0);
      const step = currentSpeed * dt;

      s.x += s.vx * step;
      s.y += s.vy * step;
      s.distanceTraveled += step;
      s.walkCycle += dt * 14;

      // Oyoq ostida mayda chang
      if (Math.random() < 0.1) {
        this.particles.push({
          x: s.x,
          y: s.y + 6,
          vx: -s.vx * 10,
          vy: -s.vy * 10,
          radius: 1.5,
          color: 'rgba(180, 170, 150, 0.35)',
          life: 0.3,
          maxLife: 0.3
        });
      }

      // 4. Yo'ldagi dushman askari bilan yakka-yakka to'qnashuv (Dona-dona duel)
      for (let j = i - 1; j >= 0; j--) {
        const other = this.soldiers[j];
        if (s.owner !== other.owner) {
          const dist = Math.hypot(s.x - other.x, s.y - other.y);
          if (dist < 12) {
            // Duel: ikkala askar ham to'qnashadi va zarba almashadi
            this.createClashSparks((s.x + other.x) / 2, (s.y + other.y) / 2);
            if (Math.random() < 0.2) sound.playClash();

            if (s.owner === 'player' || other.owner === 'player') {
              this.stats.enemiesKilled += 1;
            }

            // Ikkala askar yo'qoladi (1v1)
            this.soldiers.splice(i, 1);
            this.soldiers.splice(j, 1);
            break;
          }
        }
      }

      // Agar askar o'chirilgan bo'lsa keyingisiga o'tish
      if (!this.soldiers[i]) continue;

      // 5. Nishon binoga yetib kelganda
      if (s.distanceTraveled >= s.distanceTotal - s.target.radius + 6) {
        this.resolveSoldierArrival(s);
        this.soldiers.splice(i, 1);
      }
    }

    // 6. Fort kamonchilari o'qlari
    for (let p = this.projectiles.length - 1; p >= 0; p--) {
      const proj = this.projectiles[p];
      if (!this.soldiers.includes(proj.targetSoldier)) {
        this.projectiles.splice(p, 1);
        continue;
      }

      const pdx = proj.targetSoldier.x - proj.x;
      const pdy = proj.targetSoldier.y - proj.y;
      const pdist = Math.hypot(pdx, pdy);

      if (pdist < 10) {
        // Nishonga tegdi
        const idx = this.soldiers.indexOf(proj.targetSoldier);
        if (idx !== -1) {
          this.createClashSparks(proj.x, proj.y);
          this.soldiers.splice(idx, 1);
        }
        this.projectiles.splice(p, 1);
      } else {
        proj.x += (pdx / pdist) * proj.speed * dt;
        proj.y += (pdy / pdist) * proj.speed * dt;
      }
    }

    // 7. Zarrachalar yangilanishi
    for (let p = this.particles.length - 1; p >= 0; p--) {
      const pt = this.particles[p];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) {
        this.particles.splice(p, 1);
      }
    }

    // 8. AI va shartlarni tekshirish
    this.updateAI(dt);
    this.checkWinLossConditions();
    this.updateHUD();
  }

  handleFortShooting(fort, range) {
    let closestSoldier = null;
    let minDist = range;

    this.soldiers.forEach((s) => {
      if (s.owner !== fort.owner) {
        const d = Math.hypot(s.x - fort.x, s.y - fort.y);
        if (d < minDist) {
          minDist = d;
          closestSoldier = s;
        }
      }
    });

    if (closestSoldier) {
      this.projectiles.push({
        x: fort.x,
        y: fort.y - 15,
        targetSoldier: closestSoldier,
        speed: 280
      });
      sound.playArrow();
    }
  }

  // Dona-dona bitta askarning binoga kirishi
  resolveSoldierArrival(soldier) {
    const target = soldier.target;

    if (target.owner === soldier.owner) {
      // O'zimizning bino: garnizon bittaga ko'payadi
      target.troops += 1;
    } else {
      // Dushman yoki neytral bino mudofaasi
      const shieldBonus = target.shieldTimer > 0 ? 2.5 : 1.0;
      const totalDef = target.defenseBonus * shieldBonus;

      // Himoyachi ehtimoli
      if (target.troops > 0) {
        // Himoyachi bitta askarni to'xtatadi
        target.troops -= (1 / (1 + totalDef));
        if (soldier.owner === 'player') this.stats.enemiesKilled += 0.5;

        this.createClashSparks(soldier.x, soldier.y);

        if (target.troops <= 0) {
          // Bino quladi va egallandi!
          target.owner = soldier.owner;
          target.troops = 1;
          target.shieldTimer = 0;

          if (soldier.owner === 'player') {
            this.stats.castlesCaptured += 1;
            sound.playCapture();
          }

          this.createCaptureWave(target.x, target.y, FACTIONS[soldier.owner].color);
        }
      } else {
        target.owner = soldier.owner;
        target.troops = 1;
      }
    }
  }

  // ================= G'ALABA VA MAG'LUBIYAT =================
  checkWinLossConditions() {
    const playerCastles = this.castles.filter((c) => c.owner === 'player');
    const playerSoldiers = this.soldiers.filter((s) => s.owner === 'player');

    if (playerCastles.length === 0 && playerSoldiers.length === 0) {
      this.triggerDefeat();
      return;
    }

    const enemies = this.castles.filter((c) => c.owner !== 'player' && c.owner !== 'neutral');
    const enemySoldiers = this.soldiers.filter((s) => s.owner !== 'player');

    if (enemies.length === 0 && enemySoldiers.length === 0 && playerCastles.length > 0) {
      this.triggerVictory();
    }
  }

  triggerVictory() {
    this.state = 'VICTORY';
    sound.playVictory();

    let stars = 1;
    if (this.stats.elapsedSeconds < 160) stars++;
    if (this.stats.castlesCaptured >= Math.floor(this.castles.length * 0.6)) stars++;

    if (!this.isSkirmish) {
      const nextLevel = this.levelIndex + 1;
      if (nextLevel > this.saveData.unlockedLevel) {
        this.saveData.unlockedLevel = nextLevel;
      }
      this.saveData.levelStars[this.levelIndex] = Math.max(
        this.saveData.levelStars[this.levelIndex] || 0,
        stars
      );
      this.saveGameData();
    }

    const starEls = document.querySelectorAll('#victory-stars .star');
    starEls.forEach((el, idx) => {
      if (idx < stars) el.classList.add('active');
      else el.classList.remove('active');
    });

    const mins = Math.floor(this.stats.elapsedSeconds / 60).toString().padStart(2, '0');
    const secs = (this.stats.elapsedSeconds % 60).toString().padStart(2, '0');
    document.getElementById('stat-time').textContent = `${mins}:${secs}`;
    document.getElementById('stat-captured').textContent = this.stats.castlesCaptured;
    document.getElementById('stat-killed').textContent = Math.floor(this.stats.enemiesKilled);

    const nextBtn = document.getElementById('btn-next-level');
    if (this.isSkirmish || this.levelIndex >= CAMPAIGN_LEVELS.length) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'block';
    }

    document.getElementById('victory-modal').classList.remove('hidden');
  }

  triggerDefeat() {
    this.state = 'DEFEAT';
    sound.playDefeat();
    document.getElementById('defeat-modal').classList.remove('hidden');
  }

  // ================= HUD YANGILASH =================
  updateHUD() {
    document.getElementById('gold-count').textContent = Math.floor(this.gold);

    let totalArmy = 0;
    this.castles.forEach((c) => {
      if (c.owner === 'player') totalArmy += Math.floor(c.troops);
    });
    this.soldiers.forEach((s) => {
      if (s.owner === 'player') totalArmy += 1;
    });
    document.getElementById('total-army-count').textContent = totalArmy;

    if (this.currentLevel) {
      const scoreContainer = document.getElementById('kingdoms-score');
      scoreContainer.innerHTML = '';

      this.currentLevel.factions.forEach((fId) => {
        const f = FACTIONS[fId];
        const castleCount = this.castles.filter((c) => c.owner === fId).length;
        const badge = document.createElement('div');
        const colorClass = fId === 'player' ? 'blue' : fId;
        badge.className = `k-badge ${colorClass} ${castleCount === 0 ? 'dead' : ''}`;
        badge.innerHTML = `<span>${f.banner}</span> <span>${castleCount}</span>`;
        scoreContainer.appendChild(badge);
      });
    }

    this.updateSpellButton('lightning', 60);
    this.updateSpellButton('shield', 50);
    this.updateSpellButton('rush', 75);
    this.updateSpellButton('meteor', 100);
  }

  updateSpellButton(spellName, cost) {
    const btn = document.getElementById(`spell-${spellName}`);
    const cdEl = document.getElementById(`cd-${spellName}`);
    const cd = this.spellCooldowns[spellName];

    btn.disabled = this.gold < cost || cd > 0;
    if (cd > 0) {
      const maxCd = spellName === 'meteor' ? 30 : (spellName === 'rush' ? 25 : 20);
      const percent = (cd / maxCd) * 100;
      cdEl.style.height = `${percent}%`;
    } else {
      cdEl.style.height = '0%';
    }
  }

  // ================= ZARRACHALAR =================
  createClashSparks(x, y) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5,
        color: '#facc15',
        life: 0.25,
        maxLife: 0.25
      });
    }
  }

  createUpgradeParticles(x, y) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 70;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        radius: 2.5,
        color: '#ffd700',
        life: 0.6,
        maxLife: 0.6
      });
    }
  }

  createCaptureWave(x, y, color) {
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const speed = 70 + Math.random() * 40;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3.5,
        color: color,
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  createLightningEffect(x, y) {
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5,
        color: '#93c5fd',
        life: 0.4,
        maxLife: 0.4
      });
    }
  }

  createExplosionParticles(x, y) {
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 150;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,
        color: Math.random() < 0.6 ? '#f97316' : '#ef4444',
        life: 0.6,
        maxLife: 0.6
      });
    }
  }

  // ================= CHIZISH (RENDER) =================
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Fon
    this.renderMapBackground();

    // 2. Qal'alar orasidagi tosh yo'llar
    this.renderRoads();

    // 3. Faol oqim yo'llaridagi harakatlanuvchi ko'rsatkichlar
    this.renderActiveStreamFlows();

    // 4. Foydalanuvchi tortayotgan yo'nalish nuri
    this.renderDragArrow();

    // 5. Haqiqiy me'moriy binolar (Qal'alar)
    this.castles.forEach((c) => this.renderBuilding(c));

    // 6. Dona-dona individual askarlar
    this.soldiers.forEach((s) => this.renderIndividualSoldier(s));

    // 7. Fort kamonchilarining o'qlari
    this.renderProjectiles();

    // 8. Zarrachalar
    this.renderParticles();

    // 9. Guruhlab tanlash ramkasi
    if (this.isBoxSelecting) {
      this.renderSelectionBox();
    }
  }

  renderMapBackground() {
    this.ctx.fillStyle = '#101622';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Nozik maydon panjarasi
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    this.ctx.lineWidth = 1;
    const gridSize = 45;

    for (let x = 0; x < this.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }

  renderRoads() {
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.18)';
    this.ctx.lineWidth = 5;
    this.ctx.setLineDash([8, 8]);

    for (let i = 0; i < this.castles.length; i++) {
      for (let j = i + 1; j < this.castles.length; j++) {
        const c1 = this.castles[i];
        const c2 = this.castles[j];
        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        if (dist < 340) {
          this.ctx.beginPath();
          this.ctx.moveTo(c1.x, c1.y);
          this.ctx.lineTo(c2.x, c2.y);
          this.ctx.stroke();
        }
      }
    }
    this.ctx.setLineDash([]);
  }

  // Faol uzluksiz oqim (Streaming) yo'llari bo'ylab animatsion nurlar
  renderActiveStreamFlows() {
    const time = performance.now() * 0.003;

    this.activeStreams.forEach((stream) => {
      const src = stream.source;
      const tgt = stream.target;
      const faction = FACTIONS[stream.owner];

      this.ctx.save();
      this.ctx.strokeStyle = faction.lightColor;
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([6, 6]);
      this.ctx.lineDashOffset = -time * 25; // Oldinga oqish effekti

      this.ctx.beginPath();
      this.ctx.moveTo(src.x, src.y);
      this.ctx.lineTo(tgt.x, tgt.y);
      this.ctx.stroke();
      this.ctx.restore();
    });
  }

  renderDragArrow() {
    if (!this.dragStartCastle || !this.dragMousePos) return;

    this.selectedCastles.forEach((source) => {
      this.ctx.beginPath();
      this.ctx.moveTo(source.x, source.y);
      this.ctx.lineTo(this.dragMousePos.x, this.dragMousePos.y);
      this.ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([8, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      const angle = Math.atan2(this.dragMousePos.y - source.y, this.dragMousePos.x - source.x);
      this.ctx.save();
      this.ctx.translate(this.dragMousePos.x, this.dragMousePos.y);
      this.ctx.rotate(angle);
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(-12, -7);
      this.ctx.lineTo(-12, 7);
      this.ctx.closePath();
      this.ctx.fillStyle = '#facc15';
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  // ================= BINO KO'RINISHIDAGI QAL'ALAR (BUILDING RENDERER) =================
  renderBuilding(c) {
    const faction = FACTIONS[c.owner];
    const isSelected = this.selectedCastles.has(c);
    const isHovered = this.hoveredCastle === c;

    // Fort kamonchilari doirasi
    if (c.type === 'fort' && (isSelected || isHovered)) {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, CASTLE_TYPES.fort.shootRange, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Tanlangan bino ostida aylanuvchi oltin runik halqa
    if (isSelected) {
      this.ctx.save();
      this.ctx.translate(c.x, c.y + 6);
      this.ctx.rotate(performance.now() * 0.002);
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, c.radius + 14, (c.radius + 14) * 0.6, 0, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#facc15';
      this.ctx.lineWidth = 2.5;
      this.ctx.setLineDash([8, 6]);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Temir qalqon sehri aurosi
    if (c.shieldTimer > 0) {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, c.radius + 12, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
      this.ctx.fill();
      this.ctx.strokeStyle = '#60a5fa';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Bino soyasi
    this.ctx.beginPath();
    this.ctx.ellipse(c.x + 3, c.y + c.radius * 0.6, c.radius * 1.1, c.radius * 0.45, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fill();

    // Bino turiga ko'ra haqiqiy me'moriy shaklni chizish
    this.ctx.save();
    this.ctx.translate(c.x, c.y);

    if (c.type === 'capital') {
      this.drawPalaceBuilding(c, faction);
    } else if (c.type === 'fort') {
      this.drawFortressBuilding(c, faction);
    } else if (c.type === 'barracks') {
      this.drawBarracksBuilding(c, faction);
    } else if (c.type === 'mine') {
      this.drawMineBuilding(c, faction);
    }

    this.ctx.restore();

    // Bino tepasida yoki ostida garnizon ma'lumot nishoni (Badge)
    this.renderBuildingBadge(c, faction);
  }

  // 1. Poytaxt Saroyi (Royal Palace / Castle Keep)
  drawPalaceBuilding(c, faction) {
    const ctx = this.ctx;
    const wave = Math.sin(c.flagWave) * 3;

    // Asosiy tosh poydevor
    ctx.fillStyle = '#334155';
    ctx.fillRect(-32, -15, 64, 30);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-32, -15, 64, 30);

    // Tosh g'ishtlar chizig'i
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.strokeRect(-30, -10, 20, 10);
    ctx.strokeRect(-8, -10, 18, 10);
    ctx.strokeRect(12, -10, 18, 10);

    // Ikki yon tarafdagi minoralar
    [-28, 16].forEach((tx) => {
      ctx.fillStyle = '#475569';
      ctx.fillRect(tx, -32, 14, 28);
      ctx.strokeRect(tx, -32, 14, 28);

      // Minoraning tishli devori (Crenellations)
      ctx.fillStyle = '#334155';
      ctx.fillRect(tx - 2, -36, 6, 5);
      ctx.fillRect(tx + 10, -36, 6, 5);

      // Cho'qqili qizil/ko'k tom
      ctx.fillStyle = faction.color;
      ctx.beginPath();
      ctx.moveTo(tx - 2, -36);
      ctx.lineTo(tx + 7, -48);
      ctx.lineTo(tx + 16, -36);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = faction.lightColor;
      ctx.stroke();
    });

    // Markaziy oliy minora (Central Royal Keep)
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-14, -40, 28, 30);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(-14, -40, 28, 30);

    // Markaziy saroy tomi (Katta shoxona tom)
    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.moveTo(-18, -40);
    ctx.lineTo(0, -60);
    ctx.lineTo(18, -40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd700'; // Oltin qirra
    ctx.lineWidth = 2;
    ctx.stroke();

    // Markaziy cho'qqidagi oltin shpil / toj
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, -62, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Saroyning hilpirab turgan shohona bayrog'i
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.lineTo(0, -78);
    ctx.stroke();

    ctx.fillStyle = faction.lightColor;
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.lineTo(15 + wave, -73);
    ctx.lineTo(0, -68);
    ctx.closePath();
    ctx.fill();

    // Saroy darvozasi (Arkali yog'och darvoza)
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(0, 5, 8, Math.PI, 0, false);
    ctx.lineTo(8, 15);
    ctx.lineTo(-8, 15);
    ctx.closePath();
    ctx.fill();

    // Yoritilgan saroy derazalari
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-7, -30, 4, 7);
    ctx.fillRect(3, -30, 4, 7);
  }

  // 2. Tosh Istehkom (Fortress / Bastion)
  drawFortressBuilding(c, faction) {
    const ctx = this.ctx;
    const wave = Math.sin(c.flagWave) * 3;

    // Katta baquvvat tosh qal'a tanasi
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-32, 14);
    ctx.lineTo(-28, -20);
    ctx.lineTo(28, -20);
    ctx.lineTo(32, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Tishli qalin parapetlar (Crenellations)
    ctx.fillStyle = '#475569';
    for (let bx = -28; bx <= 22; bx += 10) {
      ctx.fillRect(bx, -28, 7, 9);
      ctx.strokeRect(bx, -28, 7, 9);
    }

    // Qirollik qalqoni fasadda
    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.arc(0, -4, 9, 0, Math.PI);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = faction.lightColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Temir panjarali mustahkam darvoza (Portcullis)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-9, 4, 18, 10);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-7, 5, 14, 9);

    // Kamondan o'q otish tirqishlari (Arrow slits)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-18, -12, 3, 9);
    ctx.fillRect(15, -12, 3, 9);

    // Tepasida o'rnatilgan mudofaa kamoni / ballista
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -32, 7, Math.PI * 0.2, Math.PI * 0.8, true);
    ctx.stroke();

    // Bayroq
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(18, -28);
    ctx.lineTo(18, -46);
    ctx.stroke();

    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.moveTo(18, -46);
    ctx.lineTo(30 + wave, -42);
    ctx.lineTo(18, -38);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Harbiy Kazarma (Barracks / Town Hall)
  drawBarracksBuilding(c, faction) {
    const ctx = this.ctx;
    const wave = Math.sin(c.flagWave) * 3;

    // Devorlar (Yog'och va tosh g'ishtli)
    ctx.fillStyle = '#475569';
    ctx.fillRect(-28, -12, 56, 26);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-28, -12, 56, 26);

    // Uchburchak shiferli harbiy tom
    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.moveTo(-33, -12);
    ctx.lineTo(0, -38);
    ctx.lineTo(33, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = faction.lightColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tom cherepitsa teksturasi
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.lineTo(16, -24);
    ctx.moveTo(-24, -18);
    ctx.lineTo(24, -18);
    ctx.stroke();

    // Qaychi qilichlar nishoni
    ctx.fillStyle = '#facc15';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️', 0, -18);

    // Mo'rilar (Chimney)
    ctx.fillStyle = '#334155';
    ctx.fillRect(16, -34, 6, 14);

    // Katta harbiy darvoza
    ctx.fillStyle = '#292524';
    ctx.fillRect(-8, 2, 16, 12);
    ctx.strokeStyle = '#78716c';
    ctx.strokeRect(-8, 2, 16, 12);

    // Bayroq
    ctx.strokeStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(-20, -12);
    ctx.lineTo(-20, -36);
    ctx.stroke();

    ctx.fillStyle = faction.lightColor;
    ctx.beginPath();
    ctx.moveTo(-20, -36);
    ctx.lineTo(-7 + wave, -32);
    ctx.lineTo(-20, -28);
    ctx.closePath();
    ctx.fill();
  }

  // 4. Oltin Koni / Xazina (Gold Mine / Vault)
  drawMineBuilding(c, faction) {
    const ctx = this.ctx;

    // Tosh tog'li kirish qoyasi
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.moveTo(-30, 14);
    ctx.lineTo(-26, -14);
    ctx.lineTo(0, -28);
    ctx.lineTo(26, -14);
    ctx.lineTo(30, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Kon tunnelining qorong'i og'zi
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(0, 4, 12, Math.PI, 0);
    ctx.lineTo(12, 14);
    ctx.lineTo(-12, 14);
    ctx.closePath();
    ctx.fill();

    // Yog'och ustunlar (Mine timber frame)
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.strokeRect(-12, 0, 24, 14);

    // Konda porlab turgan oltin tangalar va quymalar
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(-16, 11, 4, 0, Math.PI * 2);
    ctx.arc(-22, 12, 3.5, 0, Math.PI * 2);
    ctx.arc(16, 11, 4.5, 0, Math.PI * 2);
    ctx.arc(22, 12, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Tepasida xazina sandig'i yoki kran belgisi
    ctx.fillStyle = '#facc15';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪙', 0, -14);

    // Kichik kon bayrog'i
    ctx.strokeStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(18, -14);
    ctx.lineTo(18, -32);
    ctx.stroke();

    ctx.fillStyle = faction.color;
    ctx.fillRect(18, -32, 11, 7);
  }

  // Bino ostida zamonaviy va chiroyli garnizon ma'lumot nishoni
  renderBuildingBadge(c, faction) {
    const badgeY = c.y + c.radius - 2;
    const troopsText = Math.floor(c.troops).toString();

    // Qora metall taxta foni
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    this.ctx.beginPath();
    this.ctx.roundRect(c.x - 22, badgeY, 44, 20, 6);
    this.ctx.fill();

    this.ctx.strokeStyle = faction.lightColor;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Askar soni
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px Montserrat, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(troopsText, c.x, badgeY + 10);

    // Daraja yulduzlari
    if (c.level > 1) {
      const starY = c.y - c.radius - 8;
      const startX = c.x - (c.level - 1) * 6;
      for (let i = 0; i < c.level; i++) {
        this.ctx.fillStyle = '#facc15';
        this.ctx.font = '10px sans-serif';
        this.ctx.fillText('★', startX + i * 12, starY);
      }
    }
  }

  // ================= DONA-DONA INDIVIDUAL ASKAR RENDERERI =================
  renderIndividualSoldier(s) {
    const faction = FACTIONS[s.owner];
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(s.x, s.y);

    // Askar soyasi
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Harakatlanayotgan oyoqlar (Walking boots)
    const legOffset = Math.sin(s.walkCycle) * 3;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-3, 2 + legOffset, 2.5, 4);
    ctx.fillRect(1, 2 - legOffset, 2.5, 4);

    // Zirhli tana (Tunic in faction color)
    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.roundRect(-4.5, -4, 9, 8, 3);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Qalqon (Round shield with faction color)
    ctx.fillStyle = faction.lightColor;
    ctx.beginPath();
    ctx.arc(-5.5, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Qalqon markazidagi metall tugma
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(-5.5, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Po'lat dubulg'a (Steel helmet / head)
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(0, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    // Dubulg'a patlari (Plume)
    ctx.fillStyle = faction.color;
    ctx.fillRect(-1, -10, 2, 3);

    // Qilich yoki nayza (Pointing in movement direction)
    const angle = Math.atan2(s.vy, s.vx);
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();

    // Qilich dastasining oltin gardishi
    ctx.fillStyle = '#d97706';
    ctx.fillRect(2, -1.5, 1.5, 3);
    ctx.restore();

    ctx.restore();
  }

  renderProjectiles() {
    this.projectiles.forEach((p) => {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#f87171';
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  renderParticles() {
    this.particles.forEach((p) => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, Math.max(0.5, p.radius * (p.life / p.maxLife)), 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  renderSelectionBox() {
    const minX = Math.min(this.boxSelectStart.x, this.boxSelectCurrent.x);
    const maxX = Math.max(this.boxSelectStart.x, this.boxSelectCurrent.x);
    const minY = Math.min(this.boxSelectStart.y, this.boxSelectCurrent.y);
    const maxY = Math.max(this.boxSelectStart.y, this.boxSelectCurrent.y);

    this.ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
    this.ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    this.ctx.strokeStyle = '#60a5fa';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
  }

  // ================= ASOSIY O'YIN SIKLI =================
  gameLoop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// O'yinni ishga tushirish
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
