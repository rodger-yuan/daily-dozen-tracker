/* Daily Dozen Friends League — client-side app.
   Friends paste their Dozen share-result; it's parsed and POSTed to a Google
   Apps Script web app (which appends to a Sheet). Everyone reads history back
   from the published Sheet CSV. Submissions are also cached in localStorage so
   the submitter sees their entry instantly. No traditional backend. */

const CFG = window.DDT_CONFIG || {};
const HIGHER_BETTER = CFG.higherIsBetter !== false;
const LS_KEY = "ddt_submissions";
const LS_NAME = "ddt_player_name";
const EMOJI = { G: "🟩", R: "🟥", P: "🟪" };

const els = {
  leagueName: q("#league-name"),
  tagline: q("#tagline"),
  statusPill: q("#status-pill"),
  lastUpdated: q("#last-updated"),
  headlineStats: q("#headline-stats"),
  standingsBody: q("#standings-table tbody"),
  dailyBody: q("#daily-table tbody"),
  gamePicker: q("#game-picker"),
  // submit
  playerSelect: q("#player-select"),
  playerOther: q("#player-other"),
  pasteBox: q("#paste-box"),
  preview: q("#parse-preview"),
  submitBtn: q("#submit-btn"),
  submitMsg: q("#submit-msg"),
};

let charts = {};
let lastParsed = null;

// ── Boot ────────────────────────────────────────────────────────────
if (CFG.leagueName) els.leagueName.textContent = CFG.leagueName;
if (CFG.tagline) els.tagline.textContent = CFG.tagline;
setupTabs();
setupSubmit();
loadData();

// ── Parser ──────────────────────────────────────────────────────────
// Turns a pasted Dozen share-result into a structured record.
function parseDozenResult(text) {
  if (!text || !text.trim()) return null;
  const t = text.replace(/\r/g, "");

  const game = numMatch(t, /Game\s+#?(\d+)/i);
  const score = numMatch(t, /Score:?\s*(\d+)/i);
  let correct = numMatch(t, /(\d+)\s*Correct/i);
  const timeMatch = t.match(/Time\s*:?\s*(\d{1,2}:\d{2})/i);
  const time = timeMatch ? timeMatch[1] : null;

  // Collect the grid squares in order.
  const cells = [];
  for (const ch of t) {
    if (ch === "🟩") cells.push("G");
    else if (ch === "🟥") cells.push("R");
    else if (ch === "🟪") cells.push("P");
  }
  const grid = cells.join("");
  if (correct == null && grid) correct = countCorrect(grid);

  if (game == null || score == null) return null; // not a valid result
  return { game, score, correct, time, timeSeconds: timeToSec(time), grid };
}

const countCorrect = (grid) => (grid.match(/[GP]/g) || []).length;
function numMatch(t, re) { const m = t.match(re); return m ? parseInt(m[1], 10) : null; }
function timeToSec(s) { if (!s) return null; const [m, sec] = s.split(":").map(Number); return m * 60 + sec; }

// ── Submit flow ─────────────────────────────────────────────────────
function setupSubmit() {
  // Populate roster dropdown.
  const roster = CFG.players || [];
  els.playerSelect.innerHTML =
    `<option value="">— pick your name —</option>` +
    roster.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("") +
    `<option value="__other">Someone else…</option>`;

  const savedName = localStorage.getItem(LS_NAME);
  if (savedName) {
    if (roster.includes(savedName)) els.playerSelect.value = savedName;
    else { els.playerSelect.value = "__other"; els.playerOther.value = savedName; }
  }
  toggleOther();

  els.playerSelect.addEventListener("change", () => { toggleOther(); refreshSubmitState(); });
  els.playerOther.addEventListener("input", refreshSubmitState);
  els.pasteBox.addEventListener("input", () => { lastParsed = parseDozenResult(els.pasteBox.value); renderPreview(); refreshSubmitState(); });
  els.submitBtn.addEventListener("click", submitResult);
}

function toggleOther() {
  els.playerOther.classList.toggle("hidden", els.playerSelect.value !== "__other");
}

function currentPlayer() {
  const sel = els.playerSelect.value;
  if (sel === "__other" || sel === "") return els.playerOther.value.trim();
  return sel;
}

function refreshSubmitState() {
  els.submitBtn.disabled = !(lastParsed && currentPlayer());
}

function renderPreview() {
  if (!lastParsed) {
    if (els.pasteBox.value.trim()) {
      els.preview.classList.remove("hidden");
      els.preview.innerHTML = `<span class="bad">⚠ Couldn’t read that — make sure you pasted the whole result (with “Game …” and “Score: …”).</span>`;
    } else {
      els.preview.classList.add("hidden");
    }
    return;
  }
  const p = lastParsed;
  els.preview.classList.remove("hidden");
  els.preview.innerHTML = `
    <div class="preview-row">
      <span class="preview-game">Game ${p.game}</span>
      <span class="preview-stat"><b>${p.score}</b> pts</span>
      <span class="preview-stat"><b>${p.correct}</b> correct</span>
      ${p.time ? `<span class="preview-stat">⏱ ${p.time}</span>` : ""}
    </div>
    <div class="grid-mini">${renderGrid(p.grid)}</div>`;
}

async function submitResult() {
  const player = currentPlayer();
  if (!lastParsed || !player) return;
  localStorage.setItem(LS_NAME, player);

  const record = { ...lastParsed, player, submitted_at: new Date().toISOString() };
  els.submitBtn.disabled = true;
  setMsg("Saving…", "");

  // 1) Cache locally so the submitter sees it immediately (CSV publish lags).
  saveLocal(record);

  // 2) Send to the Sheet, if a backend is configured.
  const endpoint = (CFG.submitEndpoint || "").trim();
  if (endpoint) {
    try {
      // text/plain avoids a CORS preflight that Apps Script can't answer.
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(record),
      });
      setMsg(`Saved! Game ${record.game} logged for ${player}. 🎉 (Others see it once the sheet refreshes.)`, "good");
    } catch (err) {
      setMsg(`Saved on this device. The shared save didn’t go through (${err.message}) — check the submit endpoint.`, "warn");
    }
  } else {
    setMsg(`Saved on this device only — no backend configured yet (see README). 🎉`, "warn");
  }

  els.pasteBox.value = "";
  lastParsed = null;
  renderPreview();
  loadData(); // re-render with the new entry merged in
}

