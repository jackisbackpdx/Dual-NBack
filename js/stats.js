/* Statistics: average N per day, plus its least-squares trend. */

import { store } from './store.js';
import { $ } from './ui.js';

const W = 340, H = 250;
const PAD = { l: 30, r: 14, t: 14, b: 26 };

export function renderChart() {
  const card = $('#chart-card');
  const empty = $('#stats-empty');
  const data = store.series();

  if (!data.length) {
    card.hidden = true;
    empty.hidden = false;
    return;
  }
  card.hidden = false;
  empty.hidden = true;

  const yMax = Math.max(12, Math.ceil(Math.max(...data.map((d) => d.avgN)) + 1));
  const yMin = 1;
  const x = (i) => PAD.l + (data.length === 1 ? (W - PAD.l - PAD.r) / 2
                                              : (i / (data.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  let grid = '';
  for (let v = yMin; v <= yMax; v++) {
    const yy = y(v).toFixed(1);
    grid += `<line x1="${PAD.l}" y1="${yy}" x2="${W - PAD.r}" y2="${yy}" ` +
            `stroke="rgba(255,255,255,.28)" stroke-width=".7"/>` +
            `<text x="${PAD.l - 6}" y="${(+yy + 4).toFixed(1)}" text-anchor="end" ` +
            `fill="#fff" font-size="10">${v}</text>`;
  }

  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.avgN).toFixed(1)}`).join(' ');
  const avgLine = data.length === 1
    ? `<circle cx="${x(0).toFixed(1)}" cy="${y(data[0].avgN).toFixed(1)}" r="4" fill="#fff"/>`
    : `<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="3.2" ` +
      `stroke-linejoin="round" stroke-linecap="round"/>`;

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
            `stroke="#c62828" stroke-width="3" stroke-linecap="round"/>`;
  }

  const labels =
    `<text x="${PAD.l}" y="${H - 8}" fill="#fff" font-size="11" letter-spacing=".5">DAY 1</text>` +
    (data.length > 1
      ? `<text x="${W - PAD.r}" y="${H - 8}" text-anchor="end" fill="#fff" font-size="11" ` +
        `letter-spacing=".5">DAY ${data.length}</text>`
      : '');

  card.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}">${grid}${trend}${avgLine}${labels}</svg>` +
    `<div class="chart-legend"><span class="avg">— AVERAGE N</span>` +
    `<span class="trend">— TREND</span></div>`;
}
