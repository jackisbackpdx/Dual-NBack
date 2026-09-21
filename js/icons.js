/* Inline SVG icon set. Everything is drawn with `currentColor`, and the little
   +/- badges punch a hole with `--icon-knockout` so they read on any surface. */

const svg = (vb, inner, extra = '') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false" ${extra}>${inner}</svg>`;

/* An eye drawn as one even-odd path: lens, hole for the white of the eye,
   pupil back on top. Proportions (2.4 : 1 lens, pupil a third of its height)
   come off the original's own icon. */
const eyePath = (cx = 12, white = 3.5, pupil = 1.5) => {
  const ring = (r) => `M${cx + r} 12A${r} ${r} 0 1 0 ${cx - r} 12A${r} ${r} 0 1 0 ${cx + r} 12Z`;
  return 'M1 12C5 6 19 6 23 12C19 18 5 18 1 12Z' + ring(white) + ring(pupil);
};
/* The badged eye keeps its pupil clear of the disc, the way the original's does. */
const EYE_PATH  = eyePath();
const EYE_PATH_B = eyePath(9.2, 3, 1.3);

/* Material's "hearing" glyph — the same stylised ear the original uses. */
const EAR_PATH =
  'M17 20c-.29 0-.56-.06-.76-.15-.71-.37-1.21-.88-1.71-2.38-.51-1.56-1.47-2.29-2.39-3' +
  '-.79-.61-1.61-1.24-2.32-2.53C9.29 10.98 9 9.93 9 8.75c0-2.34 1.95-4.25 4.35-4.25' +
  'S17.7 6.41 17.7 8.75h1.3C19 5.65 16.48 3.2 13.35 3.2S7.7 5.65 7.7 8.75' +
  'c0 1.4.35 2.65 1.04 3.9.8 1.44 1.73 2.16 2.56 2.79.83.64 1.55 1.19 1.95 2.41' +
  '.52 1.56 1.24 2.57 2.32 3.14.4.2.87.31 1.43.31 1.8 0 3.26-1.46 3.26-3.26h-1.3' +
  'c0 1.08-.88 1.96-1.96 1.96z' +
  'M13.35 6.15c-1.44 0-2.61 1.17-2.61 2.61h1.3c0-.72.59-1.31 1.31-1.31s1.31.59 1.31 1.31' +
  'c0 .53-.21.85-.74 1.39-.54.54-1.24 1.24-1.24 2.61h1.3c0-.8.35-1.15.89-1.7' +
  '.54-.54 1.09-1.09 1.09-2.3 0-1.44-1.17-2.61-2.61-2.61z';

/* The little +/- disc, knocked out of whatever it sits on. */
const badge = (cx, cy, sign) => {
  const knock = 'var(--icon-knockout, var(--bg))';
  const bar = `<rect x="${cx - 2.65}" y="${cy - .8}" width="5.3" height="1.6" rx=".8" fill="${knock}"/>`;
  const post = sign === '+'
    ? `<rect x="${cx - .8}" y="${cy - 2.65}" width="1.6" height="5.3" rx=".8" fill="${knock}"/>`
    : '';
  return `<circle cx="${cx}" cy="${cy}" r="5.2" fill="${knock}"/>` +
         `<circle cx="${cx}" cy="${cy}" r="4.4" fill="currentColor"/>${bar}${post}`;
};

/* Tight boxes, so that scaling every score icon to one height reproduces the
   original's sizing: the badged glyphs come out a little narrower, exactly as
   they do in the app. */
const EYE_BOX  = '0.6 7.1 22.8 9.8';
const EYE_BOXB = '0.6 7.1 22.8 12.1';
const EAR_BOX  = '7.2 2.7 13.6 18.3';
const EAR_BOXB = '7.2 2.7 13.9 20.6';
const EYE_BADGE = [17.6, 13.4];
const EAR_BADGE = [14.6, 18];