function setMsg(text, kind) {
  els.submitMsg.textContent = text;
  els.submitMsg.className = "submit-msg " + (kind || "");
}

function saveLocal(record) {
  const all = readLocal();
  const key = subKey(record);
  const idx = all.findIndex((r) => subKey(r) === key);
  if (idx >= 0) all[idx] = record; else all.push(record);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}
function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
const subKey = (r) => `${r.game}|${String(r.player).toLowerCase()}`;

// ── Data loading ────────────────────────────────────────────────────
function loadData() {
  const url = (CFG.sheetCsvUrl || "").trim();
  const source = url || "data/results.csv";
  const isLive = !!url;

  Papa.parse(source, {
    download: true, header: true, skipEmptyLines: true,
    complete: (res) => {
      try {
        const remote = normalize(res.data);
        const rows = mergeLocal(remote);
        if (!rows.length) throw new Error("No valid results found yet.");
        setStatus(isLive ? "live" : "seed");
        render(rows);
      } catch (err) { setStatus("error", err.message); }
    },
    error: (err) => {
      // Even if the CSV fails, still show local submissions.
      const rows = mergeLocal([]);
      if (rows.length) { setStatus(isLive ? "live" : "seed"); render(rows); }
      else setStatus("error", (err && err.message) || "Could not load data.");
    },
  });
}

// Merge localStorage submissions with the CSV; CSV wins on duplicates.
function mergeLocal(remote) {
  const seen = new Set(remote.map(subKey));
  const extra = readLocal()
    .map((r) => ({
      game: +r.game, player: String(r.player).trim(), score: +r.score,
      correct: r.correct != null ? +r.correct : countCorrect(r.grid || ""),
      time: r.time || null, timeSeconds: r.timeSeconds ?? timeToSec(r.time), grid: r.grid || "",
    }))
    .filter((r) => Number.isFinite(r.game) && r.player && Number.isFinite(r.score) && !seen.has(subKey(r)));
  return remote.concat(extra);
}

function setStatus(kind, msg) {
  const pill = els.statusPill;
  pill.className = "pill " + kind;
  pill.textContent = kind === "live" ? "● Live" : kind === "seed" ? "● Sample data" : "⚠ Error";
  els.lastUpdated.textContent = kind === "error" ? (msg || "") : "";
  if (kind === "error") console.error("[DDT]", msg);
}

