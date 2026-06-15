// 수리수리 도감 — 앱 로직
import { SETS, ANIMALS, RARITY, PATCH_COLS, PATCH_ROWS, PATCHES_PER_ANIMAL, animalImg, setOf, EMOJI_ICON } from "./data.js";
const ico = (src, cls = "ico-img") => `<img class="${cls}" src="${src}" alt="">`;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 사칙연산 정의
const OPS = {
  add: { sym: "+", word: "더하기", name: "덧셈",   emoji: "➕" },
  sub: { sym: "−", word: "빼기",   name: "뺄셈",   emoji: "➖" },
  mul: { sym: "×", word: "곱하기", name: "곱셈",   emoji: "✖️" },
  div: { sym: "÷", word: "나누기", name: "나눗셈", emoji: "➗" },
};
const OP_ORDER = ["add", "sub", "mul", "div"];

/* ---------- 상태 / 저장 ---------- */
const KEY = "surisuri.v1";
const defaultState = () => ({
  collected: [],                    // 완성한 동물 id
  current: null,                    // { animalId, revealed: [idx...] }
  dans: [2, 3, 4, 5],               // 곱셈 선택 단
  lockDans: false,                  // 부모가 단 고정(아이 못 바꿈)
  ops: ["mul"],                     // 선택 연산 종류
  enabledOps: ["mul"],              // 부모가 켠 연산(곱셈 항상 포함)
  sound: true,
  music: true,                      // 배경 음악
  musicTrack: 0,                    // 배경 음악 곡 선택
  musicVol: 0.7,                    // 배경 음악 음량
  sfxVol: 0.9,                      // 효과음 음량
  voice: true,                      // 음성 안내
  hints: true,                      // 오답 시 힌트 그림
  difficulty: "normal",
  hasPlayed: false,                 // 한 번이라도 시작했나(바로 시작용)
  lastVisit: "",                    // 데일리 스탬프
  stampDays: 0,
  stats: { correct: 0, total: 0, streak: 0, bestStreak: 0, perDan: {}, perOp: {}, today: { date: "", count: 0 } },
});
let state = load();
function load() {
  let s;
  try { s = Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { s = defaultState(); }
  // 구버전 저장 호환
  if (!Array.isArray(s.collected)) s.collected = [];
  if (!Array.isArray(s.dans)) s.dans = [2, 3, 4, 5];
  if (!Array.isArray(s.ops) || !s.ops.length) s.ops = ["mul"];
  // 부모가 켠 연산: 항상 mul 포함 + 배열 보장
  s.enabledOps = ["mul", ...(Array.isArray(s.enabledOps) ? s.enabledOps.filter(o => o !== "mul" && OP_ORDER.includes(o)) : [])];
  // ops를 enabled 범위로 제한
  s.ops = s.ops.filter(o => s.enabledOps.includes(o));
  if (!s.ops.length) s.ops = ["mul"];
  if (s.current && !Array.isArray(s.current.revealed)) s.current.revealed = [];
  if (typeof s.voice !== "boolean") s.voice = true;
  if (typeof s.music !== "boolean") s.music = true;
  if (typeof s.hints !== "boolean") s.hints = true;
  const clamp01 = (v, d) => (typeof v === "number" && v >= 0 && v <= 1) ? v : d;
  s.musicVol = clamp01(s.musicVol, 0.7);
  s.sfxVol = clamp01(s.sfxVol, 0.9);
  if (!(Number.isInteger(s.musicTrack) && s.musicTrack >= 0)) s.musicTrack = 0;
  if (typeof s.lockDans !== "boolean") s.lockDans = false;
  s.stats = s.stats || {};
  s.stats.perDan = s.stats.perDan || {};
  s.stats.perOp = s.stats.perOp || {};
  s.stats.today = s.stats.today || { date: "", count: 0 };
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

/* ---------- 사운드 엔진 (WebAudio, 파일 없이 코드로 생성) ---------- */
let actx, musicBus, sfxBus;
function ensureCtx() {
  try {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = actx.createDynamicsCompressor();   // 마스터 리미터(클리핑 방지)
      comp.threshold.value = -10; comp.ratio.value = 12; comp.attack.value = .003; comp.release.value = .25;
      comp.connect(actx.destination);
      musicBus = actx.createGain(); sfxBus = actx.createGain();
      musicBus.connect(comp); sfxBus.connect(comp);
      musicBus.gain.value = state.musicVol; sfxBus.gain.value = state.sfxVol;
    }
    if (actx.state === "suspended") actx.resume();
  } catch {}
  return actx;
}
function applyVolumes() {
  if (!actx) return;
  try { musicBus.gain.value = state.musicVol; sfxBus.gain.value = state.sfxVol; } catch {}
}
// 저수준: 절대 시각(when)에 한 음 — 부드러운 어택/감쇠 엔벨로프, bus로 음량 조절
function note(freq, when, dur, type = "sine", gain = .18, bus) {
  if (!ensureCtx()) return;
  try {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(bus || sfxBus);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + .02);
    g.gain.exponentialRampToValueAtTime(.0001, when + dur);
    o.start(when); o.stop(when + dur);
  } catch {}
}
// 효과음(소리 토글 적용) — 현재 시점 기준
function tone(freq, t0, dur, type = "sine", gain = .18) {
  if (!state.sound || !ensureCtx()) return;
  note(freq, actx.currentTime + t0, dur, type, gain);
}

/* ===== 효과음 3종(+탭/반짝) — 코드 생성 ===== */
// ① 정답: 도-미-솔 밝은 상승 블립
const sCorrect  = () => [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * .06, .18, "triangle", .16));
// ② 오답: 부드러운 2음 하강(거슬리지 않게)
const sWrong    = () => { tone(392, 0, .16, "sine", .13); tone(293.66, .1, .22, "sine", .12); };
// ③ 완성: 도-미-솔-도-미 팡파르
const sComplete = () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * .1, .32, "triangle", .18));
const sTap      = () => tone(520, 0, .06, "sine", .08);
const sReveal   = () => { tone(1174.7, 0, .12, "sine", .07); tone(1568, .05, .14, "sine", .05); }; // 색칠 반짝

