// 수리수리 도감 — 앱 로직
import { SETS, ANIMALS, RARITY, PATCH_COLS, PATCH_ROWS, PATCHES_PER_ANIMAL, animalImg } from "./data.js";

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 상태 / 저장 ---------- */
const KEY = "surisuri.v1";
const defaultState = () => ({
  collected: [],                    // 완성한 동물 id
  current: null,                    // { animalId, revealed: [idx...] }
  dans: [2, 3, 4, 5],               // 선택 단
  sound: true,
  difficulty: "normal",
  stats: { correct: 0, total: 0, streak: 0, bestStreak: 0, perDan: {} },
});
let state = load();
function load() {
  try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { return defaultState(); }
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

/* ---------- 네비게이션 ---------- */
function showView(v) {
  $$(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + v));
  $$(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
  if (v === "dex") renderDex();
  if (v === "settings") renderSettings();
}
$$(".nav button").forEach(b => b.addEventListener("click", () => { sTap(); showView(b.dataset.view); }));

/* ---------- 놀기: 범위 선택 ---------- */
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

$("#start-quiz").addEventListener("click", () => {
  if (!state.dans.length) { coach("단을 하나 이상 골라줘!"); return; }
  sTap(); startQuiz();
});

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
function startQuiz() {
  $("#play-range").style.display = "none";
  $("#play-quiz").style.display = "flex";
  const animal = pickAnimal();
  buildCanvas(animal);
  nextQuestion();
}
function exitQuiz() {
  $("#play-quiz").style.display = "none";
  $("#play-range").style.display = "flex";
}
$("#quiz-back").addEventListener("click", () => { sTap(); exitQuiz(); });

/* 색칠판 만들기 */
function buildCanvas(animal) {
  const inner = $("#canvas-inner");
  const url = animalImg(animal.id);
  inner.innerHTML = "";
  const base = document.createElement("img");
  base.className = "base"; base.src = url; base.alt = ""; base.loading = "eager";
  inner.appendChild(base);
  for (let r = 0; r < PATCH_ROWS; r++) for (let c = 0; c < PATCH_COLS; c++) {
    const idx = r * PATCH_COLS + c;
    const p = document.createElement("div");
    p.className = "patch"; p.dataset.idx = idx;
    p.style.left   = (c / PATCH_COLS * 100) + "%";
    p.style.top    = (r / PATCH_ROWS * 100) + "%";
    p.style.width  = (100 / PATCH_COLS) + "%";
    p.style.height = (100 / PATCH_ROWS) + "%";
    p.style.backgroundImage = `url("${url}")`;
    p.style.backgroundPosition = `${PATCH_COLS > 1 ? c / (PATCH_COLS - 1) * 100 : 0}% ${PATCH_ROWS > 1 ? r / (PATCH_ROWS - 1) * 100 : 0}%`;
    inner.appendChild(p);
  }
  // 이미 진행된 칸 복원
  (state.current.revealed || []).forEach(i => {
    const el = inner.querySelector(`.patch[data-idx="${i}"]`);
    if (el) el.classList.add("on");
  });
  updateProgress(animal);
}
function updateProgress(animal) {
  const n = state.current.revealed.length;
  $("#prog-text").textContent = `${n} / ${PATCHES_PER_ANIMAL}`;
  $("#prog-animal").textContent = `${SETS.find(s=>s.key===animal.set).emoji} ${animal.name}`;
  $("#prog-fill").style.width = (n / PATCHES_PER_ANIMAL * 100) + "%";
}

/* 문제 생성 */
const rnd = n => Math.floor(Math.random() * n);
function makeQuestion() {
  const dans = state.dans.length ? state.dans : [2,3,4,5];
  let a, b, ans, guard = 0;
  do { a = dans[rnd(dans.length)]; b = 1 + rnd(9); ans = a * b; guard++; }
  while (q && a === q.a && b === q.b && guard < 8);
  return { a, b, answer: ans };
}
function distractors(ans, a, b) {
  const cand = new Set([a*(b+1), a*(b-1), (a+1)*b, (a-1)*b, ans+a, Math.abs(ans-a), ans+1, ans-1, ans+2, ans+a+1]);
  const spread = state.difficulty === "hard" ? 1 : state.difficulty === "easy" ? 3 : 2;
  const out = [...cand].filter(x => x > 0 && x !== ans);
  // easy면 정답과 좀 떨어진 보기 위주
  out.sort(() => Math.random() - .5);
  if (state.difficulty === "easy") out.sort((x,y) => Math.abs(y-ans) - Math.abs(x-ans));
  const picked = [];
  for (const x of out) { if (!picked.includes(x)) picked.push(x); if (picked.length === 3) break; }
  while (picked.length < 3) { const x = ans + (picked.length+1)*spread; if (!picked.includes(x) && x!==ans) picked.push(x); }
  return picked;
}
function nextQuestion() {
  q = makeQuestion();
  $("#q-text").textContent = `${q.a} × ${q.b}`;
  const opts = [q.answer, ...distractors(q.answer, q.a, q.b)].sort(() => Math.random() - .5);
  const box = $("#choices"); box.innerHTML = "";
  opts.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "choice"; btn.textContent = v;
    btn.addEventListener("click", () => answer(btn, v), { once: false });
    box.appendChild(btn);
  });
  coach("정답을 골라봐!");
}

