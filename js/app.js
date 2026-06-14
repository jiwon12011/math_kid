// 수리수리 도감 — 앱 로직
import { SETS, ANIMALS, RARITY, PATCH_COLS, PATCH_ROWS, PATCHES_PER_ANIMAL, animalImg } from "./data.js";

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
  ops: ["mul"],                     // 선택 연산 종류
  sound: true,
  voice: true,                      // 음성 안내
  difficulty: "normal",
  lastVisit: "",                    // 데일리 스탬프
  stampDays: 0,
  stats: { correct: 0, total: 0, streak: 0, bestStreak: 0, perDan: {}, perOp: {} },
});
let state = load();
function load() {
  let s;
  try { s = Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { s = defaultState(); }
  // 구버전 저장 호환
  s.ops = s.ops && s.ops.length ? s.ops : ["mul"];
  if (typeof s.voice !== "boolean") s.voice = true;
  s.stats = s.stats || {};
  s.stats.perDan = s.stats.perDan || {};
  s.stats.perOp = s.stats.perOp || {};
  return s;
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

/* ---------- 사운드 (WebAudio, 파일 없이 생성) ---------- */
let actx;
function tone(freq, t0, dur, type = "sine", gain = .18) {
  if (!state.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime + t0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.start(t); o.stop(t + dur);
  } catch {}
}
const sCorrect  = () => { tone(660, 0, .15, "triangle"); tone(880, .08, .2, "triangle"); };
const sWrong    = () => { tone(220, 0, .22, "sine", .14); };
const sComplete = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .11, .3, "triangle", .2));
const sTap      = () => tone(520, 0, .07, "sine", .1);

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

/* ---------- 네비게이션 ---------- */
function showView(v) {
  $$(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + v));
  $$(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
  if (v === "play") renderPlayHome();
  if (v === "dex") renderDex();
  if (v === "settings") renderSettings();
}
$$(".nav button").forEach(b => b.addEventListener("click", () => { sTap(); showView(b.dataset.view); }));