/* ===== 배경 음악(BGM) — 여러 곡, 펜타토닉 루프, 코드 생성 ===== */
const TRACKS = [
  { name: "산책", step: 0.34, wave: "triangle",
    mel: [392,440,523.25,440,392,329.63,392,null, 440,523.25,587.33,523.25,440,392,329.63,null],
    bass:[130.81,110,87.31,98] },                                  // C3 A2 F2 G2
  { name: "통통", step: 0.22, wave: "triangle",
    mel: [523.25,392,440,523.25,659.25,523.25,440,392, 587.33,440,523.25,587.33,659.25,587.33,523.25,440],
    bass:[130.81,146.83,196,164.81] },                             // C3 D3 G3 E3
  { name: "별밤", step: 0.46, wave: "sine",
    mel: [659.25,null,587.33,null,523.25,null,440,null, 392,null,440,null,523.25,null,659.25,null],
    bass:[130.81,110,87.31,98] },
];
let bgmTimer = null, bgmStep = 0, bgmNext = 0;
function curTrack() { return TRACKS[state.musicTrack] || TRACKS[0]; }
function bgmTick() {
  if (!actx) return;
  const tk = curTrack();
  const ahead = actx.currentTime + 0.25;
  while (bgmNext < ahead) {
    const f = tk.mel[bgmStep % tk.mel.length];
    if (f) note(f, bgmNext, tk.step * 0.85, tk.wave, 0.5, musicBus);
    if (bgmStep % 4 === 0) {            // 4스텝마다 베이스 + 옥타브
      const b = tk.bass[Math.floor(bgmStep / 4) % tk.bass.length];
      note(b, bgmNext, tk.step * 3.6, "sine", 0.4, musicBus);
      note(b * 2, bgmNext, tk.step * 3.2, tk.wave, 0.18, musicBus);
    }
    bgmStep++; bgmNext += tk.step;
  }
}
function startBGM() {
  if (!state.music || bgmTimer || !ensureCtx()) return;
  bgmStep = 0; bgmNext = actx.currentTime + 0.15;
  bgmTimer = setInterval(bgmTick, 70);
}
function stopBGM() { if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; } }
function restartBGM() { stopBGM(); if (state.music) startBGM(); }

/* ---------- 음성 안내 (Web Speech API) ---------- */
let koVoice = null;
function loadVoices() {
  try {
    const vs = speechSynthesis.getVoices();
    koVoice = vs.find(v => v.lang === "ko-KR") || vs.find(v => /ko/i.test(v.lang)) || null;
  } catch {}
}
if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}
function speak(text) {
  if (!state.voice || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR"; u.rate = 0.95; u.pitch = 1.1;
    if (koVoice) u.voice = koVoice;
    speechSynthesis.speak(u);
  } catch {}
}
function speakQuestion() {
  if (!q) return;
  speak(`${q.a} ${OPS[q.op].word} ${q.b}는?`);
}
// iOS: 첫 사용자 제스처에서 오디오/음성 잠금 해제(이후 setTimeout 경로도 소리남)
function unlockAudio() {
  ensureCtx();
  try { if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } } catch {}
  startBGM();   // 음악 켜져 있으면 첫 제스처에서 시작
}
window.addEventListener("pointerdown", unlockAudio, { once: true });

/* ---------- 네비게이션 ---------- */
function showView(v) {
  $$(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + v));
  $$(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
  if (v === "play") enterPlay();
  if (v === "dex") renderDex();
  if (v === "settings") { lockParent(); renderSettings(); }
}
$$(".nav button").forEach(b => b.addEventListener("click", () => { sTap(); showView(b.dataset.view); }));

/* ---------- 놀기: 범위 선택 ---------- */
// 연산 종류 카드 — 부모가 켠 연산(enabledOps)만, 1개(곱셈)뿐이면 선택 숨김
const opGrid = $("#op-grid");
function renderOpGrid() {
  const multi = state.enabledOps.length >= 2;
  // 곱셈 전용 모드: 연산 선택 숨김, ops는 곱셈 고정
  $(".range-intro .title").textContent = multi ? "어떤 문제로 놀까?" : "몇 단으로 놀까?";
  $(".range-intro .sub").textContent = multi ? "종류를 고르고 시작해요 (여러 개 OK)" : "단을 골라 시작해요";
  if (!multi) {
    opGrid.style.display = "none";
    opGrid.innerHTML = "";
    if (!(state.ops.length === 1 && state.ops[0] === "mul")) { state.ops = ["mul"]; save(); }
    updateDanVisibility();
    return;
  }
  // 2개 이상: enabled op 카드 렌더(OP_ORDER 순서)
  opGrid.style.display = "";
  opGrid.innerHTML = "";
  OP_ORDER.filter(k => state.enabledOps.includes(k)).forEach(key => {
    const o = OPS[key];
    const c = document.createElement("button");
    c.className = "op-card"; c.dataset.op = key;
    c.setAttribute("aria-pressed", state.ops.includes(key));
    c.innerHTML = `<span class="oe">${o.emoji}</span> ${o.name}`;
    c.addEventListener("click", () => {
      const on = c.getAttribute("aria-pressed") === "true";
      c.setAttribute("aria-pressed", !on);
      state.ops = $$(".op-card", opGrid).filter(x => x.getAttribute("aria-pressed") === "true").map(x => x.dataset.op);
      sTap(); save(); updateDanVisibility();
    });
    opGrid.appendChild(c);
  });
  updateDanVisibility();
}
function updateDanVisibility() {
  $("#dan-section").style.display = state.ops.includes("mul") ? "block" : "none";
}

const danGrid = $("#dan-grid");
for (let d = 2; d <= 9; d++) {
  const c = document.createElement("button");
  c.className = "dan-card"; c.dataset.dan = d;
  c.setAttribute("aria-pressed", state.dans.includes(d));
  c.innerHTML = `<span class="n">${d}단</span><span class="x">×1~9</span>`;
  c.addEventListener("click", () => {
    if (state.lockDans) return;
    const on = c.getAttribute("aria-pressed") === "true";
    c.setAttribute("aria-pressed", !on);
    state.dans = $$(".dan-card", danGrid).filter(x => x.getAttribute("aria-pressed") === "true").map(x => +x.dataset.dan);
    sTap(); save();
  });
  danGrid.appendChild(c);
}
$("#pick-all").addEventListener("click", () => { if (state.lockDans) return; sTap(); $$(".dan-card").forEach(c => c.setAttribute("aria-pressed", "true")); state.dans = [2,3,4,5,6,7,8,9]; save(); });
$("#pick-clear").addEventListener("click", () => { if (state.lockDans) return; sTap(); $$(".dan-card").forEach(c => c.setAttribute("aria-pressed", "false")); state.dans = []; save(); });

// 놀기 화면 단 카드에 lockDans·선택 상태 반영
function syncDanGrid() {
  $$(".dan-card", danGrid).forEach(c => {
    c.setAttribute("aria-pressed", state.dans.includes(+c.dataset.dan));
    c.disabled = state.lockDans;
  });
  const pa = $("#pick-all"), pc = $("#pick-clear");
  if (pa) pa.disabled = state.lockDans;
  if (pc) pc.disabled = state.lockDans;
  const lbl = $("#dan-section .label");
  if (lbl) {
    if (state.lockDans) { lbl.textContent = "🔒 부모가 정한 단이에요"; lbl.style.display = ""; }
    else if (state.enabledOps.length >= 2) { lbl.textContent = "✖️ 곱셈은 몇 단으로 놀까?"; lbl.style.display = ""; }
    else { lbl.textContent = ""; lbl.style.display = "none"; }
  }
}

renderOpGrid();

