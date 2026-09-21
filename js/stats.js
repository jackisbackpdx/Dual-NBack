/* Statistics.
 *
 * The teal average-N card is the original's own chart and keeps its shape; the
 * tiles, the rounds chart, the two meters and the sentences underneath are this
 * clone's additions, and they answer the questions the original leaves open:
 * how hard am I playing, how often, and which sense is costing me the level.
 *
 * Form follows the job: single numbers are tiles rather than charts, change over
 * time is a line, per-day volume is bars against the recommended 20, and the two
 * catch rates are meters, each carrying its own icon so identity never rests on
 * colour alone.
 */

import { store } from './store.js';
import { $ } from './ui.js';
import { icons } from './icons.js';

const W = 340, H = 250;
const PAD = { l: 30, r: 14, t: 14, b: 26 };
const GOAL = 20;                 // rounds a day, per the app's own advice
const MAX_DAYS = 30;

const pct = (v) => `${Math.round(v * 100)}%`;
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);

/* ── tiles ───────────────────────────────────────────────── */
function tiles(m) {
  const items = [
    ['BEST N', m.best, 'highest N reached'],
    ['AVERAGE N', one(m.avg7), 'last 7 days'],
    ['MATCHES CAUGHT', pct(m.accuracy), `${m.rounds} rounds`],
    ['DAY STREAK', m.streak, m.minutes >= 60
      ? `${Math.round(m.minutes / 60)} h trained` : `${m.minutes} min trained`],
  ];
  $('#stat-tiles').innerHTML = items.map(([label, value, sub]) => `
    <div class="tile">
      <span class="tile-value">${value}</span>
      <span class="tile-label">${label}</span>
      <span class="tile-sub">${sub}</span>
    </div>`).join('');
}

