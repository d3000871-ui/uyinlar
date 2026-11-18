// ===================================================
// HUKMDOR: QIROLLIKLAR JANGI - XARITA VA BOSQICHLAR
// ===================================================

const FACTIONS = {
  player: {
    id: 'player',
    name: "Moviy Saltanat",
    color: '#2563eb',
    lightColor: '#60a5fa',
    darkColor: '#1d4ed8',
    glowColor: 'rgba(37, 99, 235, 0.6)',
    banner: '🔵',
    isPlayer: true
  },
  red: {
    id: 'red',
    name: "Qizil O'rda",
    color: '#dc2626',
    lightColor: '#f87171',
    darkColor: '#991b1b',
    glowColor: 'rgba(220, 38, 38, 0.6)',
    banner: '🔴',
    isPlayer: false,
    personality: 'aggressive' // Ko'proq va tez hujum qiladi
  },
  green: {
    id: 'green',
    name: "Zumrad Xonligi",
    color: '#16a34a',
    lightColor: '#4ade80',
    darkColor: '#166534',
    glowColor: 'rgba(22, 163, 74, 0.6)',
    banner: '🟢',
    isPlayer: false,
    personality: 'defensive' // Qal'alarini mustahkamlaydi, zaiflarga hujum qiladi
  },
  yellow: {
    id: 'yellow',
    name: "Oltin Qabila",
    color: '#d97706',
    lightColor: '#fbbf24',
    darkColor: '#92400e',
    glowColor: 'rgba(217, 119, 6, 0.6)',
    banner: '🟡',
    isPlayer: false,
    personality: 'opportunist' // Urushayotgan tomonlarning zaiflashgan qal'alarini uradi
  },
  neutral: {
    id: 'neutral',
    name: "Neytral Shahar",
    color: '#64748b',
    lightColor: '#94a3b8',
    darkColor: '#334155',
    glowColor: 'rgba(148, 163, 184, 0.3)',
    banner: '⚪',
    isPlayer: false
  }
};

const CASTLE_TYPES = {
  capital: {
    id: 'capital',
    name: "Poytaxt",
    icon: '👑',
    baseCap: 90,
    growthRate: 1.8,
    defenseBonus: 0.35,
    goldRate: 1.5,
    canShoot: false,
    radius: 36
  },
  fort: {
    id: 'fort',
    name: "Istehkom (Fort)",
    icon: '🛡️',
    baseCap: 75,
    growthRate: 1.0,
    defenseBonus: 0.70, // 70% ko'proq mudofaa
    goldRate: 0.8,
    canShoot: true,
    shootRange: 160,
    shootInterval: 1200, // ms
    radius: 34
  },
  barracks: {
    id: 'barracks',
    name: "Kazarma",
    icon: '⚔️',
    baseCap: 65,
    growthRate: 2.6, // Askar juda tez chiqadi
    defenseBonus: 0.15,
    goldRate: 0.5,
    canShoot: false,
    radius: 32
  },
  mine: {
    id: 'mine',
    name: "Oltin Koni",
    icon: '🪙',
    baseCap: 50,
    growthRate: 0.8,
    defenseBonus: 0.20,
    goldRate: 4.5, // Katta miqdorda oltin
    canShoot: false,
    radius: 30
  }
};