$("#start-quiz").addEventListener("click", () => {
  if (!state.ops.length) { coachRange("문제 종류를 하나 골라줘!"); return; }
  if (state.ops.includes("mul") && !state.dans.length) { coachRange("곱셈은 단을 하나 골라줘!"); return; }
  sTap(); startQuiz();
});
function coachRange(msg) {
  let el = $("#range-coach");
  if (!el) { el = document.createElement("div"); el.id = "range-coach"; el.className = "coach"; el.style.padding = "0 16px 8px";
    $("#start-quiz").parentElement.insertBefore(el, $("#start-quiz")); }
  el.textContent = msg;
}

/* ---------- 놀기: 퀴즈 ---------- */
let q = null; // { a, b, answer }
function pickAnimal() {
  if (state.current) {
    const a = ANIMALS.find(x => x.id === state.current.animalId);
    if (a && !state.collected.includes(a.id)) return a;
  }
  const next = ANIMALS.find(a => !state.collected.includes(a.id)) || ANIMALS[Math.floor(Math.random()*ANIMALS.length)];
  state.current = { animalId: next.id, revealed: [] };
  save();
  return next;
}
// 설정이 유효한가(바로 시작 가능?)
function canStart() { return state.ops.length && (!state.ops.includes("mul") || state.dans.length); }
// 놀기 진입 — 해봤고 설정 유효하면 바로 퀴즈, 아니면 선택 화면
function enterPlay() {
  if (inQuiz) return;                 // 이미 퀴즈 중이면 유지
  if (state.hasPlayed && canStart()) startQuiz();
  else showRangeHome();
}
function showRangeHome() {
  inQuiz = false;
  $("#play-quiz").style.display = "none";
  $("#play-range").style.display = "flex";
  renderPlayHome();
}

let inQuiz = false;
let bonusPending = 0;
let greeted = false;   // 세션 첫 인사(꼬미) 1회
function startQuiz() {
  inQuiz = true; state.hasPlayed = true;
  $("#play-range").style.display = "none";
  $("#play-quiz").style.display = "flex";
  const animal = pickAnimal();
  buildCanvas(animal);
  if (bonusPending > 0) {
    const give = Math.min(bonusPending, PATCHES_PER_ANIMAL - state.current.revealed.length);
    for (let i = 0; i < give; i++) revealPatch();
    if (give > 0) coach("출석 보너스! 색을 미리 칠해줬어 🎁", true);
    bonusPending = 0;
  }
  save();
  nextQuestion();
  if (!greeted) {
    greeted = true;
    // 인사 우선: nextQuestion의 문제 음성 뒤에 인사 음성이 이김
    speak("안녕! 나는 여우 꼬미야. 우리 같이 곱셈 해볼까?");
    toast("안녕! 나는 여우 꼬미야 🦊");
    if (stampedToday) { const d = state.stampDays; setTimeout(() => toast(`오늘도 왔구나! 🔥 연속 ${d}일 출석!`), 2600); stampedToday = false; }
  } else if (stampedToday) {
    toast(`오늘도 왔구나! 🔥 연속 ${state.stampDays}일 출석!`); stampedToday = false;
  }
}
function exitQuiz() { clearViz(); showRangeHome(); }
$("#quiz-back").addEventListener("click", () => { sTap(); exitQuiz(); });
$("#q-speak").addEventListener("click", () => speakQuestion());

/* 색칠판 만들기 — 흑백 base 위에 컬러 레이어, 정답마다 부드러운 둥근 마스크가 번짐 */
let currentCells = [];
function buildCanvas(animal) {
  const inner = $("#canvas-inner");
  const url = animalImg(animal.id);
  inner.innerHTML = "";
  const base = document.createElement("img");
  base.className = "base"; base.src = url; base.alt = ""; base.loading = "eager";
  const color = document.createElement("img");
  color.className = "color"; color.id = "color-layer"; color.src = url; color.alt = ""; color.loading = "eager";
  inner.appendChild(base); inner.appendChild(color);
  // 각 칸 중심 좌표(%) — 마스크 번짐 위치
  currentCells = [];
  for (let r = 0; r < PATCH_ROWS; r++) for (let c = 0; c < PATCH_COLS; c++)
    currentCells.push({ x: (c + 0.5) / PATCH_COLS * 100, y: (r + 0.5) / PATCH_ROWS * 100 });
  applyMask();
  updateProgress(animal);
}
function applyMask() {
  const color = $("#color-layer"); if (!color) return;
  const rev = state.current.revealed || [];
  if (!rev.length) { color.style.opacity = "0"; return; }
  color.style.opacity = "1";
  // 부드러운 타원 마스크들의 합집합 → 크레용처럼 번진 자국
  const grads = rev.map(i => {
    const cell = currentCells[i];
    return `radial-gradient(42% 32% at ${cell.x}% ${cell.y}%, #000 56%, transparent 90%)`;
  });
  color.style.webkitMaskImage = grads.join(",");
  color.style.maskImage = grads.join(",");
}
function updateProgress(animal) {
  const n = state.current.revealed.length;
  $("#prog-text").textContent = `${n} / ${PATCHES_PER_ANIMAL}`;
  $("#prog-animal").innerHTML = `${ico(setOf(animal.set).icon, "ico-sm")}${animal.name}`;
  $("#prog-fill").style.width = (n / PATCHES_PER_ANIMAL * 100) + "%";
}

/* 문제 생성 — 사칙연산 */
const rnd = n => Math.floor(Math.random() * n);
const MAXN = { easy: 10, normal: 20, hard: 50 };   // 덧셈/뺄셈 수 범위(난이도별)
function makeQuestion() {
  const ops = state.ops.length ? state.ops : ["mul"];
  let a, b, answer, op, guard = 0, key;
  do {
    op = ops[rnd(ops.length)];
    if (op === "mul") {
      const dans = state.dans.length ? state.dans : [2,3,4,5];
      a = dans[rnd(dans.length)]; b = 1 + rnd(9); answer = a * b;
    } else if (op === "add") {
      const m = MAXN[state.difficulty]; a = 1 + rnd(m); b = 1 + rnd(m); answer = a + b;
    } else if (op === "sub") {
      const m = MAXN[state.difficulty]; a = 2 + rnd(m); b = 1 + rnd(a); answer = a - b;
    } else { // div — 나누어떨어지게
      const d = 2 + rnd(8), qd = 1 + rnd(9); a = d * qd; b = d; answer = qd;
    }
    key = op + a + "x" + b; guard++;
  } while (q && key === q.key && guard < 8);
  return { op, a, b, answer, key, scored: false };
}
function distractors( q) {
  const ans = q.answer;
  const cand = new Set([ans+1, ans-1, ans+2, ans-2, ans+q.b, ans-q.b, ans+q.a, Math.abs(ans-q.a), ans+3]);
  const out = [...cand].filter(x => x >= 0 && x !== ans);
  out.sort(() => Math.random() - .5);
  if (state.difficulty === "easy") out.sort((x,y) => Math.abs(y-ans) - Math.abs(x-ans)); // 정답과 먼 보기 우선
  const picked = [];
  for (const x of out) { if (!picked.includes(x)) picked.push(x); if (picked.length === 3) break; }
  let pad = 1;
  while (picked.length < 3) { const x = ans + pad; if (x >= 0 && x !== ans && !picked.includes(x)) picked.push(x); pad++; }
  return picked;
}
function nextQuestion() {
  clearViz();
  q = makeQuestion();
  $("#q-text").textContent = `${q.a} ${OPS[q.op].sym} ${q.b}`;
  const opts = [q.answer, ...distractors(q)].sort(() => Math.random() - .5);
  const box = $("#choices"); box.innerHTML = "";
  opts.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "choice"; btn.textContent = v;
    btn.addEventListener("click", () => answer(btn, v), { once: false });
    box.appendChild(btn);
  });
  coach("정답을 골라봐!");
  speakQuestion();
}