// Flexible column matching (works with Apps Script sheet incl. a timestamp col).
function normalize(rawRows) {
  if (!rawRows.length) return [];
  const keys = Object.keys(rawRows[0]);
  const find = (...c) =>
    keys.find((k) => c.some((x) => k.trim().toLowerCase() === x)) ||
    keys.find((k) => c.some((x) => k.trim().toLowerCase().includes(x)));

  const gameK = find("game", "number", "#");
  const playerK = find("player", "name", "username", "who");
  const scoreK = find("score", "points");
  const correctK = find("correct");
  const timeK = find("time", "duration");
  const gridK = find("grid", "squares", "pattern");
  if (!gameK || !playerK || !scoreK)
    throw new Error(`Missing game/player/score columns. Saw: ${keys.join(", ")}`);

  return rawRows
    .map((r) => {
      const grid = gridK ? cleanGrid(r[gridK]) : "";
      return {
        game: parseInt(String(r[gameK]).replace(/[^0-9]/g, ""), 10),
        player: String(r[playerK] || "").trim(),
        score: parseFloat(String(r[scoreK]).replace(/[^0-9.\-]/g, "")),
        correct: correctK && r[correctK] !== "" && r[correctK] != null
          ? parseInt(String(r[correctK]).replace(/[^0-9]/g, ""), 10)
          : countCorrect(grid),
        time: timeK ? (String(r[timeK]).match(/\d{1,2}:\d{2}/) || [null])[0] : null,
        get timeSeconds() { return timeToSec(this.time); },
        grid,
      };
    })
    .filter((r) => Number.isFinite(r.game) && r.player && Number.isFinite(r.score));
}
// Sheets may store the emoji grid; accept either letters or emoji.
function cleanGrid(v) {
  if (!v) return "";
  const s = String(v);
  if (/[🟩🟥🟪]/.test(s)) return [...s].map((c) => ({ "🟩": "G", "🟥": "R", "🟪": "P" }[c])).filter(Boolean).join("");
  return s.toUpperCase().replace(/[^GRP]/g, "");
}

// ── Rendering ───────────────────────────────────────────────────────
function render(rows) {
  rows.sort((a, b) => a.game - b.game);
  const games = [...new Set(rows.map((r) => r.game))].sort((a, b) => a - b);
  const players = [...new Set(rows.map((r) => r.player))].sort();

  const byGame = {};
  games.forEach((g) => (byGame[g] = rows.filter((r) => r.game === g)));
  const winnersByGame = {};
  games.forEach((g) => {
    const day = byGame[g];
    const best = day.reduce((acc, r) => bestOf(acc, r.score), day[0].score);
    winnersByGame[g] = new Set(day.filter((r) => r.score === best).map((r) => r.player));
  });

  const stats = buildPlayerStats(rows, players, games, winnersByGame);
  renderHeadline(stats, games, rows);
  renderStandings(stats);
  renderByGame(byGame, winnersByGame, games);
  renderCharts(rows, players, games, stats);
}

const bestOf = (a, b) => (HIGHER_BETTER ? Math.max(a, b) : Math.min(a, b));