/* ---------- 놀기: 범위 선택 ---------- */
// 연산 종류 카드
const opGrid = $("#op-grid");
OP_ORDER.forEach(key => {
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
function updateDanVisibility() {
  $("#dan-section").style.display = state.ops.includes("mul") ? "block" : "none";
}

const danGrid = $("#dan-grid");
for (let d = 2; d <= 9; d++) {
  const c = document.createElement("button");
  c.className = "dan-card"; c.dataset.dan = d;
  c.setAttribute("aria-pressed", state.dans.includes(d));
  c.innerHTML = `<span class="n">${d}단</span><span class="x">${d}×1 … ${d}×9</span>`;
  c.addEventListener("click", () => {
    const on = c.getAttribute("aria-pressed") === "true";
    c.setAttribute("aria-pressed", !on);
    state.dans = $$(".dan-card", danGrid).filter(x => x.getAttribute("aria-pressed") === "true").map(x => +x.dataset.dan);
    sTap(); save();
  });
  danGrid.appendChild(c);
}
$("#pick-all").addEventListener("click", () => { sTap(); $$(".dan-card").forEach(c => c.setAttribute("aria-pressed", "true")); state.dans = [2,3,4,5,6,7,8,9]; save(); });
$("#pick-clear").addEventListener("click", () => { sTap(); $$(".dan-card").forEach(c => c.setAttribute("aria-pressed", "false")); state.dans = []; save(); });

updateDanVisibility();

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
let bonusPending = 0;
function startQuiz() {
  $("#play-range").style.display = "none";
  $("#play-quiz").style.display = "flex";
  const animal = pickAnimal();
  buildCanvas(animal);
  if (bonusPending > 0) {
    const give = Math.min(bonusPending, PATCHES_PER_ANIMAL - state.current.revealed.length);
    for (let i = 0; i < give; i++) revealPatch();
    if (give > 0) coach("출석 보너스! 색을 미리 칠해줬어 🎁", true);
    bonusPending = 0; save();
  }
  nextQuestion();
}
function exitQuiz() {
  $("#play-quiz").style.display = "none";
  $("#play-range").style.display = "flex";
  renderPlayHome();
}
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
  $("#prog-animal").textContent = `${SETS.find(s=>s.key===animal.set).emoji} ${animal.name}`;
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
  return { op, a, b, answer, key };
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

let locking = false;
function answer(btn, val) {
  if (locking) return;
  const correct = val === q.answer;
  // 통계
  state.stats.total++;
  const op = state.stats.perOp[q.op] = state.stats.perOp[q.op] || { correct: 0, total: 0 };
  op.total++;
  let dStat = null;
  if (q.op === "mul") {
    const dk = String(q.a);
    dStat = state.stats.perDan[dk] = state.stats.perDan[dk] || { correct: 0, total: 0 };
    dStat.total++;
  }
  if (correct) {
    locking = true;
    state.stats.correct++; op.correct++; if (dStat) dStat.correct++;
    state.stats.streak++; state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
    btn.classList.add("correct"); sCorrect();
    mascotReact("happy"); maybeCombo(state.stats.streak);
    const praise = PRAISE[rnd(PRAISE.length)];
    coach(praise, true); speak(praise.replace(/[^가-힣! ]/g, "").trim() || "정답!");
    $$(".choice").forEach(c => c.disabled = true);
    revealPatch();
    save();
    setTimeout(afterCorrect, reduceMotion ? 200 : 650);
  } else {
    state.stats.streak = 0;
    btn.classList.add("wrong"); btn.disabled = true; sWrong();
    mascotReact("think");
    const nudge = NUDGE[rnd(NUDGE.length)];
    coach(nudge); speak("다시 해볼까?");
    save();
  }
}
function revealPatch() {
  const done = state.current.revealed;
  const remaining = [];
  for (let i = 0; i < PATCHES_PER_ANIMAL; i++) if (!done.includes(i)) remaining.push(i);
  if (!remaining.length) return;
  const idx = remaining[rnd(remaining.length)];
  done.push(idx);
  applyMask();
  magicPop(currentCells[idx]);
  const animal = ANIMALS.find(a => a.id === state.current.animalId);
  updateProgress(animal);
}
function afterCorrect() {
  locking = false;
  if (state.current.revealed.length >= PATCHES_PER_ANIMAL) completeAnimal();
  else nextQuestion();
}

function completeAnimal() {
  const animal = ANIMALS.find(a => a.id === state.current.animalId);
  if (!state.collected.includes(animal.id)) state.collected.push(animal.id);
  state.current = null; save();
  sComplete(); burst();
  speak(`마수리 완성! ${animal.name}를 모았어요!`);
  $("#reward-img").src = animalImg(animal.id);
  $("#reward-name").textContent = `${SETS.find(s=>s.key===animal.set).emoji} ${animal.name}`;
  const r = RARITY[animal.rarity];
  $("#reward-rarity").textContent = `${r.star} ${r.label} 동물을 모았어요!`;
  $("#reward-modal").classList.add("show");
}
$("#reward-next").addEventListener("click", () => {
  sTap(); $("#reward-modal").classList.remove("show");
  const a = pickAnimal(); buildCanvas(a); nextQuestion();
});
$("#reward-dex").addEventListener("click", () => {
  sTap(); $("#reward-modal").classList.remove("show"); exitQuiz(); showView("dex");
});

function coach(msg, good=false) { const c = $("#coach"); c.textContent = msg; c.classList.toggle("good", good); }

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
function burst() {
  if (reduceMotion) return;
  const host = $("#reward-modal");
  for (let i = 0; i < 24; i++) {
    const s = document.createElement("div");
    s.className = "spark"; s.textContent = ["✨","🎉","⭐","🌈","💛"][rnd(5)];
    s.style.left = (40 + Math.random()*20) + "%"; s.style.top = "40%";
    s.style.fontSize = (14 + Math.random()*16) + "px";
    s.style.setProperty("--dx", (Math.random()*2-1));
    s.style.animation = `floatUp ${.8+Math.random()*.6}s ease forwards`;
    s.style.transform = `translateX(${(Math.random()*200-100)}px)`;
    host.appendChild(s);
    setTimeout(() => s.remove(), 1500);
  }
}

/* ---------- 도감 ---------- */
function renderDex() {
  $("#dex-total").textContent = `${state.collected.length} / ${ANIMALS.length}`;
  const host = $("#dex-scroll"); host.innerHTML = "";
  SETS.forEach(set => {
    const animals = ANIMALS.filter(a => a.set === set.key);
    const have = animals.filter(a => state.collected.includes(a.id)).length;
    const block = document.createElement("div"); block.className = "set-block";
    block.innerHTML = `
      <div class="set-head"><span class="name">${set.emoji} ${set.name}</span><span class="count">${have}/${animals.length}</span></div>
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
      bk.className = "btn book-btn"; bk.textContent = "📚 그림책 만들기";
      bk.addEventListener("click", () => { sTap(); bk.textContent = "만드는 중…"; makeStorybook(set.key).then(() => bk.textContent = "📚 그림책 만들기"); });
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
    <p class="reward-title">${SETS.find(s=>s.key===a.set).emoji} ${a.name}</p>
    <p class="reward-rarity">${r.star} ${r.label}</p>
    <button class="btn primary big" style="margin-top:10px;">닫기</button>
  </div>`;
  back.addEventListener("click", e => { if (e.target === back || e.target.closest("button")) { sTap(); back.remove(); } });
  $("#app").appendChild(back);
}

/* ---------- 설정 ---------- */
function renderSettings() {
  $("#sw-sound").setAttribute("aria-checked", state.sound);
  $("#sw-voice").setAttribute("aria-checked", state.voice);
  $$("#seg-diff button").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === state.difficulty));
  const s = state.stats;
  $("#st-correct").textContent = s.correct;
  $("#st-acc").textContent = (s.total ? Math.round(s.correct / s.total * 100) : 0) + "%";
  $("#st-dex").textContent = state.collected.length;
  $("#st-streak").textContent = s.bestStreak;
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
        <div class="set-bar" style="flex:1;margin:0"><i style="width:${pct}%"></i></div>
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
      <div class="set-bar" style="flex:1;margin:0"><i style="width:${pct}%"></i></div>
      <span style="width:54px;text-align:right;color:var(--ink-soft)">${pd.total?pct+"%":"-"}</span>`;
    ds.appendChild(row);
  }
}
$("#sw-sound").addEventListener("click", () => { state.sound = !state.sound; save(); renderSettings(); if (state.sound) sTap(); });
$("#sw-voice").addEventListener("click", () => { state.voice = !state.voice; save(); renderSettings(); if (state.voice) speak("음성 안내를 켰어요"); });
$$("#seg-diff button").forEach(b => b.addEventListener("click", () => { sTap(); state.difficulty = b.dataset.d; save(); renderSettings(); }));
$("#reset-all").addEventListener("click", () => {
  if (confirm("정말 모든 기록과 도감을 초기화할까요?")) { state = defaultState(); save(); renderSettings(); }
});

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
  // 스탬프 7칸
  const strip = $("#stamp-strip");
  const pos = ((state.stampDays - 1) % 7 + 7) % 7;  // 0~6, 오늘 위치
  let html = `<div class="lbl">🔥 연속 출석 ${state.stampDays}일${state.stampDays>0 && state.stampDays%7===0 ? " · 보너스!" : ""}</div>`;
  for (let i = 0; i < 7; i++) {
    const on = state.stampDays > 0 && i <= pos;
    const today = stampedToday && i === pos;
    html += `<div class="stamp ${on?"on":""} ${today?"today":""}">${on?"⭐":i+1}</div>`;
  }
  strip.innerHTML = html;

  // 약점 집중
  const wb = $("#weak-banner"); wb.innerHTML = "";
  const weakDans = [], weakOps = [];
  for (let d = 2; d <= 9; d++) { const p = state.stats.perDan[d]; if (p && p.total >= 5 && p.correct/p.total < 0.6) weakDans.push(d); }
  OP_ORDER.forEach(o => { const p = state.stats.perOp[o]; if (p && p.total >= 5 && p.correct/p.total < 0.6) weakOps.push(o); });
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

/* ---------- 콤보 배너 ---------- */
function maybeCombo(streak) {
  if (!(streak === 3 || streak === 5 || (streak >= 10 && streak % 5 === 0))) return;
  const el = $("#combo-banner");
  el.textContent = `${streak}연속! 수리수리 콤보! ✨`;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  [784, 988, 1318].forEach((f,i) => tone(f, i*.07, .25, "triangle", .18));
}

/* ---------- 마스코트 리액션 ---------- */
function mascotReact(type) {
  const m = $("#mascot"); if (!m) return;
  m.classList.remove("happy", "think");
  if (type === "happy") { m.textContent = "🤩"; if (!reduceMotion) m.classList.add("happy"); setTimeout(()=>{ m.textContent="🦊"; }, 700); }
  else { m.textContent = "🤔"; if (!reduceMotion) m.classList.add("think"); setTimeout(()=>{ m.textContent="🦊"; }, 700); }
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
  try { await document.fonts.load("64px 'Hi Melody'"); } catch {}
  const cols = 2, rows = Math.ceil(animals.length/cols);
  const cellW = 420, cellH = 540, pad = 28, head = 110;
  const W = pad*2 + cols*cellW + (cols-1)*pad;
  const H = head + rows*cellH + (rows-1)*pad + pad;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#FFF8E7"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = "#4a3b2a"; ctx.textAlign = "center";
  ctx.font = "64px 'Hi Melody', sans-serif";
  ctx.fillText(`${set.emoji} ${set.name} 그림책`, W/2, 76);
  const imgs = await Promise.all(animals.map(a => loadImg(animalImg(a.id))));
  imgs.forEach((img,i) => {
    const c = i%cols, r = Math.floor(i/cols);
    const x = pad + c*(cellW+pad), y = head + r*(cellH+pad);
    ctx.fillStyle = "#fff"; roundRect(ctx, x, y, cellW, cellH, 20); ctx.fill();
    if (img) drawCover(ctx, img, x+10, y+10, cellW-20, cellH-78);
    ctx.fillStyle = "#4a3b2a"; ctx.font = "40px 'Hi Melody', sans-serif";
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