const PRAISE = ["수리수리! ✨", "잘했어! 🎉", "정답이야! 👏", "멋져! 🌟", "좋아 좋아!"];
const NUDGE  = ["괜찮아, 다시! 💪", "한 번 더 생각해봐!", "거의 다 왔어!", "다시 골라볼까?"];
// 마스코트 '꼬미' 대사 — 기존 문구에 가끔 섞어 등장
const FOX_PRAISE = ["꼬미도 신났어! 🦊", "우와, 꼬미가 깜짝 놀랐어! ✨", "꼬미랑 하이파이브! 🙌", "꼬미가 박수 짝짝! 👏"];
const FOX_COMBO  = ["{n}연속이라니! 꼬미 꼬리가 살랑살랑! 🦊", "멈추지 않네! 꼬미도 신나서 폴짝! ✨"];
const FOX_DONE   = ["{name} 완성! 꼬미가 같이 기뻐할게! 🎉", "우와, {name}를 모았어! 꼬미도 자랑스러워! ✨", "{name} 도감에 쏙! 꼬미랑 또 모으자! 🦊"];
const FOX_DONE_SHINY = ["우와! 반짝이 친구야! 꼬미 눈이 반짝반짝! ✨", "엄청 귀한 친구다! 꼬미도 처음 봐! 🌟"];
const FOX_NUDGE  = ["괜찮아, 꼬미도 가끔 틀려. 다시 해보자!", "천천히 해도 돼, 꼬미가 기다릴게! 🦊"];

let locking = false;
function answer(btn, val) {
  if (locking) return;
  if (!q) return;
  const correct = val === q.answer;
  // 통계 — 그 문제에서 처음 답할 때 1회만(첫 시도 기준), 첫 시도가 정답일 때만 correct
  const op = state.stats.perOp[q.op] = state.stats.perOp[q.op] || { correct: 0, total: 0 };
  let dStat = null;
  if (q.op === "mul") {
    const dk = String(q.a);
    dStat = state.stats.perDan[dk] = state.stats.perDan[dk] || { correct: 0, total: 0 };
  }
  if (!q.scored) {
    q.scored = true;
    state.stats.total++; op.total++; if (dStat) dStat.total++;
    if (correct) { state.stats.correct++; op.correct++; if (dStat) dStat.correct++; }
    // 오늘 푼 문제 수(정답·오답 무관, 첫 시도 1회만)
    const tk = dateKey(new Date());
    if (state.stats.today.date !== tk) state.stats.today = { date: tk, count: 0 };
    state.stats.today.count++;
  }
  if (correct) {
    locking = true;
    state.stats.streak++; state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
    btn.classList.add("correct"); sCorrect();
    mascotReact("happy"); const comboed = maybeCombo(state.stats.streak);
    const praise = (Math.random() < 0.34 ? FOX_PRAISE[rnd(FOX_PRAISE.length)] : PRAISE[rnd(PRAISE.length)]);
    coach(praise, true);
    // 콤보 음성이 나간 경우엔 칭찬 음성이 콤보를 덮지 않도록 생략(텍스트는 유지)
    if (!comboed) speak(praise.replace(/[^가-힣! ]/g, "").trim() || "정답!");
    $$(".choice").forEach(c => c.disabled = true);
    clearViz();
    revealPatch();
    save();
    setTimeout(afterCorrect, reduceMotion ? 200 : 650);
  } else {
    state.stats.streak = 0;
    btn.classList.add("wrong"); btn.disabled = true; sWrong();
    mascotReact("think");
    const nudge = (Math.random() < 0.34 ? FOX_NUDGE[rnd(FOX_NUDGE.length)] : NUDGE[rnd(NUDGE.length)]);
    coach(nudge);
    offerHint();        // 힌트 버튼 노출(누르면 showViz로 양감 시각화)
    save();
  }
}
function revealPatch() {
  if (!state.current) return;
  const done = state.current.revealed;
  const remaining = [];
  for (let i = 0; i < PATCHES_PER_ANIMAL; i++) if (!done.includes(i)) remaining.push(i);
  if (!remaining.length) return;
  const idx = remaining[rnd(remaining.length)];
  done.push(idx);
  applyMask();
  magicPop(currentCells[idx]); sReveal();
  const animal = ANIMALS.find(a => a.id === state.current.animalId);
  updateProgress(animal);
}
function afterCorrect() {
  locking = false;
  if (!state.current) return;
  if (state.current.revealed.length >= PATCHES_PER_ANIMAL) completeAnimal();
  else nextQuestion();
}

function completeAnimal() {
  const animal = ANIMALS.find(a => a.id === state.current.animalId);
  const shiny = animal.rarity === "shiny";
  if (!state.collected.includes(animal.id)) state.collected.push(animal.id);
  state.current = null; save();
  sComplete();
  if (shiny && !reduceMotion) tone(1567.98, 0.5, 0.4, "triangle", 0.10); // 골드 한 음
  burst(shiny);
  const doneLine = (shiny ? FOX_DONE_SHINY[rnd(FOX_DONE_SHINY.length)] : FOX_DONE[rnd(FOX_DONE.length)]).replace("{name}", animal.name);
  speak(doneLine);
  $("#reward-img").src = animalImg(animal.id);
  $("#reward-name").innerHTML = `${ico(setOf(animal.set).icon, "ico-md")}${animal.name}`;
  const r = RARITY[animal.rarity];
  if (state.collected.length >= ANIMALS.length) {
    $("#reward-name").innerHTML = `${ico(EMOJI_ICON.trophy, "ico-md")}${animal.name}`;
    $("#reward-rarity").textContent = "도감 50종 완성! 「마스터 도감사」 달성! 🎉";
    speak("도감을 전부 모았어요! 마스터 도감사!");
  } else {
    $("#reward-rarity").innerHTML = `${ico(r.icon, "ico-sm")}${r.label} 동물을 모았어요!`;
    prefetchNextAnimal();
  }
  const back = $("#reward-modal"); const card = back.querySelector(".modal");
  back.classList.toggle("shiny", shiny && !reduceMotion);
  card.classList.toggle("shiny", shiny && !reduceMotion);
  card.classList.toggle("shiny-static", shiny && reduceMotion);
  back.classList.add("show");
}
function prefetchNextAnimal() {
  const next = ANIMALS.find(a => !state.collected.includes(a.id));
  if (!next) return;
  const l = document.createElement("link");
  l.rel = "prefetch"; l.as = "image"; l.href = animalImg(next.id);
  document.head.appendChild(l);
}
function closeReward() {
  const back = $("#reward-modal");
  back.classList.remove("show", "shiny");
  back.querySelector(".modal").classList.remove("shiny", "shiny-static");
}
$("#reward-next").addEventListener("click", () => {
  sTap(); closeReward();
  const a = pickAnimal(); buildCanvas(a); nextQuestion();
});
$("#reward-dex").addEventListener("click", () => {
  sTap(); closeReward(); exitQuiz(); showView("dex");
});

