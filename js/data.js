// 수리수리 도감 — 동물 도감 데이터 (5세트 × 10종 = 50)
// rarity: common(흔함) / rare(특별) / shiny(반짝이, 한정)
// id는 webp 파일명과 동일: assets/img/animals/<id>.webp

export const SETS = [
  { key: "farm",   name: "농장 친구들",   emoji: "🚜", icon: "assets/img/emoji/set-farm.webp" },
  { key: "forest", name: "숲속 친구들",   emoji: "🌳", icon: "assets/img/emoji/set-forest.webp" },
  { key: "ocean",  name: "바다 친구들",   emoji: "🌊", icon: "assets/img/emoji/set-ocean.webp" },
  { key: "jungle", name: "정글 친구들",   emoji: "🌴", icon: "assets/img/emoji/set-jungle.webp" },
  { key: "polar",  name: "극지방 친구들", emoji: "❄️", icon: "assets/img/emoji/set-polar.webp" },
];

export const setOf = (key) => SETS.find(s => s.key === key) || SETS[0];
export const EMOJI_ICON = {
  trophy:    "assets/img/emoji/icon-trophy.webp",
  fire:      "assets/img/emoji/icon-fire.webp",
  camera:    "assets/img/emoji/icon-camera.webp",
  gift:      "assets/img/emoji/icon-gift.webp",
  storybook: "assets/img/emoji/icon-storybook.webp",
  fox:       "assets/img/emoji/mascot-fox.webp",
  foxHappy:  "assets/img/emoji/mascot-fox-happy.webp",
  foxThink:  "assets/img/emoji/mascot-fox-thinking.webp",
};

export const ANIMALS = [
  // 🚜 농장
  { id: "farm-chick",          set: "farm",   name: "병아리",       rarity: "common" },
  { id: "farm-pig",            set: "farm",   name: "돼지",         rarity: "common" },
  { id: "farm-cow",            set: "farm",   name: "젖소",         rarity: "common" },
  { id: "farm-sheep",          set: "farm",   name: "양",           rarity: "common" },
  { id: "farm-goat",           set: "farm",   name: "염소",         rarity: "common" },
  { id: "farm-duck",           set: "farm",   name: "오리",         rarity: "common" },
  { id: "farm-donkey",         set: "farm",   name: "당나귀",       rarity: "rare" },
  { id: "farm-turkey",         set: "farm",   name: "칠면조",       rarity: "rare" },
  { id: "farm-rabbit",         set: "farm",   name: "토끼",         rarity: "rare" },
  { id: "farm-golden-chicken", set: "farm",   name: "황금 닭",      rarity: "shiny" },

  // 🌳 숲속
  { id: "forest-squirrel",     set: "forest", name: "다람쥐",       rarity: "common" },
  { id: "forest-hedgehog",     set: "forest", name: "고슴도치",     rarity: "common" },
  { id: "forest-rabbit",       set: "forest", name: "토끼",         rarity: "common" },
  { id: "forest-owl",          set: "forest", name: "부엉이",       rarity: "common" },
  { id: "forest-deer",         set: "forest", name: "사슴",         rarity: "common" },
  { id: "forest-chipmunk",     set: "forest", name: "청설모",       rarity: "common" },
  { id: "forest-fox",          set: "forest", name: "여우",         rarity: "rare" },
  { id: "forest-raccoon-dog",  set: "forest", name: "너구리",       rarity: "rare" },
  { id: "forest-badger",       set: "forest", name: "오소리",       rarity: "rare" },
  { id: "forest-white-deer",   set: "forest", name: "흰 사슴",      rarity: "shiny" },

  // 🌊 바다
  { id: "ocean-fish",          set: "ocean",  name: "물고기",       rarity: "common" },
  { id: "ocean-crab",          set: "ocean",  name: "게",           rarity: "common" },
  { id: "ocean-starfish",      set: "ocean",  name: "불가사리",     rarity: "common" },
  { id: "ocean-octopus",       set: "ocean",  name: "문어",         rarity: "common" },
  { id: "ocean-shrimp",        set: "ocean",  name: "새우",         rarity: "common" },
  { id: "ocean-turtle",        set: "ocean",  name: "거북이",       rarity: "common" },
  { id: "ocean-seahorse",      set: "ocean",  name: "해마",         rarity: "rare" },
  { id: "ocean-pufferfish",    set: "ocean",  name: "복어",         rarity: "rare" },
  { id: "ocean-manta-ray",     set: "ocean",  name: "가오리",       rarity: "rare" },
  { id: "ocean-rainbow-fish",  set: "ocean",  name: "무지개 물고기", rarity: "shiny" },

  // 🌴 정글
  { id: "jungle-monkey",       set: "jungle", name: "원숭이",       rarity: "common" },
  { id: "jungle-parrot",       set: "jungle", name: "앵무새",       rarity: "common" },
  { id: "jungle-frog",         set: "jungle", name: "개구리",       rarity: "common" },
  { id: "jungle-butterfly",    set: "jungle", name: "나비",         rarity: "common" },
  { id: "jungle-chameleon",    set: "jungle", name: "카멜레온",     rarity: "common" },
  { id: "jungle-baby-gorilla", set: "jungle", name: "아기 고릴라",  rarity: "common" },
  { id: "jungle-sloth",        set: "jungle", name: "나무늘보",     rarity: "rare" },
  { id: "jungle-toucan",       set: "jungle", name: "투칸",         rarity: "rare" },
  { id: "jungle-jaguar",       set: "jungle", name: "재규어",       rarity: "rare" },
  { id: "jungle-golden-frog",  set: "jungle", name: "황금 개구리",  rarity: "shiny" },

  // ❄️ 극지방
  { id: "polar-penguin",       set: "polar",  name: "펭귄",         rarity: "common" },
  { id: "polar-polar-bear",    set: "polar",  name: "북극곰",       rarity: "common" },
  { id: "polar-seal",          set: "polar",  name: "바다표범",     rarity: "common" },
  { id: "polar-snowy-owl",     set: "polar",  name: "눈올빼미",     rarity: "common" },
  { id: "polar-reindeer",      set: "polar",  name: "순록",         rarity: "common" },
  { id: "polar-ice-crab",      set: "polar",  name: "빙하 게",      rarity: "common" },
  { id: "polar-arctic-fox",    set: "polar",  name: "북극여우",     rarity: "rare" },
  { id: "polar-beluga",        set: "polar",  name: "벨루가",       rarity: "rare" },
  { id: "polar-lemming",       set: "polar",  name: "레밍",         rarity: "rare" },
  { id: "polar-aurora-penguin",set: "polar",  name: "오로라 펭귄",  rarity: "shiny" },
];

export const RARITY = {
  common: { label: "흔함",   star: "⭐"   },
  rare:   { label: "특별",   star: "🌟"   },
  shiny:  { label: "반짝이", star: "✨"   },
};

// 그림 1장 완성에 필요한 정답 수 = 패치 칸 수 (4열 × 3행)
export const PATCH_COLS = 4;
export const PATCH_ROWS = 3;
export const PATCHES_PER_ANIMAL = PATCH_COLS * PATCH_ROWS; // 12

export const animalImg = (id) => `assets/img/animals/${id}.webp`;
