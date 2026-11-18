// ===================================================
// HUKMDOR: QIROLLIKLAR JANGI - ASOSIY O'YIN MOTORASI
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

    // O'yin dunyosi obyektlari
    this.castles = [];
    this.troopGroups = [];
    this.projectiles = [];
    this.particles = [];

    // Foydalanuvchi boshqaruvi
    this.selectedCastles = new Set();
    this.hoveredCastle = null;
    this.dragStartCastle = null;
    this.dragMousePos = null;
    this.dispatchRatio = 0.5; // 50% yoki 100%
    this.isBoxSelecting = false;
    this.boxSelectStart = { x: 0, y: 0 };
    this.boxSelectCurrent = { x: 0, y: 0 };

    // Sehr holati
    this.activeSpellTargeting = null; // 'lightning', 'shield', 'meteor'
    this.spellCooldowns = {
      lightning: 0,
      shield: 0,
      rush: 0,
      meteor: 0
    };
    this.spellBuffs = {
      rushDuration: 0
    };

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

    // Saqlangan ma'lumotlar (LocalStorage)
    this.saveData = this.loadSaveData();

    // Init
    this.initCanvasSize();
    this.setupEventListeners();
    this.renderCampaignLevels();
    this.updateHUD();

    // Asosiy sikl
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  // Mahalliy xotiradan o'qish
  loadSaveData() {
    try {
      const data = localStorage.getItem('hukmdor_save');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {
      unlockedLevel: 1,
      levelStars: {}
    };
  }

  saveGameData() {
    try {
      localStorage.setItem('hukmdor_save', JSON.stringify(this.saveData));
    } catch (e) {}
  }

  // Canvas o'lchami va DPI moslashuvi
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

    // Sichqoncha harakati
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelAction();
    });

    // Tugmalar
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

    // Audio tugmasi
    document.getElementById('btn-audio').addEventListener('click', () => {
      const muted = sound.toggleMute();
      document.getElementById('audio-icon').textContent = muted ? '🔇' : '🔊';
    });

    // Yuborish foizi
    const btn50 = document.getElementById('btn-dispatch-50');
    const btn100 = document.getElementById('btn-dispatch-100');
    btn50.addEventListener('click', () => {
      this.dispatchRatio = 0.5;
      btn50.classList.add('active');
      btn100.classList.remove('active');
      sound.playClick();
    });
    btn100.addEventListener('click', () => {
      this.dispatchRatio = 1.0;
      btn100.classList.add('active');
      btn50.classList.remove('active');
      sound.playClick();
    });

    // Tezkor tanlash va Yangilash
    document.getElementById('btn-select-all').addEventListener('click', () => this.selectAllPlayerCastles());
    document.getElementById('btn-upgrade-selected').addEventListener('click', () => this.upgradeSelectedCastles());

    // Bosh Menyu Tugmalari
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

    // Skirmish Sozlamalari
    this.setupSkirmishOptions();

    // Sehr Tugmalari
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

  // ================= KAMPANIYA BOSQICHLARI UI =================
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
    this.troopGroups = [];
    this.projectiles = [];
    this.particles = [];
    this.gold = 80;
    this.activeSpellTargeting = null;
    document.getElementById('spell-target-hint').classList.add('hidden');

    // Sehr taymerlari
    this.spellCooldowns = { lightning: 0, shield: 0, rush: 0, meteor: 0 };
    this.spellBuffs.rushDuration = 0;

    // Statistika
    this.stats = {
      startTime: Date.now(),
      elapsedSeconds: 0,
      castlesCaptured: 0,
      enemiesKilled: 0
    };

    // Qal'alarni xaritada qayta hisoblash
    this.recalculateCastlePositions();

    // UI Panellarini ochish
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

    // Canvas chegaralari bilan xavfsiz maydon
    const paddingX = Math.max(70, this.width * 0.08);
    const paddingY = Math.max(90, this.height * 0.14);
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
        maxCap: typeDef.baseCap * (1 + (c.level - 1) * 0.3),
        growthRate: typeDef.growthRate * (1 + (c.level - 1) * 0.25),
        defenseBonus: typeDef.defenseBonus + (c.level - 1) * 0.15,
        radius: typeDef.radius + (c.level - 1) * 4,
        shieldTimer: 0,
        shootTimer: 0,
        productionAccumulator: 0,
        flagWave: Math.random() * Math.PI * 2
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
      if (dist <= c.radius + 14) {
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

    // Tooltip yangilash
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

    // Agar sehr nishonini tanlash faol bo'lsa
    if (this.activeSpellTargeting) {
      this.resolveSpellCast(mouseX, mouseY);
      return;
    }

    const clickedCastle = this.getCastleAt(mouseX, mouseY);

    if (clickedCastle) {
      if (clickedCastle.owner === 'player') {
        // Shift bosilmagan bo'lsa va bu qal'a oldin tanlanmagan bo'lsa, avvalgilarini tozalash
        if (!e.shiftKey && !this.selectedCastles.has(clickedCastle)) {
          this.selectedCastles.clear();
        }
        this.selectedCastles.add(clickedCastle);
        this.dragStartCastle = clickedCastle;
        this.dragMousePos = { x: mouseX, y: mouseY };
        sound.playClick();
      } else {
        // Dushman yoki neytral qal'ani bosdi: agar o'zimizning qal'alarimiz tanlangan bo'lsa, hujum yuborish!
        if (this.selectedCastles.size > 0) {
          this.dispatchTroopsTo(clickedCastle);
        }
      }
    } else {
      // Bo'sh joy bosildi -> Box selection (Ramka bilan tanlash) boshlanishi
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
        this.dispatchTroopsTo(targetCastle);
      }
      this.dragStartCastle = null;
      this.dragMousePos = null;
    }

    if (this.isBoxSelecting) {
      this.isBoxSelecting = false;
      // Ramka ichiga tushgan barcha o'yinchi qal'alarini tanlash
      const minX = Math.min(this.boxSelectStart.x, this.boxSelectCurrent.x);
      const maxX = Math.max(this.boxSelectStart.x, this.boxSelectCurrent.x);
      const minY = Math.min(this.boxSelectStart.y, this.boxSelectCurrent.y);
      const maxY = Math.max(this.boxSelectStart.y, this.boxSelectCurrent.y);

      // Agar ramka juda kichik bo'lsa e'tiborsiz qoldirish
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

  // Tanlangan qal'alardan nishonga askar jo'natish
  dispatchTroopsTo(targetCastle) {
    let anySent = false;

    this.selectedCastles.forEach((sourceCastle) => {
      if (sourceCastle === targetCastle) return;

      const toSend = Math.floor(sourceCastle.troops * this.dispatchRatio);
      if (toSend > 0) {
        sourceCastle.troops -= toSend;
        this.spawnTroopGroup(sourceCastle, targetCastle, toSend, sourceCastle.owner);
        anySent = true;
      }
    });

    if (anySent) {
      sound.playMarch();
    }
  }

  // ================= QO'SHIN HARAKATI VA JANG =================
  spawnTroopGroup(source, target, count, owner) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);

    this.troopGroups.push({
      id: Math.random().toString(36).substr(2, 9),
      sourceId: source.id,
      targetId: target.id,
      target: target,
      owner: owner,
      count: count,
      initialCount: count,
      x: source.x,
      y: source.y,
      vx: (dx / distance),
      vy: (dy / distance),
      distanceTotal: distance,
      distanceTraveled: 0,
      baseSpeed: 95, // piksel/sekund
      animTimer: 0
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
        c.radius = typeDef.radius + (c.level - 1) * 4;

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
    this.spellCooldowns.rush = 25; // 25s cooldown
    this.spellBuffs.rushDuration = 8; // 8 soniya davomida otliq tezligi
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
        // Qal'aga chaqmoq
        const damage = Math.floor(clicked.troops * 0.5) + 10;
        clicked.troops = Math.max(0, clicked.troops - damage);
        this.createLightningEffect(clicked.x, clicked.y);
      } else {
        // Bo'sh joyga chaqmoq: yaqin atrofdagi dushman qo'shinlarini tor-mor qiladi
        this.createLightningEffect(x, y);
        this.troopGroups.forEach((tg) => {
          if (tg.owner !== 'player' && Math.hypot(tg.x - x, tg.y - y) < 80) {
            tg.count = Math.max(0, tg.count - 25);
          }
        });
      }
      sound.playLightning();
    } else if (spell === 'shield') {
      if (!clicked || clicked.owner !== 'player') return;
      if (this.gold < 50) return;
      this.gold -= 50;
      this.spellCooldowns.shield = 22;

      clicked.shieldTimer = 12; // 12 soniya mudofaa
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
          const dmg = Math.floor(25 + clicked.troops * 0.4);
          clicked.troops = Math.max(0, clicked.troops - dmg);
          if (clicked.level > 1 && Math.random() < 0.5) {
            clicked.level -= 1; // Devorlarni sindirish
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
    // Har 1.8 soniyada AI qaror qabul qiladi
    if (this.aiTickTimer < 1.8) return;
    this.aiTickTimer = 0;

    const aiFactions = this.currentLevel.factions.filter((f) => f !== 'player');

    aiFactions.forEach((fId) => {
      const owned = this.castles.filter((c) => c.owner === fId);
      if (owned.length === 0) return;

      const otherCastles = this.castles.filter((c) => c.owner !== fId);
      if (otherCastles.length === 0) return;

      const fConfig = FACTIONS[fId];
      const personality = fConfig.personality || 'aggressive';

      // 1. Oltin to'plansa qal'ani kuchaytirish ehtimoli
      owned.forEach((c) => {
        if (c.level < 3 && c.troops > 40 && Math.random() < 0.25) {
          c.level += 1;
          const typeDef = CASTLE_TYPES[c.type];
          c.maxCap = typeDef.baseCap * (1 + (c.level - 1) * 0.35);
          c.growthRate = typeDef.growthRate * (1 + (c.level - 1) * 0.3);
          c.defenseBonus = typeDef.defenseBonus + (c.level - 1) * 0.15;
          this.createUpgradeParticles(c.x, c.y);
        }
      });

      // 2. Hujum uchun manba qal'a tanlash
      // Ko'p askarga ega qal'ani tanlaymiz
      const readySources = owned.filter((c) => c.troops >= 16);
      if (readySources.length === 0) return;

      const source = readySources[Math.floor(Math.random() * readySources.length)];

      // 3. Nishon tanlash (Neytral yoki zaif dushman)
      let bestTarget = null;
      let bestScore = -9999;

      otherCastles.forEach((target) => {
        const dist = Math.hypot(target.x - source.x, target.y - source.y);
        let score = 0;

        // Neytral qal'alarni egallash jozibador
        if (target.owner === 'neutral') score += 50;

        // Zaif qal'alarga ko'proq e'tibor
        score -= target.troops * 1.5;

        // Yaqin qal'alar afzal
        score -= dist * 0.12;

        // Agar qal'a turi oltin koni yoki kazarma bo'lsa
        if (target.type === 'mine') score += 30;
        if (target.type === 'barracks') score += 25;

        // Shaxsiyatga ko'ra tuzatish
        if (personality === 'aggressive' && target.owner === 'player') score += 40;
        if (personality === 'opportunist' && target.troops < 15) score += 45;

        if (score > bestScore) {
          bestScore = score;
          bestTarget = target;
        }
      });

      if (bestTarget) {
        // Hujum yuborish
        const dispatchRatio = personality === 'aggressive' ? 0.65 : 0.5;
        const toSend = Math.floor(source.troops * dispatchRatio);
        if (toSend >= 10) {
          source.troops -= toSend;
          this.spawnTroopGroup(source, bestTarget, toSend, fId);
        }
      }
    });
  }

  // ================= YANGILANISH (UPDATE TICK) =================
  update(dt) {
    if (this.state !== 'PLAYING') return;

    // Vaqt hisobi
    this.stats.elapsedSeconds = Math.floor((Date.now() - this.stats.startTime) / 1000);

    // Sehr buff va cooldownlarini pasaytirish
    for (const s in this.spellCooldowns) {
      if (this.spellCooldowns[s] > 0) {
        this.spellCooldowns[s] = Math.max(0, this.spellCooldowns[s] - dt);
      }
    }
    if (this.spellBuffs.rushDuration > 0) {
      this.spellBuffs.rushDuration = Math.max(0, this.spellBuffs.rushDuration - dt);
    }

    // 1. Qal'alar: askar ishlab chiqarish va oltin tushumi
    this.castles.forEach((c) => {
      c.flagWave += dt * 3;

      if (c.shieldTimer > 0) {
        c.shieldTimer = Math.max(0, c.shieldTimer - dt);
      }

      if (c.owner !== 'neutral') {
        // Askar o'sishi
        c.productionAccumulator += c.growthRate * dt;
        if (c.productionAccumulator >= 1) {
          const add = Math.floor(c.productionAccumulator);
          c.productionAccumulator -= add;
          if (c.troops < c.maxCap) {
            c.troops = Math.min(c.maxCap, c.troops + add);
          }
        }

        // Oltin ishlab chiqarish
        const typeDef = CASTLE_TYPES[c.type];
        if (c.owner === 'player') {
          this.gold += (typeDef.goldRate || 1) * dt;
        }

        // Istehkom (Fort) kamonchilaridan o'q otish
        if (typeDef.canShoot) {
          c.shootTimer = (c.shootTimer || 0) + dt * 1000;
          if (c.shootTimer >= typeDef.shootInterval) {
            c.shootTimer = 0;
            this.handleFortShooting(c, typeDef.shootRange);
          }
        }
      }
    });

    // 2. Harakatdagi qo'shinlar
    const speedMultiplier = this.spellBuffs.rushDuration > 0 ? 1.8 : 1.0;

    for (let i = this.troopGroups.length - 1; i >= 0; i--) {
      const tg = this.troopGroups[i];
      const speed = tg.baseSpeed * (tg.owner === 'player' ? speedMultiplier : 1.0);
      const step = speed * dt;

      tg.x += tg.vx * step;
      tg.y += tg.vy * step;
      tg.distanceTraveled += step;
      tg.animTimer += dt * 12;

      // Chang zarrachalarini chiqarish
      if (Math.random() < 0.15) {
        this.particles.push({
          x: tg.x + (Math.random() - 0.5) * 8,
          y: tg.y + (Math.random() - 0.5) * 8,
          vx: -tg.vx * 10,
          vy: -tg.vy * 10,
          radius: 2 + Math.random() * 2,
          color: 'rgba(200, 190, 170, 0.4)',
          life: 0.35,
          maxLife: 0.35
        });
      }

      // 3. Yo'ldagi dushman qo'shinlari bilan to'qnashuv (Frontline clash)
      for (let j = i - 1; j >= 0; j--) {
        const other = this.troopGroups[j];
        if (tg.owner !== other.owner) {
          const dist = Math.hypot(tg.x - other.x, tg.y - other.y);
          if (dist < 18) {
            // To'qnashuv yuz berdi!
            const clashDamage = Math.min(tg.count, other.count, Math.ceil(dt * 30));
            tg.count -= clashDamage;
            other.count -= clashDamage;

            this.createClashSparks((tg.x + other.x) / 2, (tg.y + other.y) / 2);
            if (Math.random() < 0.1) sound.playClash();

            if (tg.owner === 'player') this.stats.enemiesKilled += clashDamage;
            if (other.owner === 'player') this.stats.enemiesKilled += clashDamage;
          }
        }
      }

      // Agar qo'shin butunlay yo'q qilingan bo'lsa
      if (tg.count <= 0) {
        this.troopGroups.splice(i, 1);
        continue;
      }

      // Manzilga yetib keldimi?
      if (tg.distanceTraveled >= tg.distanceTotal - tg.target.radius) {
        this.resolveTroopArrival(tg);
        this.troopGroups.splice(i, 1);
      }
    }

    // 4. Snaryadlar (Kamondan otilgan o'qlar)
    for (let p = this.projectiles.length - 1; p >= 0; p--) {
      const proj = this.projectiles[p];
      const pdx = proj.targetGroup.x - proj.x;
      const pdy = proj.targetGroup.y - proj.y;
      const pdist = Math.hypot(pdx, pdy);

      if (pdist < 10 || !this.troopGroups.includes(proj.targetGroup)) {
        if (this.troopGroups.includes(proj.targetGroup)) {
          proj.targetGroup.count = Math.max(0, proj.targetGroup.count - proj.damage);
          this.createClashSparks(proj.x, proj.y);
        }
        this.projectiles.splice(p, 1);
      } else {
        proj.x += (pdx / pdist) * proj.speed * dt;
        proj.y += (pdy / pdist) * proj.speed * dt;
      }
    }

    // 5. Zarrachalar (Particles)
    for (let p = this.particles.length - 1; p >= 0; p--) {
      const pt = this.particles[p];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) {
        this.particles.splice(p, 1);
      }
    }

    // 6. AI Boshqaruvi
    this.updateAI(dt);

    // 7. G'alaba / Mag'lubiyat holatini tekshirish
    this.checkWinLossConditions();

    // HUD yangilash
    this.updateHUD();
  }

  handleFortShooting(fort, range) {
    // Range ichidagi eng yaqin dushman qo'shinini topish
    let closestGroup = null;
    let minDist = range;

    this.troopGroups.forEach((tg) => {
      if (tg.owner !== fort.owner) {
        const d = Math.hypot(tg.x - fort.x, tg.y - fort.y);
        if (d < minDist) {
          minDist = d;
          closestGroup = tg;
        }
      }
    });

    if (closestGroup) {
      this.projectiles.push({
        x: fort.x,
        y: fort.y,
        targetGroup: closestGroup,
        speed: 260,
        damage: 3 + fort.level * 2
      });
      sound.playArrow();
    }
  }

  // Qo'shin manzil qal'asiga yetib kelganda
  resolveTroopArrival(tg) {
    const target = tg.target;

    if (target.owner === tg.owner) {
      // O'zimizning qal'aga kuch qo'shildi
      target.troops += tg.count;
    } else {
      // Hujum / Qamal!
      // Mudofaa kuchi
      const shieldBonus = target.shieldTimer > 0 ? 2.5 : 1.0;
      const totalDef = target.defenseBonus * shieldBonus;
      const effectiveAttack = tg.count;
      const defenderLoss = Math.floor(effectiveAttack / (1 + totalDef));

      if (target.troops > defenderLoss) {
        target.troops -= defenderLoss;
        if (tg.owner === 'player') this.stats.enemiesKilled += defenderLoss;
      } else {
        // Qal'a egallandi!
        const remainingAttackers = tg.count - Math.floor(target.troops * (1 + totalDef));
        const prevOwner = target.owner;
        target.owner = tg.owner;
        target.troops = Math.max(1, remainingAttackers);
        target.shieldTimer = 0;

        if (tg.owner === 'player') {
          this.stats.castlesCaptured += 1;
          sound.playCapture();
        }

        this.createCaptureWave(target.x, target.y, FACTIONS[tg.owner].color);
      }
    }
  }

  // G'alaba / Mag'lubiyat shartlari
  checkWinLossConditions() {
    const playerCastles = this.castles.filter((c) => c.owner === 'player');
    const playerTroops = this.troopGroups.filter((tg) => tg.owner === 'player');

    // Mag'lubiyat: o'yinchining qal'alari ham, askarlari ham qolmadi
    if (playerCastles.length === 0 && playerTroops.length === 0) {
      this.triggerDefeat();
      return;
    }

    // G'alaba: xaritadagi barcha boshqa qirolliklar butunlay yo'q qilindi
    const enemies = this.castles.filter((c) => c.owner !== 'player' && c.owner !== 'neutral');
    const enemyTroops = this.troopGroups.filter((tg) => tg.owner !== 'player');

    if (enemies.length === 0 && enemyTroops.length === 0 && playerCastles.length > 0) {
      this.triggerVictory();
    }
  }

  triggerVictory() {
    this.state = 'VICTORY';
    sound.playVictory();

    // Yulduzlarni hisoblash (Vaqt va yo'qotishlar bo'yicha)
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

    // UI da yulduzlarni ko'rsatish
    const starEls = document.querySelectorAll('#victory-stars .star');
    starEls.forEach((el, idx) => {
      if (idx < stars) el.classList.add('active');
      else el.classList.remove('active');
    });

    // Statistikani ko'rsatish
    const mins = Math.floor(this.stats.elapsedSeconds / 60).toString().padStart(2, '0');
    const secs = (this.stats.elapsedSeconds % 60).toString().padStart(2, '0');
    document.getElementById('stat-time').textContent = `${mins}:${secs}`;
    document.getElementById('stat-captured').textContent = this.stats.castlesCaptured;
    document.getElementById('stat-killed').textContent = this.stats.enemiesKilled;

    // Oxirgi bosqich bo'lsa "Keyingi bosqich" tugmasini yashirish
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
      if (c.owner === 'player') totalArmy += c.troops;
    });
    this.troopGroups.forEach((tg) => {
      if (tg.owner === 'player') totalArmy += tg.count;
    });
    document.getElementById('total-army-count').textContent = totalArmy;

    // Qirolliklar reytingi va holati
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

    // Sehr tugmalari va cooldown vizuallari
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

  // ================= ZARRACHALAR (EFFECTS) =================
  createClashSparks(x, y) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 1.5,
        color: '#facc15',
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4
      });
    }
  }

  createUpgradeParticles(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        radius: 2.5 + Math.random() * 2,
        color: '#ffd700',
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0
      });
    }
  }

  createCaptureWave(x, y, color) {
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
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
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8
      });
    }
  }

  // ================= CHIZISH (RENDER) =================
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. O'rta asr pergament xaritasi foni
    this.renderMapBackground();

    // 2. Qal'alar o'rtasidagi yo'llar
    this.renderRoads();

    // 3. Foydalanuvchi tortayotgan yo'nalish nuri (Drag Arrow)
    this.renderDragArrow();

    // 4. Qal'alar
    this.castles.forEach((c) => this.renderCastle(c));

    // 5. Harakatdagi askarlar
    this.troopGroups.forEach((tg) => this.renderTroopGroup(tg));

    // 6. Snaryadlar (Kamondan o'qlar)
    this.renderProjectiles();

    // 7. Zarrachalar (Particles)
    this.renderParticles();

    // 8. Box Selection (Ramka)
    if (this.isBoxSelecting) {
      this.renderSelectionBox();
    }
  }

  renderMapBackground() {
    // Elegant xarita qatlami
    this.ctx.fillStyle = '#111722';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Xarita relyefi: nozik panjara va daryolar
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
    // Qal'alar o'rtasida nozik toshli yo'llar
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)';
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([6, 6]);

    for (let i = 0; i < this.castles.length; i++) {
      for (let j = i + 1; j < this.castles.length; j++) {
        const c1 = this.castles[i];
        const c2 = this.castles[j];
        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        // Faqat ma'lum masofadagi qo'shnilar orasiga yo'l chizamiz
        if (dist < 320) {
          this.ctx.beginPath();
          this.ctx.moveTo(c1.x, c1.y);
          this.ctx.lineTo(c2.x, c2.y);
          this.ctx.stroke();
        }
      }
    }
    this.ctx.setLineDash([]);
  }

  renderCastle(c) {
    const faction = FACTIONS[c.owner];
    const isSelected = this.selectedCastles.has(c);
    const isHovered = this.hoveredCastle === c;

    // Fort bo'lsa otish doirasi
    if (c.type === 'fort' && (isSelected || isHovered)) {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, CASTLE_TYPES.fort.shootRange, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Tanlangan qal'a aylanasi (Aylanuvchi oltin halqa)
    if (isSelected) {
      this.ctx.save();
      this.ctx.translate(c.x, c.y);
      this.ctx.rotate(performance.now() * 0.002);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, c.radius + 10, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#facc15';
      this.ctx.lineWidth = 2.5;
      this.ctx.setLineDash([8, 6]);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Qalqon sehri gumbazi (Shield Aura)
    if (c.shieldTimer > 0) {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, c.radius + 8, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
      this.ctx.fill();
      this.ctx.strokeStyle = '#60a5fa';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Qal'a soyasi
    this.ctx.beginPath();
    this.ctx.arc(c.x + 3, c.y + 4, c.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.ctx.fill();

    // Asosiy tosh doirasi
    this.ctx.beginPath();
    this.ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = faction.color;
    this.ctx.fill();
    this.ctx.strokeStyle = faction.lightColor;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Ichki naqsh / devor relyefi
    this.ctx.beginPath();
    this.ctx.arc(c.x, c.y, c.radius - 5, 0, Math.PI * 2);
    this.ctx.fillStyle = faction.darkColor;
    this.ctx.fill();

    // Qal'a piktogrammasi (👑, 🛡️, ⚔️, 🪙)
    const typeDef = CASTLE_TYPES[c.type];
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(typeDef.icon, c.x, c.y - 8);

    // Askar soni (Garrison count)
    this.ctx.font = 'bold 15px Montserrat, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(Math.floor(c.troops), c.x, c.y + 9);

    // Hilpirab turgan bayroq
    this.renderFlag(c, faction);

    // Qal'a darajasi yulduzlari
    this.renderLevelStars(c);
  }

  renderFlag(c, faction) {
    const flagX = c.x + c.radius - 8;
    const flagY = c.y - c.radius - 6;

    // Ustun
    this.ctx.strokeStyle = '#d4af37';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(flagX, flagY + 18);
    this.ctx.lineTo(flagX, flagY);
    this.ctx.stroke();

    // Hilpirash
    const wave = Math.sin(c.flagWave) * 3;
    this.ctx.fillStyle = faction.lightColor;
    this.ctx.beginPath();
    this.ctx.moveTo(flagX, flagY);
    this.ctx.lineTo(flagX + 14 + wave, flagY + 4);
    this.ctx.lineTo(flagX, flagY + 9);
    this.ctx.closePath();
    this.ctx.fill();
  }

  renderLevelStars(c) {
    if (c.level <= 1) return;
    const startX = c.x - (c.level - 1) * 6;
    const starY = c.y + c.radius + 10;

    for (let i = 0; i < c.level; i++) {
      this.ctx.fillStyle = '#facc15';
      this.ctx.font = '10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('★', startX + i * 12, starY);
    }
  }

  renderTroopGroup(tg) {
    const faction = FACTIONS[tg.owner];

    // Askar guruhi belgisi
    this.ctx.save();
    this.ctx.translate(tg.x, tg.y);

    // Soyasi
    this.ctx.beginPath();
    this.ctx.arc(2, 2, 11, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this.ctx.fill();

    // Asosiy jangchi doirasi
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 11, 0, Math.PI * 2);
    this.ctx.fillStyle = faction.color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Askar soni
    this.ctx.font = 'bold 10px Montserrat, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(tg.count, 0, 1);

    this.ctx.restore();
  }

  renderProjectiles() {
    this.projectiles.forEach((p) => {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
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

  renderDragArrow() {
    if (!this.dragStartCastle || !this.dragMousePos) return;

    this.selectedCastles.forEach((source) => {
      this.ctx.beginPath();
      this.ctx.moveTo(source.x, source.y);
      this.ctx.lineTo(this.dragMousePos.x, this.dragMousePos.y);
      this.ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([8, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // O'q uchi
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