function coach(msg, good=false) { const c = $("#coach"); c.textContent = msg; c.classList.toggle("good", good); }

/* 오답 시 양감(量感) 시각화 — 정답 숫자는 숨기고 묶음을 세게 한다 */
function clearViz() {
  const v = $("#viz");
  if (v) { v.innerHTML = ""; v.removeAttribute("aria-label"); }
}
// 오답 시 힌트 버튼만 띄운다(자동 표시 X). 누르면 showViz로 묶음 점을 그린다.
function offerHint() {
  if (!state.hints || !q) return;
  const v = $("#viz"); if (!v || v.children.length) return;  // 이미 버튼/그림 있으면 중복 방지
  const btn = document.createElement("button");
  btn.className = "hint-btn";
  btn.textContent = "🍎 힌트 볼래?";
  btn.setAttribute("aria-label", "힌트 보기");
  btn.addEventListener("click", () => { sTap(); showViz(); });
  v.appendChild(btn);
}
// n개의 점을 담은 상자(bundle=묶음 격자, dotCls=점 색 구분)
function vizBox(n, bundle = false, dotCls = "") {
  const box = document.createElement("div");
  box.className = "viz-box" + (bundle ? " bundle" : "");
  for (let i = 0; i < n; i++) box.appendChild(vizDot(dotCls, i));
  return box;
}
function vizDot(cls = "", i = 0) {
  const d = document.createElement("span");
  d.className = "viz-dot" + (cls ? " " + cls : "");
  d.setAttribute("aria-hidden", "true");
  if (!reduceMotion) d.style.animationDelay = (i * 0.012) + "s";
  return d;
}
function showViz() {
  const v = $("#viz"); if (!v || !q) return;
  v.classList.toggle("no-anim", reduceMotion);
  v.innerHTML = "";                        // 힌트 버튼 제거 후 점을 그린다
  const { op, a, b } = q;
  const cap = document.createElement("div"); cap.className = "viz-cap";
  const bins = document.createElement("div"); bins.className = "viz-bins";
  let label = "", voice = "";
  if (op === "mul") {
    cap.textContent = `${a}씩 ${b}묶음이야! 세어볼까? 🍎`;
    for (let i = 0; i < b; i++) bins.appendChild(vizBox(a, true));
    label = `사과 ${a}개씩 ${b}묶음`; voice = `${a}씩 ${b}묶음이야`;
  } else if (op === "div") {
    cap.textContent = `${a}개를 ${b}묶음으로 똑같이 나누면? 🍎`;
    const per = a / b;                      // makeQuestion이 나누어떨어지게 보장
    for (let i = 0; i < b; i++) bins.appendChild(vizBox(per, true));
    label = `사과 ${a}개를 ${b}묶음으로 똑같이 나눔`; voice = `${a}개를 ${b}묶음으로 나눠볼까`;
  } else if (op === "add") {
    cap.textContent = `${a}개하고 ${b}개를 더하면? 🍎`;
    bins.appendChild(vizBox(a)); bins.appendChild(vizBox(b, false, "g2"));
    label = `사과 ${a}개하고 ${b}개`; voice = `${a}개하고 ${b}개를 더하면`;
  } else { // sub — a개 중 b개를 흐리게/빗금(없어지는 표시)
    cap.textContent = `${a}개에서 ${b}개를 빼면? 🍎`;
    const box = document.createElement("div"); box.className = "viz-box";
    for (let i = 0; i < a; i++) box.appendChild(vizDot(i >= a - b ? "gone" : "", i));
    bins.appendChild(box);
    label = `사과 ${a}개에서 ${b}개 빼기`; voice = `${a}개에서 ${b}개를 빼면`;
  }
  v.setAttribute("aria-label", label);
  v.appendChild(cap); v.appendChild(bins);
  speak(voice);
}

/* 번짐 순간 연출 — 글로우 + 스파클 (칸 중심 %좌표) */
function magicPop(cell) {
  if (reduceMotion || !cell) return;
  const wrap = $(".canvas-wrap");
  const g = document.createElement("div");
  g.className = "magic-glow"; g.style.left = cell.x + "%"; g.style.top = cell.y + "%";
  wrap.appendChild(g); setTimeout(() => g.remove(), 600);
  for (let i = 0; i < 3; i++) {
    const s = document.createElement("div");
    s.className = "spark"; s.textContent = ["✨","⭐","🌟"][rnd(3)];
    s.style.left = (cell.x + (Math.random()*16-8)) + "%";
    s.style.top  = (cell.y + (Math.random()*16-8)) + "%";
    s.style.animation = "floatUp .8s ease forwards";
    wrap.appendChild(s); setTimeout(() => s.remove(), 850);
  }
}
function burst(shiny = false) {
  if (reduceMotion) return;
  const host = $("#reward-modal");
  const n = shiny ? 32 : 24;
  const chars = shiny ? ["⭐","🌟","✨","💛"] : ["✨","🎉","⭐","🌈","💛"];
  const base = shiny ? 20 : 14;
  const spread = shiny ? 280 : 200;
  const life = shiny ? 1800 : 1500;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div");
    s.className = "spark"; s.textContent = chars[rnd(chars.length)];
    s.style.left = (40 + Math.random()*20) + "%"; s.style.top = "40%";
    s.style.fontSize = (base + Math.random()*16) + "px";
    s.style.setProperty("--dx", (Math.random()*2-1));
    s.style.animation = `floatUp ${.8+Math.random()*.6}s ease forwards`;
    s.style.transform = `translateX(${(Math.random()*spread - spread/2)}px)`;
    host.appendChild(s);
    setTimeout(() => s.remove(), life);
  }
}