export const icons = {
  eye:        () => svg('0 0 24 24', `<path fill-rule="evenodd" d="${EYE_PATH}"/>`),
  ear:        () => svg('0 0 24 24', `<path d="${EAR_PATH}"/>`),
  eyeScore:   () => svg(EYE_BOX, `<path fill-rule="evenodd" d="${EYE_PATH}"/>`),
  earScore:   () => svg(EAR_BOX, `<path d="${EAR_PATH}"/>`),
  eyeMinus:   () => svg(EYE_BOXB, `<path fill-rule="evenodd" d="${EYE_PATH_B}"/>${badge(...EYE_BADGE, '-')}`),
  eyePlus:    () => svg(EYE_BOXB, `<path fill-rule="evenodd" d="${EYE_PATH_B}"/>${badge(...EYE_BADGE, '+')}`),
  earMinus:   () => svg(EAR_BOXB, `<path d="${EAR_PATH}"/>${badge(...EAR_BADGE, '-')}`),
  earPlus:    () => svg(EAR_BOXB, `<path d="${EAR_PATH}"/>${badge(...EAR_BADGE, '+')}`),

  menu: () => svg('0 0 24 24',
    '<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
    '<path d="M3.5 7h17M3.5 12h17M3.5 17h17"/></g>', 'fill="none"'),

  back: () => svg('0 0 24 24',
    '<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 12H4M11 5l-7 7 7 7"/></g>', 'fill="none"'),

  chart: () => svg('0 0 24 24',
    '<rect x="3" y="14" width="3.4" height="7" rx=".6"/>' +
    '<rect x="8.4" y="9.5" width="3.4" height="11.5" rx=".6"/>' +
    '<rect x="13.8" y="12" width="3.4" height="9" rx=".6"/>' +
    '<rect x="19.2" y="4" width="3.4" height="17" rx=".6"/>'),

  play: () => svg('0 0 24 24',
    '<path d="M8 4.8 19.4 12 8 19.2Z" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linejoin="round" fill="none"/>'),

  cart: () => svg('0 0 24 24',
    '<g stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" fill="none">' +
    '<path d="M1.5 3h3l2.6 11.2h10.3L21 6.2H6"/>' +
    '<circle cx="9" cy="19" r="1.9"/><circle cx="17.5" cy="19" r="1.9"/></g>'),

  volume: () => svg('0 0 24 24',
    '<path d="M3 9.5h3.6L11 5.4v13.2L6.6 14.5H3z"/>' +
    '<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none">' +
    '<path d="M14.6 9.1a4.1 4.1 0 0 1 0 5.8"/><path d="M17.4 6.3a8 8 0 0 1 0 11.4"/></g>'),

  share: () => svg('0 0 24 24',
    '<g stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" fill="none">' +
    '<path d="M11 4.5H3.5v16h16V13"/><path d="M13 3.2h8v8"/><path d="M11.5 12.7 20.6 3.6"/></g>'),

  gear: () => svg('0 0 24 24',
    '<path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-1.9-3.3-2.4 1a7.6 7.6 0 0 0-1.8-1L15 3.4h-3.8' +
    'l-.35 2.6a7.6 7.6 0 0 0-1.8 1l-2.4-1L4.7 9.4 6.7 11a7.6 7.6 0 0 0 0 2l-2 1.6 1.9 3.3 2.4-1' +
    'a7.6 7.6 0 0 0 1.8 1l.35 2.6H15l.35-2.6a7.6 7.6 0 0 0 1.8-1l2.4 1 1.9-3.3z" ' +
    'stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>' +
    '<circle cx="13.1" cy="12" r="2.9" stroke="currentColor" stroke-width="1.5" fill="none"/>'),

  question: () => svg('0 0 24 24',
    '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" fill="none"/>' +
    '<path d="M9.4 9.3a2.7 2.7 0 1 1 3.4 2.6c-.6.2-.9.7-.9 1.4v.6" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
    '<circle cx="11.9" cy="16.8" r="1.1"/>'),

  grid: () => svg('0 0 24 24',
    '<rect x="3" y="3" width="7.4" height="7.4" rx="1"/>' +
    '<rect x="13.6" y="3" width="7.4" height="7.4" rx="1"/>' +
    '<rect x="3" y="13.6" width="7.4" height="7.4" rx="1"/>' +
    '<rect x="13.6" y="13.6" width="7.4" height="7.4" rx="1"/>'),
};

export function paint(el, name) {
  if (el) el.innerHTML = icons[name]();
}