function buildPlayerStats(rows, players, games, winnersByGame) {
  return players
    .map((p) => {
      const g = rows.filter((r) => r.player === p).sort((a, b) => a.game - b.game);
      const scores = g.map((x) => x.score);
      const corrects = g.map((x) => x.correct).filter(Number.isFinite);
      const wins = games.filter((gm) => winnersByGame[gm].has(p)).length;
      const last5 = g.slice(-5).map((x) => ({ score: x.score, won: winnersByGame[x.game].has(p) }));
      return {
        player: p, games: g.length, wins,
        total: scores.reduce((a, b) => a + b, 0),
        avg: avg(scores), avgCorrect: avg(corrects),
        best: scores.length ? scores.reduce(bestOf) : 0,
        last5, history: g,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.avg - a.avg || b.total - a.total);
}
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function renderHeadline(stats, games, rows) {
  const leader = stats[0];
  const cards = [
    { label: "Players", value: stats.length },
    { label: "Games tracked", value: games.length },
    { label: "Results logged", value: rows.length },
    { label: "Current leader", value: leader ? `${esc(leader.player)} <small>· ${leader.wins}W</small>` : "—" },
  ];
  els.headlineStats.innerHTML = cards
    .map((c) => `<div class="stat"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`)
    .join("");
}

function renderStandings(stats) {
  els.standingsBody.innerHTML = stats
    .map((s, i) => {
      const form = s.last5.map((g) => (g.won ? "🥇" : `<span class="muted">${fmt(g.score)}</span>`)).join(" ");
      return `<tr>
        <td class="${i === 0 ? "rank-1" : ""}">${i + 1}</td>
        <td class="player-cell ${i === 0 ? "rank-1" : ""}">${i === 0 ? "👑 " : ""}${esc(s.player)}</td>
        <td>${s.wins}</td>
        <td>${s.games}</td>
        <td>${fmt(s.avg, 1)}</td>
        <td>${fmt(s.avgCorrect, 1)}</td>
        <td>${fmt(s.best)}</td>
        <td class="form-dots">${form || "—"}</td>
      </tr>`;
    })
    .join("");
}

function renderByGame(byGame, winnersByGame, games) {
  els.gamePicker.innerHTML = games
    .slice().reverse()
    .map((g) => `<option value="${g}">Game ${g}</option>`)
    .join("");

  const draw = (g) => {
    const sorted = byGame[g].slice().sort((a, b) => (HIGHER_BETTER ? b.score - a.score : a.score - b.score));
    els.dailyBody.innerHTML = sorted
      .map((r, i) => {
        const won = winnersByGame[g].has(r.player);
        const medal = won ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
        return `<tr>
          <td class="${won ? "rank-1" : ""}">${i + 1}</td>
          <td class="player-cell ${won ? "rank-1" : ""}">${medal ? `<span class="medal">${medal}</span> ` : ""}${esc(r.player)}</td>
          <td>${fmt(r.score)}</td>
          <td>${fmt(r.correct)}/9</td>
          <td>${r.time || "—"}</td>
          <td class="grid-cell">${renderGrid(r.grid)}</td>
        </tr>`;
      })
      .join("");
  };
  els.gamePicker.onchange = (e) => draw(+e.target.value);
  draw(games[games.length - 1]);
}

function renderGrid(grid) {
  if (!grid) return "<span class='muted'>—</span>";
  const cells = grid.split("").map((c) => `<span class="cell">${EMOJI[c] || ""}</span>`).join("");
  return `<span class="grid3">${cells}</span>`;
}

function renderCharts(rows, players, games, stats) {
  const palette = ["#f5c518", "#5b8def", "#4ade80", "#f87171", "#c084fc", "#fb923c", "#22d3ee", "#e879f9", "#a3e635", "#facc15"];
  Object.values(charts).forEach((c) => c && c.destroy());

  const lineDatasets = players.map((p, i) => {
    const color = palette[i % palette.length];
    return {
      label: p,
      data: games.map((g) => { const hit = rows.find((r) => r.game === g && r.player === p); return hit ? hit.score : null; }),
      borderColor: color, backgroundColor: color, tension: 0.3, spanGaps: true, pointRadius: 3,
    };
  });

  charts.line = new Chart(q("#line-chart"), {
    type: "line",
    data: { labels: games.map((g) => "#" + g), datasets: lineDatasets },
    options: chartOpts({ beginAtZero: true, grid: { color: "#262b38" } }),
  });

  charts.wins = new Chart(q("#wins-chart"), {
    type: "bar",
    data: { labels: stats.map((s) => s.player), datasets: [{ label: "Wins", data: stats.map((s) => s.wins), backgroundColor: stats.map((_, i) => palette[i % palette.length]), borderRadius: 6 }] },
    options: chartOpts({ beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#262b38" } }, false),
  });
}

function chartOpts(scalesY, showLegend = true) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: showLegend, labels: { color: "#cdd2de", usePointStyle: true } } },
    scales: { x: { ticks: { color: "#9aa0b0" }, grid: { color: "#1f2430" } }, y: { ticks: { color: "#9aa0b0" }, ...scalesY } },
  };
}

// ── Tabs ────────────────────────────────────────────────────────────
function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
      q("#tab-" + tab.dataset.tab).classList.add("is-active");
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────
function q(sel) { return document.querySelector(sel); }
function fmt(n, dp = 0) {
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) && dp === 0 ? String(n) : n.toFixed(dp);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