/* ---------- 도감 ---------- */
function renderDex() {
  $("#dex-total").textContent = `${state.collected.length} / ${ANIMALS.length}`;
  const host = $("#dex-scroll"); host.innerHTML = "";
  if (!state.collected.length) {
    const e = document.createElement("div"); e.className = "dex-empty";
    e.innerHTML = `아직 모은 동물이 없어요 🐣<br>문제를 풀면 도감이 채워져요!`;
    host.appendChild(e);
  }
  SETS.forEach(set => {
    const animals = ANIMALS.filter(a => a.set === set.key);
    const have = animals.filter(a => state.collected.includes(a.id)).length;
    const block = document.createElement("div"); block.className = "set-block";
    block.innerHTML = `
      <div class="set-head"><span class="name">${ico(set.icon, "ico-sm")}${set.name}</span><span class="count">${have}/${animals.length}</span></div>
      <div class="set-bar"><i style="width:${have/animals.length*100}%"></i></div>
      <div class="dex-grid"></div>`;
    const grid = $(".dex-grid", block);
    animals.forEach(a => {
      const got = state.collected.includes(a.id);
      const card = document.createElement("button");
      card.className = "dex-card" + (got ? "" : " locked") + (a.rarity === "shiny" ? " shiny" : "");
      card.innerHTML = `<img src="${animalImg(a.id)}" alt="${got ? a.name : "아직 못 모은 동물"}" loading="lazy" /><span class="nm">${a.name}</span>`;
      if (got) card.addEventListener("click", () => { sTap(); openLightbox(a); });
      grid.appendChild(card);
    });
    if (have === animals.length) {
      const bk = document.createElement("button");
      bk.className = "btn book-btn"; bk.innerHTML = `${ico(EMOJI_ICON.storybook, "ico-btn")}그림책 만들기`;
      bk.addEventListener("click", () => { sTap(); bk.textContent = "만드는 중…"; makeStorybook(set.key).then(() => bk.innerHTML = `${ico(EMOJI_ICON.storybook, "ico-btn")}그림책 만들기`); });
      block.appendChild(bk);
    }
    host.appendChild(block);
  });
}
function openLightbox(a) {
  const back = document.createElement("div"); back.className = "modal-back show";
  const r = RARITY[a.rarity];
  back.innerHTML = `<div class="modal">
    <img class="reward-img" src="${animalImg(a.id)}" alt="${a.name}" />
    <p class="reward-title">${ico(setOf(a.set).icon, "ico-md")}${a.name}</p>
    <p class="reward-rarity">${ico(r.icon, "ico-sm")}${r.label}</p>
    <button class="btn primary big save" style="margin-top:10px;">${ico(EMOJI_ICON.camera, "ico-btn")}그림 저장</button>
    <button class="btn close" style="width:100%; margin-top:10px;">닫기</button>
  </div>`;
  back.querySelector(".save").addEventListener("click", e => {
    e.stopPropagation(); sTap(); const b = e.currentTarget; b.textContent = "저장 중…";
    saveAnimalCard(a).then(() => b.innerHTML = `${ico(EMOJI_ICON.camera, "ico-btn")}그림 저장`);
  });
  const close = () => { sTap(); back.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  back.querySelector(".close").addEventListener("click", close);
  back.addEventListener("click", e => { if (e.target === back) close(); });
  document.addEventListener("keydown", onKey);
  $("#app").appendChild(back);
}
// 캔버스에 [아이콘 이미지 + 텍스트]를 중앙정렬로 그림(이모지 글리프 대신 이미지 사용)
function drawIconText(ctx, img, text, cx, baseY, fontPx, iconPx, gap = 12) {
  ctx.font = `${fontPx}px 'Jua', sans-serif`;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tw = ctx.measureText(text).width;
  const total = (img ? iconPx + gap : 0) + tw;
  let x = cx - total / 2;
  if (img) { ctx.drawImage(img, x, baseY - iconPx * 0.8, iconPx, iconPx); x += iconPx + gap; }
  ctx.fillText(text, x, baseY);
  ctx.textAlign = "center";
}
async function saveAnimalCard(a) {
  try { await document.fonts.load("56px 'Jua'"); } catch {}
  const W = 560, H = 760, pad = 22;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#FFF8E7"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; roundRect(ctx, pad, pad, W-pad*2, H-pad*2, 28); ctx.fill();
  const r = RARITY[a.rarity];
  const [img, setImg, rarImg] = await Promise.all([loadImg(animalImg(a.id)), loadImg(setOf(a.set).icon), loadImg(r.icon)]);
  if (img) { ctx.save(); roundRect(ctx, pad+16, pad+16, W-pad*2-32, H-pad*2-128, 18); ctx.clip();
    drawCover(ctx, img, pad+16, pad+16, W-pad*2-32, H-pad*2-128); ctx.restore(); }
  ctx.fillStyle = "#4a3b2a";
  drawIconText(ctx, setImg, a.name, W/2, H-62, 52, 48, 12);
  ctx.fillStyle = "#6b5742";
  drawIconText(ctx, rarImg, `${r.label} · 수리수리 도감`, W/2, H-22, 30, 30, 8);
  cv.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a"); el.href = url; el.download = `수리수리도감_${a.name}.png`; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, "image/png");
}

/* ---------- 설정 ---------- */
function barColor(pct){ return pct < 60 ? "var(--oops)" : pct < 85 ? "var(--gold)" : "var(--good)"; }
function renderSettings() {
  $("#sw-sound").setAttribute("aria-checked", state.sound);
  $("#sw-music").setAttribute("aria-checked", state.music);
  $("#sw-voice").setAttribute("aria-checked", state.voice);
  $("#sw-hint").setAttribute("aria-checked", state.hints);
  $("#sw-op-add").setAttribute("aria-checked", state.enabledOps.includes("add"));
  $("#sw-op-sub").setAttribute("aria-checked", state.enabledOps.includes("sub"));
  $("#sw-op-div").setAttribute("aria-checked", state.enabledOps.includes("div"));
  $("#vol-sfx").value = Math.round(state.sfxVol * 100);
  $("#vol-music").value = Math.round(state.musicVol * 100);
  $$("#seg-track button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.i === state.musicTrack));
  $$("#seg-diff button").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === state.difficulty));
  const s = state.stats;
  $("#st-correct").textContent = s.correct;
  $("#st-acc").textContent = (s.total ? Math.round(s.correct / s.total * 100) : 0) + "%";
  $("#st-dex").textContent = state.collected.length;
  $("#st-streak").textContent = s.bestStreak;
  const tk = dateKey(new Date());
  $("#st-today").textContent = s.today.date === tk ? s.today.count : 0;
  // 단 고정(부모)
  $("#sw-lock-dans").setAttribute("aria-checked", state.lockDans);
  $("#dan-lock-row").style.display = state.lockDans ? "flex" : "none";
  renderDanLockPick();
  const ds = $("#dan-stats"); ds.innerHTML = "";
  // 연산별 정답률 (해본 것만)
  const usedOps = OP_ORDER.filter(o => (s.perOp[o] || {}).total);
  if (usedOps.length) {
    const opWrap = document.createElement("div"); opWrap.style.marginBottom = "12px";
    usedOps.forEach(o => {
      const po = s.perOp[o]; const pct = Math.round(po.correct / po.total * 100);
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:10px;margin:6px 2px;font-size:16px;";
      row.innerHTML = `<span style="width:64px;font-family:var(--font-hand)">${OPS[o].emoji} ${OPS[o].name}</span>
        <div class="set-bar" style="flex:1;margin:0"><i style="width:${pct}%; background:${barColor(pct)}"></i></div>
        <span style="width:54px;text-align:right;color:var(--ink-soft)">${pct}%</span>`;
      opWrap.appendChild(row);
    });
    ds.appendChild(opWrap);
    const sub = document.createElement("div"); sub.style.cssText = "font-family:var(--font-hand);font-size:17px;margin:6px 2px 4px;color:var(--ink-soft)"; sub.textContent = "곱셈 단별";
    ds.appendChild(sub);
  }
  for (let d = 2; d <= 9; d++) {
    const pd = s.perDan[d] || { correct: 0, total: 0 };
    const pct = pd.total ? Math.round(pd.correct / pd.total * 100) : 0;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;margin:6px 2px;font-size:16px;";
    row.innerHTML = `<span style="width:34px;font-family:var(--font-hand)">${d}단</span>
      <div class="set-bar" style="flex:1;margin:0"><i style="width:${pct}%${pd.total?`; background:${barColor(pct)}`:""}"></i></div>
      <span style="width:54px;text-align:right;color:var(--ink-soft)">${pd.total?pct+"%":"-"}</span>`;
    ds.appendChild(row);
  }
}
$("#sw-sound").addEventListener("click", () => { state.sound = !state.sound; save(); renderSettings(); if (state.sound) sTap(); });
$("#sw-music").addEventListener("click", () => { state.music = !state.music; save(); renderSettings(); if (state.music) startBGM(); else stopBGM(); });
$("#vol-sfx").addEventListener("input", e => { state.sfxVol = e.target.value / 100; applyVolumes(); save(); });
$("#vol-sfx").addEventListener("change", () => sCorrect());   // 놓으면 미리듣기
$("#vol-music").addEventListener("input", e => { state.musicVol = e.target.value / 100; applyVolumes(); save(); if (state.music) startBGM(); });
$("#sw-voice").addEventListener("click", () => { state.voice = !state.voice; save(); renderSettings(); if (state.voice) speak("음성 안내를 켰어요"); });
$("#sw-hint").addEventListener("click", () => { state.hints = !state.hints; save(); renderSettings(); if (state.hints) sTap(); });
// 연산 종류 토글(곱셈 제외) — 끄면 ops에서도 제거, 빈 배열이면 mul 폴백
function toggleEnabledOp(op) {
  sTap();
  if (state.enabledOps.includes(op)) {
    state.enabledOps = state.enabledOps.filter(o => o !== op);
    state.ops = state.ops.filter(o => o !== op);
    if (!state.ops.length) state.ops = ["mul"];
  } else {
    state.enabledOps = OP_ORDER.filter(o => state.enabledOps.includes(o) || o === op);
  }
  save(); renderSettings();
}
// 단 고정(부모): 고정할 단 선택 버튼 2~9 (재)생성
function renderDanLockPick() {
  const wrap = $("#dan-lock-pick"); if (!wrap) return;
  wrap.innerHTML = "";
  for (let d = 2; d <= 9; d++) {
    const b = document.createElement("button");
    b.dataset.d = d; b.textContent = d + "단";
    b.setAttribute("aria-pressed", state.dans.includes(d));
    b.addEventListener("click", () => {
      sTap();
      const on = state.dans.includes(d);
      if (on) {
        if (state.dans.length === 1) return;   // 마지막 1단은 못 뺌
        state.dans = state.dans.filter(x => x !== d);
      } else {
        state.dans = [...state.dans, d].sort((x, y) => x - y);
      }
      save(); renderSettings(); syncDanGrid();
    });
    wrap.appendChild(b);
  }
}
$("#sw-lock-dans").addEventListener("click", () => {
  state.lockDans = !state.lockDans;
  if (state.lockDans && !state.dans.length) state.dans = [2,3,4,5];   // 빈 상태로 고정하면 아이가 못 고르니 기본 단 채움
  sTap(); save(); renderSettings(); syncDanGrid();
});
$("#sw-op-add").addEventListener("click", () => toggleEnabledOp("add"));
$("#sw-op-sub").addEventListener("click", () => toggleEnabledOp("sub"));
$("#sw-op-div").addEventListener("click", () => toggleEnabledOp("div"));
$$("#seg-diff button").forEach(b => b.addEventListener("click", () => { sTap(); state.difficulty = b.dataset.d; save(); renderSettings(); }));
// 음악 곡 선택 버튼 생성
TRACKS.forEach((t, i) => {
  const b = document.createElement("button"); b.dataset.i = i; b.textContent = t.name;
  b.addEventListener("click", () => { sTap(); state.musicTrack = i; save(); renderSettings(); restartBGM(); });
  $("#seg-track").appendChild(b);
});
$("#reset-all").addEventListener("click", () => {
  if (confirm("정말 모든 기록과 도감을 초기화할까요?")) {
    state = defaultState();
    inQuiz = false; q = null; clearViz();
    save(); applyVolumes(); restartBGM();
    showRangeHome(); lockParent(); renderSettings();
  }
});