/* ── the original's chart: average N per day, with its trend ─ */
function averageChart(rows) {
  const data = rows.slice(-MAX_DAYS);
  const first = rows.length - data.length + 1;
  const yMax = Math.max(12, Math.ceil(Math.max(...data.map((d) => d.avgN)) + 1));
  const yMin = 1;
  const x = (i) => PAD.l + (data.length === 1 ? (W - PAD.l - PAD.r) / 2
    : (i / (data.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  let grid = '';
  for (let v = yMin; v <= yMax; v++) {
    const yy = y(v).toFixed(1);
    grid += `<line x1="${PAD.l}" y1="${yy}" x2="${W - PAD.r}" y2="${yy}" ` +
            `stroke="rgba(255,255,255,.26)" stroke-width=".7"/>` +
            `<text x="${PAD.l - 6}" y="${(+yy + 4).toFixed(1)}" text-anchor="end" ` +
            `fill="#fff" font-size="10">${v}</text>`;
  }

  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.avgN).toFixed(1)}`).join(' ');
  const line = data.length === 1
    ? `<circle cx="${x(0).toFixed(1)}" cy="${y(data[0].avgN).toFixed(1)}" r="4.5" fill="#fff"/>`
    : `<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="3.2" ` +
      `stroke-linejoin="round" stroke-linecap="round"/>`;

  // The trend is dashed as well as coloured, so it never relies on red-on-teal
  // alone to read as the second series.
  let trend = '';
  if (data.length > 1) {
    const n = data.length;
    const sx = data.reduce((s, _, i) => s + i, 0);
    const sy = data.reduce((s, d) => s + d.avgN, 0);
    const sxy = data.reduce((s, d, i) => s + i * d.avgN, 0);
    const sxx = data.reduce((s, _, i) => s + i * i, 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
    const intercept = (sy - slope * sx) / n;
    const clamp = (v) => Math.min(yMax, Math.max(yMin, v));
    trend = `<line x1="${x(0).toFixed(1)}" y1="${y(clamp(intercept)).toFixed(1)}" ` +
            `x2="${x(n - 1).toFixed(1)}" y2="${y(clamp(intercept + slope * (n - 1))).toFixed(1)}" ` +
            `stroke="#e05a52" stroke-width="3" stroke-linecap="round" stroke-dasharray="9 7"/>`;
  }

  const dots = data.map((d, i) =>
    `<circle class="mark" cx="${x(i).toFixed(1)}" cy="${y(d.avgN).toFixed(1)}" r="8"
             fill="transparent" data-tip="Day ${first + i} · average N ${one(d.avgN)} · ${d.rounds} rounds"/>`
    + `<circle cx="${x(i).toFixed(1)}" cy="${y(d.avgN).toFixed(1)}" r="${data.length > 14 ? 0 : 3}"
             fill="#fff" stroke="#0d8375" stroke-width="2"/>`).join('');

  const labels =
    `<text x="${PAD.l}" y="${H - 8}" fill="#fff" font-size="11">DAY ${first}</text>` +
    (data.length > 1
      ? `<text x="${W - PAD.r}" y="${H - 8}" text-anchor="end" fill="#fff" font-size="11">` +
        `DAY ${rows.length}</text>` : '');

  $('#chart-card').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}">${grid}${trend}${line}${dots}${labels}</svg>` +
    `<div class="chart-legend">
       <span><i class="swatch solid"></i>AVERAGE N</span>
       <span><i class="swatch dashed"></i>TREND</span>
     </div>`;
}

/* ── rounds a day, against the recommended twenty ─────────── */
function roundsChart(rows, m) {
  const data = rows.slice(-14);
  const top = Math.max(GOAL, ...data.map((d) => d.rounds));
  const bw = 100 / (data.length * 1.55 + 0.55);        // % of the plot width
  const gap = bw * 0.55;
  const y = (v) => 100 - (v / top) * 100;

  const bars = data.map((d, i) => {
    const left = gap + i * (bw + gap);
    const h = Math.max((d.rounds / top) * 100, d.rounds ? 1.5 : 0);
    return `<div class="day-slot" style="left:${left}%;width:${bw}%">
              <div class="day-bar ${d.rounds >= GOAL ? 'full' : ''}" style="height:${h}%"
                   data-tip="${d.day.slice(5)} · ${d.rounds} rounds · average N ${one(d.avgN)}"></div>
            </div>`;
  }).join('');

  $('#rounds-panel').innerHTML = `
    <h3 class="panel-h">ROUNDS A DAY</h3>
    <p class="panel-sub">${m.rounds} rounds over ${m.days} day${m.days === 1 ? '' : 's'} ·
      ${one(m.roundsPerDay7)} a day this week</p>
    <div class="day-bars">
      <div class="day-goal" style="bottom:${(100 - y(GOAL)).toFixed(1)}%"><span>${GOAL}</span></div>
      ${bars}
    </div>
    <p class="panel-foot">${data.length === 1 ? 'today' : `last ${data.length} days`}</p>`;
}

/* ── which sense is losing you the level ──────────────────── */
function senses(m) {
  const row = (name, icon, value, missed) => `
    <div class="meter-row">
      <span class="meter-ic">${icons[icon]()}</span>
      <div class="meter"><div class="meter-fill" style="width:${(value * 100).toFixed(1)}%"></div></div>
      <span class="meter-value">${pct(value)}</span>
      <span class="meter-sub">${one(missed)} missed a round</span>
    </div>`;
  $('#senses-panel').innerHTML = `
    <h3 class="panel-h">MATCHES CAUGHT</h3>
    ${row('eye', 'eyeScore', m.eyeAccuracy, m.eyeMissPerRound)}
    ${row('ear', 'earScore', m.earAccuracy, m.earMissPerRound)}
    <p class="panel-foot">${one(m.falsePerRound)} presses a round with no match behind them</p>`;
}

/* ── the sentences ───────────────────────────────────────── */
function insights(m) {
  const out = [];
  const delta = m.avg7 - m.avgPrev7;
  if (m.avgPrev7 && Math.abs(delta) >= 0.15) {
    out.push(`Your average N is ${delta > 0 ? 'up' : 'down'} ${one(Math.abs(delta))} ` +
             `on the week before.`);
  } else if (m.days > 1) {
    out.push(`Your average N is holding around ${one(m.avg7)}.`);
  }

  const gap = m.eyeAccuracy - m.earAccuracy;
  if (Math.abs(gap) >= 0.08) {
    const weak = gap > 0 ? 'letter sounds' : 'square positions';
    out.push(`You catch ${pct(Math.abs(gap))} fewer ${weak} than the other sense — ` +
             `that gap is what holds N down.`);
  }

  if (m.falsePerRound >= 2) {
    out.push(`You press without a match ${one(m.falsePerRound)} times a round. ` +
             `Three in one sense is enough to stop N going up.`);
  }

  if (m.roundsPerDay7 < GOAL) {
    out.push(`The recommendation is 20 rounds, 4–5 days a week. ` +
             `You are averaging ${one(m.roundsPerDay7)} a day.`);
  } else if (m.streak >= 3) {
    out.push(`${m.streak} days in a row at or above the recommended twenty rounds.`);
  }

  $('#insights').innerHTML = out.slice(0, 4).map((t) => `<li>${t}</li>`).join('');
}

/* ── a shared tooltip for every mark on the screen ────────── */
function wireTips(root) {
  let tip = root.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    root.appendChild(tip);
  }
  const show = (el) => {
    const text = el.dataset.tip;
    if (!text) return;
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const half = tip.offsetWidth / 2 + 6;          // keep it inside the card
    tip.style.left = `${Math.min(Math.max(r.left - box.left + r.width / 2, half),
      Math.max(half, box.width - half))}px`;
    const above = r.top - box.top - 10;
    tip.classList.toggle('below', above < tip.offsetHeight + 4);
    tip.style.top = `${above < tip.offsetHeight + 4 ? r.bottom - box.top + 10 : above}px`;
  };
  root.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('pointerenter', () => show(el));
    el.addEventListener('pointerdown', () => show(el));
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
  });
  root.addEventListener('pointerleave', () => { tip.hidden = true; }, { once: true });
}

export function renderChart() {
  const m = store.metrics();
  const body = $('#screen-stats .body');
  const empty = $('#stats-empty');
  const panels = ['#stat-tiles', '#chart-card', '#rounds-panel', '#senses-panel', '#insights'];

  if (!m) {
    panels.forEach((s) => { $(s).hidden = true; });
    empty.hidden = false;
    return;
  }
  panels.forEach((s) => { $(s).hidden = false; });
  empty.hidden = true;

  tiles(m);
  averageChart(m.rows);
  roundsChart(m.rows, m);
  senses(m);
  insights(m);
  wireTips(body);
}