const PRAISE = ["수리수리! ✨", "잘했어! 🎉", "정답이야! 👏", "멋져! 🌟", "좋아 좋아!"];
const NUDGE  = ["괜찮아, 다시! 💪", "한 번 더 생각해봐!", "거의 다 왔어!", "다시 골라볼까?"];

let locking = false;
function answer(btn, val) {
  if (locking) return;
  const correct = val === q.answer;
  // 통계
  state.stats.total++;
  const dk = String(q.a);
  state.stats.perDan[dk] = state.stats.perDan[dk] || { correct: 0, total: 0 };
  state.stats.perDan[dk].total++;
  if (correct) {
    locking = true;
    state.stats.correct++; state.stats.perDan[dk].correct++;
    state.stats.streak++; state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
    btn.classList.add("correct"); sCorrect();
    coach(PRAISE[rnd(PRAISE.length)], true);
    $$(".choice").forEach(c => c.disabled = true);
    revealPatch();
    save();
    setTimeout(afterCorrect, reduceMotion ? 200 : 650);
  } else {
    state.stats.streak = 0;
    btn.classList.add("wrong"); btn.disabled = true; sWrong();
    coach(NUDGE[rnd(NUDGE.length)]);
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
  const el = $(`#canvas-inner .patch[data-idx="${idx}"]`);
  if (el) {
    el.classList.add("on");
    sparkle(el);
  }
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

/* 스파클 입자 */
function sparkle(el) {
  if (reduceMotion) return;
  const r = el.getBoundingClientRect(), wrap = $(".canvas-wrap").getBoundingClientRect();
  for (let i = 0; i < 4; i++) {
    const s = document.createElement("div");
    s.className = "spark"; s.textContent = ["✨","⭐","🌟"][rnd(3)];
    s.style.left = (r.left - wrap.left + r.width * Math.random()) + "px";
    s.style.top  = (r.top - wrap.top + r.height * Math.random()) + "px";
    s.style.animation = "floatUp .8s ease forwards";
    $(".canvas-wrap").appendChild(s);
    setTimeout(() => s.remove(), 850);
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
  $$("#seg-diff button").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === state.difficulty));
  const s = state.stats;
  $("#st-correct").textContent = s.correct;
  $("#st-acc").textContent = (s.total ? Math.round(s.correct / s.total * 100) : 0) + "%";
  $("#st-dex").textContent = state.collected.length;
  $("#st-streak").textContent = s.bestStreak;
  const ds = $("#dan-stats"); ds.innerHTML = "";
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
$$("#seg-diff button").forEach(b => b.addEventListener("click", () => { sTap(); state.difficulty = b.dataset.d; save(); renderSettings(); }));
$("#reset-all").addEventListener("click", () => {
  if (confirm("정말 모든 기록과 도감을 초기화할까요?")) { state = defaultState(); save(); renderSettings(); }
});

/* 부모 게이트 */
let gateAns = 0;
function openGate() {
  const a = 3 + rnd(7), b = 3 + rnd(7); gateAns = a * b;
  $("#gate-q").textContent = `${a} × ${b}`;
  const opts = [gateAns, gateAns+a, gateAns-b, a*(b+1), (a+1)*b, gateAns+1]
    .filter((v,i,arr)=>v>0 && arr.indexOf(v)===i).slice(0,6).sort(()=>Math.random()-.5);
  const keys = $("#gate-keys"); keys.innerHTML = "";
  opts.forEach(v => { const k = document.createElement("button"); k.className="choice"; k.textContent=v;
    k.addEventListener("click", () => {
      if (v === gateAns) { $("#gate-modal").classList.remove("show"); $("#parent-locked").style.display="none"; $("#parent-area").style.display="block"; renderSettings(); }
      else { k.classList.add("wrong"); k.disabled = true; }
    });
    keys.appendChild(k);
  });
  $("#gate-modal").classList.add("show");
}
$("#open-parent").addEventListener("click", () => { sTap(); openGate(); });
$("#open-parent").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGate(); } });
$("#gate-cancel").addEventListener("click", () => { sTap(); $("#gate-modal").classList.remove("show"); });

/* ---------- 시작 ---------- */
showView("play");

/* PWA */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