/* 부모 영역 재잠금(설정 탭 진입 때마다) */
function lockParent() {
  const lk = $("#parent-locked"), ar = $("#parent-area");
  if (lk) lk.style.display = "block";
  if (ar) ar.style.display = "none";
}

/* 부모 게이트 — 두 자리 덧셈 + 키패드 입력(찍기 불가, 아이 못 풂) */
let gateAns = 0, gateBuf = "";
function renderGateInput() { $("#gate-input").textContent = gateBuf === "" ? "?" : gateBuf; }
function openGate() {
  const a = 13 + rnd(74), b = 13 + rnd(74);   // 13~86
  gateAns = a + b; gateBuf = "";
  $("#gate-q").textContent = `${a} + ${b}`;
  renderGateInput();
  const keys = $("#gate-keys"); keys.innerHTML = "";
  ["1","2","3","4","5","6","7","8","9","←","0","✓"].forEach(ch => {
    const k = document.createElement("button");
    k.className = "choice key"; k.textContent = ch;
    k.addEventListener("click", () => gateKey(ch));
    keys.appendChild(k);
  });
  $("#gate-modal").classList.add("show");
}
function gateKey(ch) {
  sTap();
  if (ch === "←") { gateBuf = gateBuf.slice(0, -1); renderGateInput(); return; }
  if (ch === "✓") {
    if (parseInt(gateBuf, 10) === gateAns) {
      $("#gate-modal").classList.remove("show");
      $("#parent-locked").style.display = "none"; $("#parent-area").style.display = "block"; renderSettings();
    } else {
      const inp = $("#gate-input"); inp.classList.add("wrong-shake");
      gateBuf = ""; setTimeout(() => { inp.classList.remove("wrong-shake"); renderGateInput(); }, 400);
    }
    return;
  }
  if (gateBuf.length < 3) { gateBuf += ch; renderGateInput(); }
}
$("#open-parent").addEventListener("click", () => { sTap(); openGate(); });
$("#open-parent").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGate(); } });
$("#gate-cancel").addEventListener("click", () => { sTap(); $("#gate-modal").classList.remove("show"); });