// Kampaniya bosqichlari (Nisbiy koordinatalar 0.0 dan 1.0 gacha)
const CAMPAIGN_LEVELS = [
  {
    id: 1,
    title: "Birinchi Qadam",
    desc: "1 ta dushmanga qarshi jang. Yaqin neytral shaharlarni egallab kuch to'plang.",
    factions: ['player', 'red'],
    aiDifficulty: 'easy',
    castles: [
      { id: 1, x: 0.18, y: 0.5, owner: 'player', type: 'capital', troops: 35, level: 1 },
      { id: 2, x: 0.82, y: 0.5, owner: 'red', type: 'capital', troops: 35, level: 1 },
      { id: 3, x: 0.38, y: 0.3, owner: 'neutral', type: 'mine', troops: 12, level: 1 },
      { id: 4, x: 0.62, y: 0.3, owner: 'neutral', type: 'mine', troops: 12, level: 1 },
      { id: 5, x: 0.50, y: 0.5, owner: 'neutral', type: 'barracks', troops: 18, level: 1 },
      { id: 6, x: 0.50, y: 0.78, owner: 'neutral', type: 'fort', troops: 20, level: 1 }
    ]
  },
  {
    id: 2,
    title: "Qonli Daryo",
    desc: "Uch tomonlama shiddatli urush. Daryo orqali o'tish yo'llarini himoya qiling.",
    factions: ['player', 'red', 'green'],
    aiDifficulty: 'normal',
    castles: [
      { id: 1, x: 0.15, y: 0.8, owner: 'player', type: 'capital', troops: 40, level: 1 },
      { id: 2, x: 0.85, y: 0.8, owner: 'red', type: 'capital', troops: 40, level: 1 },
      { id: 3, x: 0.50, y: 0.18, owner: 'green', type: 'capital', troops: 40, level: 1 },
      { id: 4, x: 0.30, y: 0.55, owner: 'neutral', type: 'barracks', troops: 16, level: 1 },
      { id: 5, x: 0.70, y: 0.55, owner: 'neutral', type: 'barracks', troops: 16, level: 1 },
      { id: 6, x: 0.50, y: 0.48, owner: 'neutral', type: 'fort', troops: 25, level: 1 },
      { id: 7, x: 0.35, y: 0.28, owner: 'neutral', type: 'mine', troops: 14, level: 1 },
      { id: 8, x: 0.65, y: 0.28, owner: 'neutral', type: 'mine', troops: 14, level: 1 },
      { id: 9, x: 0.50, y: 0.82, owner: 'neutral', type: 'mine', troops: 15, level: 1 }
    ]
  },
  {
    id: 3,
    title: "Tog'li Istehkomlar",
    desc: "Strategik balandliklar va kuchli fortlar. Kamonchilar o'qidan saqlaning!",
    factions: ['player', 'red', 'green'],
    aiDifficulty: 'normal',
    castles: [
      { id: 1, x: 0.12, y: 0.3, owner: 'player', type: 'capital', troops: 45, level: 1 },
      { id: 2, x: 0.88, y: 0.3, owner: 'red', type: 'capital', troops: 45, level: 1 },
      { id: 3, x: 0.88, y: 0.75, owner: 'green', type: 'capital', troops: 45, level: 1 },
      { id: 4, x: 0.12, y: 0.75, owner: 'neutral', type: 'fort', troops: 30, level: 1 },
      { id: 5, x: 0.35, y: 0.22, owner: 'neutral', type: 'barracks', troops: 18, level: 1 },
      { id: 6, x: 0.65, y: 0.22, owner: 'neutral', type: 'mine', troops: 15, level: 1 },
      { id: 7, x: 0.50, y: 0.45, owner: 'neutral', type: 'fort', troops: 35, level: 2 },
      { id: 8, x: 0.35, y: 0.68, owner: 'neutral', type: 'mine', troops: 15, level: 1 },
      { id: 9, x: 0.65, y: 0.68, owner: 'neutral', type: 'barracks', troops: 18, level: 1 },
      { id: 10, x: 0.50, y: 0.82, owner: 'neutral', type: 'mine', troops: 20, level: 1 }
    ]
  },
  {
    id: 4,
    title: "To'rt Qirollik Urushi",
    desc: "To'rttala buyuk imperiya to'qnashdi. Har tomondan tahdid mavjud!",
    factions: ['player', 'red', 'green', 'yellow'],
    aiDifficulty: 'hard',
    castles: [
      { id: 1, x: 0.15, y: 0.18, owner: 'player', type: 'capital', troops: 50, level: 1 },
      { id: 2, x: 0.85, y: 0.18, owner: 'red', type: 'capital', troops: 50, level: 1 },
      { id: 3, x: 0.85, y: 0.82, owner: 'green', type: 'capital', troops: 50, level: 1 },
      { id: 4, x: 0.15, y: 0.82, owner: 'yellow', type: 'capital', troops: 50, level: 1 },
      { id: 5, x: 0.38, y: 0.28, owner: 'neutral', type: 'barracks', troops: 18, level: 1 },
      { id: 6, x: 0.62, y: 0.28, owner: 'neutral', type: 'mine', troops: 18, level: 1 },
      { id: 7, x: 0.50, y: 0.50, owner: 'neutral', type: 'fort', troops: 45, level: 2 },
      { id: 8, x: 0.38, y: 0.72, owner: 'neutral', type: 'mine', troops: 18, level: 1 },
      { id: 9, x: 0.62, y: 0.72, owner: 'neutral', type: 'barracks', troops: 18, level: 1 },
      { id: 10, x: 0.22, y: 0.50, owner: 'neutral', type: 'fort', troops: 25, level: 1 },
      { id: 11, x: 0.78, y: 0.50, owner: 'neutral', type: 'fort', troops: 25, level: 1 }
    ]
  },
  {
    id: 5,
    title: "Imperator Toji",
    desc: "Eng yirik xarita! 15 ta shahar va qal'a. Toj faqat eng kuchli hukmdorniki bo'ladi!",
    factions: ['player', 'red', 'green', 'yellow'],
    aiDifficulty: 'hard',
    castles: [
      { id: 1, x: 0.10, y: 0.15, owner: 'player', type: 'capital', troops: 55, level: 2 },
      { id: 2, x: 0.90, y: 0.15, owner: 'red', type: 'capital', troops: 55, level: 2 },
      { id: 3, x: 0.90, y: 0.85, owner: 'green', type: 'capital', troops: 55, level: 2 },
      { id: 4, x: 0.10, y: 0.85, owner: 'yellow', type: 'capital', troops: 55, level: 2 },
      { id: 5, x: 0.30, y: 0.25, owner: 'neutral', type: 'barracks', troops: 20, level: 1 },
      { id: 6, x: 0.70, y: 0.25, owner: 'neutral', type: 'mine', troops: 20, level: 1 },
      { id: 7, x: 0.30, y: 0.75, owner: 'neutral', type: 'mine', troops: 20, level: 1 },
      { id: 8, x: 0.70, y: 0.75, owner: 'neutral', type: 'barracks', troops: 20, level: 1 },
      { id: 9, x: 0.50, y: 0.18, owner: 'neutral', type: 'fort', troops: 30, level: 1 },
      { id: 10, x: 0.50, y: 0.82, owner: 'neutral', type: 'fort', troops: 30, level: 1 },
      { id: 11, x: 0.16, y: 0.50, owner: 'neutral', type: 'mine', troops: 22, level: 1 },
      { id: 12, x: 0.84, y: 0.50, owner: 'neutral', type: 'mine', troops: 22, level: 1 },
      { id: 13, x: 0.35, y: 0.50, owner: 'neutral', type: 'fort', troops: 35, level: 1 },
      { id: 14, x: 0.65, y: 0.50, owner: 'neutral', type: 'fort', troops: 35, level: 1 },
      { id: 15, x: 0.50, y: 0.50, owner: 'neutral', type: 'capital', troops: 60, level: 3 }
    ]
  }
];

// Skirmish uchun tasodifiy xarita generatori
function generateSkirmishLevel(sizeType, aiCount, difficulty) {
  let count = 10;
  if (sizeType === 'small') count = 8;
  else if (sizeType === 'large') count = 16;
  else count = 12;

  const activeFactions = ['player'];
  const possibleAIs = ['red', 'green', 'yellow'];
  for (let i = 0; i < aiCount; i++) {
    activeFactions.push(possibleAIs[i]);
  }

  const castles = [];
  const minDistance = 0.18; // Nisbiy masofa

  // 1. Qirolliklar poytaxtlarini xaritaga qulay joylashtirish
  const cornerAngles = [
    { x: 0.15, y: 0.2 },
    { x: 0.85, y: 0.8 },
    { x: 0.85, y: 0.2 },
    { x: 0.15, y: 0.8 }
  ];

  for (let i = 0; i < activeFactions.length; i++) {
    const fId = activeFactions[i];
    const pos = cornerAngles[i];
    castles.push({
      id: i + 1,
      x: pos.x,
      y: pos.y,
      owner: fId,
      type: 'capital',
      troops: 40,
      level: 1
    });
  }

  // 2. Qolgan neytral qal'alarni tasodifiy va tarqoq joylashtirish
  const types = ['fort', 'barracks', 'mine', 'barracks', 'mine'];
  let attempts = 0;
  let currentId = castles.length + 1;

  while (castles.length < count && attempts < 400) {
    attempts++;
    const testX = 0.15 + Math.random() * 0.70;
    const testY = 0.18 + Math.random() * 0.64;

    let tooClose = false;
    for (const c of castles) {
      const dist = Math.hypot(c.x - testX, c.y - testY);
      if (dist < minDistance) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      const randType = types[Math.floor(Math.random() * types.length)];
      castles.push({
        id: currentId++,
        x: testX,
        y: testY,
        owner: 'neutral',
        type: randType,
        troops: Math.floor(12 + Math.random() * 18),
        level: 1
      });
    }
  }

  return {
    id: 999,
    title: "Erkin Jang (Skirmish)",
    desc: `${activeFactions.length} ta Qirollik jangi. Qiyinlik: ${difficulty.toUpperCase()}`,
    factions: activeFactions,
    aiDifficulty: difficulty,
    castles: castles
  };
}