/* ---------- 데일리 스탬프 ---------- */
function dateKey(d) { return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
let stampedToday = false;
function checkDailyStamp() {
  const today = dateKey(new Date());
  if (state.lastVisit === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  state.stampDays = (state.lastVisit === dateKey(y)) ? (state.stampDays || 0) + 1 : 1;
  state.lastVisit = today; stampedToday = true;
  if (state.stampDays % 7 === 0) bonusPending = 3;   // 7일 연속 보너스
  save();
}

/* ---------- 놀기 홈 렌더(스탬프·약점·이어하기) ---------- */
function renderPlayHome() {
  renderOpGrid();   // 부모가 연산을 켜고 돌아오면 반영
  syncDanGrid();    // 부모가 정한 단 고정/선택 반영
  // 스탬프 7칸
  const strip = $("#stamp-strip");
  const pos = ((state.stampDays - 1) % 7 + 7) % 7;  // 0~6, 오늘 위치
  let html = `<div class="lbl">${ico(EMOJI_ICON.fire, "ico-sm")}연속 출석 ${state.stampDays}일${state.stampDays>0 && state.stampDays%7===0 ? ` ${ico(EMOJI_ICON.gift, "ico-sm")}보너스!` : ""}</div>`;
  for (let i = 0; i < 7; i++) {
    const on = state.stampDays > 0 && i <= pos;
    const today = stampedToday && i === pos;
    html += `<div class="stamp ${on?"on":""} ${today?"today":""}">${on ? ico(EMOJI_ICON.star, "stamp-star") : i+1}</div>`;
  }
  strip.innerHTML = html;

  // 약점 집중
  const wb = $("#weak-banner"); wb.innerHTML = "";
  const weakDans = [], weakOps = [];
  for (let d = 2; d <= 9; d++) { const p = state.stats.perDan[d]; if (p && p.total >= 5 && p.correct/p.total < 0.6) weakDans.push(d); }
  OP_ORDER.forEach(o => { if (!state.enabledOps.includes(o)) return; const p = state.stats.perOp[o]; if (p && p.total >= 5 && p.correct/p.total < 0.6) weakOps.push(o); });
  if (weakDans.length || weakOps.length) {
    const names = [...weakDans.map(d=>d+"단"), ...weakOps.filter(o=>o!=="mul"||!weakDans.length).map(o=>OPS[o].name)];
    const b = document.createElement("div"); b.className = "banner weak";
    b.innerHTML = `<span>💪 ${names.slice(0,3).join(", ")} 연습해볼까?</span><button class="go">약점 연습</button>`;
    b.querySelector(".go").addEventListener("click", () => {
      sTap();
      state.ops = [...new Set([...weakOps, ...(weakDans.length ? ["mul"] : [])])];
      if (!state.ops.length) state.ops = ["mul"];
      if (weakDans.length) state.dans = weakDans;
      save(); startQuiz();
    });
    wb.appendChild(b);
  }

  // 이어하기
  const rh = $("#resume-hint"); rh.innerHTML = "";
  if (state.current && (state.current.revealed||[]).length > 0 && !state.collected.includes(state.current.animalId)) {
    const a = ANIMALS.find(x => x.id === state.current.animalId);
    if (a) {
      const b = document.createElement("div"); b.className = "banner resume";
      b.innerHTML = `<img src="${animalImg(a.id)}" alt=""><span>${a.name} 그리는 중 ${state.current.revealed.length}/${PATCHES_PER_ANIMAL}</span><button class="go">이어 그리기</button>`;
      b.querySelector(".go").addEventListener("click", () => { sTap(); startQuiz(); });
      rh.appendChild(b);
    }
  }
}

/* ---------- 토스트 ---------- */
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  $("#app").appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2400);
}

/* ---------- 콤보 배너 ---------- */
function maybeCombo(streak) {
  if (!(streak === 3 || streak === 5 || (streak >= 10 && streak % 5 === 0))) return false;
  const el = $("#combo-banner");
  el.textContent = `${streak}연속! 수리수리 콤보! ✨`;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  [784, 988, 1318].forEach((f,i) => tone(f, i*.07, .25, "triangle", .18));
  speak(FOX_COMBO[rnd(FOX_COMBO.length)].replace("{n}", streak)); // 꼬미 콤보 한마디
  return true;
}

/* ---------- 마스코트 리액션 ---------- */
function mascotReact(type) {
  const m = $("#mascot"), img = $("#mascot-img"); if (!m || !img) return;
  m.classList.remove("happy", "think");
  if (type === "happy") { img.src = EMOJI_ICON.foxHappy; if (!reduceMotion) m.classList.add("happy"); }
  else { img.src = EMOJI_ICON.foxThink; if (!reduceMotion) m.classList.add("think"); }
  setTimeout(() => { img.src = EMOJI_ICON.fox; }, 800);
}

/* ---------- 그림책 만들기 (세트 완성 시) ---------- */
function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width/img.height, br = w/h; let sw, sh, sx, sy;
  if (ir > br) { sh = img.height; sw = sh*br; sx = (img.width-sw)/2; sy = 0; }
  else { sw = img.width; sh = sw/br; sx = 0; sy = (img.height-sh)/2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
async function makeStorybook(setKey) {
  const set = SETS.find(s => s.key === setKey);
  const animals = ANIMALS.filter(a => a.set === setKey);
  try { await document.fonts.load("64px 'Jua'"); } catch {}
  const cols = 2, rows = Math.ceil(animals.length/cols);
  const cellW = 420, cellH = 540, pad = 28, head = 110;
  const W = pad*2 + cols*cellW + (cols-1)*pad;
  const H = head + rows*cellH + (rows-1)*pad + pad;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#FFF8E7"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = "#4a3b2a"; ctx.textAlign = "center";
  const [setImg, ...imgs] = await Promise.all([loadImg(set.icon), ...animals.map(a => loadImg(animalImg(a.id)))]);
  drawIconText(ctx, setImg, `${set.name} 그림책`, W/2, 80, 60, 60, 14);
  imgs.forEach((img,i) => {
    const c = i%cols, r = Math.floor(i/cols);
    const x = pad + c*(cellW+pad), y = head + r*(cellH+pad);
    ctx.fillStyle = "#fff"; roundRect(ctx, x, y, cellW, cellH, 20); ctx.fill();
    if (img) drawCover(ctx, img, x+10, y+10, cellW-20, cellH-78);
    ctx.fillStyle = "#4a3b2a"; ctx.font = "40px 'Jua', sans-serif";
    ctx.fillText(animals[i].name, x+cellW/2, y+cellH-22);
  });
  cv.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `수리수리도감_${set.name}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, "image/png");
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

/* ---------- 시작 ---------- */
checkDailyStamp();
showView("play");

/* PWA */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
