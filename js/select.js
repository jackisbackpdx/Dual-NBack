/* A dropdown modelled on the iOS menu, used in place of every native <select>.
 *
 * The native element stays in the DOM, hidden, holding the value — so anything
 * reading `select.value` or listening for `change` keeps working, and the page
 * degrades to a real form control if this script never runs. The menu is
 * appended to the app root rather than the body, so it is clipped by the app's
 * own rounded frame on desktop, and it is measured before it is placed so it
 * can flip above the trigger when there is no room below it.
 */

import { icons } from './icons.js';

const GAP = 6;      // trigger -> menu
const EDGE = 10;    // menu -> app edge

let openMenu = null;

function closeOpen(restoreFocus = false) {
  if (openMenu) openMenu.close(restoreFocus);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openMenu) { e.stopPropagation(); closeOpen(true); }
}, true);

window.addEventListener('resize', () => closeOpen());

export function enhanceSelect(select, root = document.getElementById('app')) {
  if (!select || select.dataset.enhanced) return;
  select.dataset.enhanced = '1';
  select.classList.add('native-select');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const wrap = document.createElement('div');
  wrap.className = 'select';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const labelledBy = select.getAttribute('aria-labelledby');
  if (labelledBy) trigger.setAttribute('aria-labelledby', labelledBy);
  trigger.innerHTML = '<span class="select-value"></span><span class="select-chevron"></span>';
  wrap.appendChild(trigger);

  const value = trigger.querySelector('.select-value');
  const paint = () => {
    const opt = select.options[select.selectedIndex];
    value.textContent = opt ? opt.textContent : '';
  };
  paint();
  select.addEventListener('change', paint);

  let menu = null;
  let scrim = null;
  let active = -1;

  function commit(index) {
    if (index < 0 || index >= select.options.length) return;
    if (select.selectedIndex !== index) {
      select.selectedIndex = index;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    paint();
  }

  function setActive(next, highlight = true) {
    const items = [...menu.querySelectorAll('[role="option"]')];
    if (!items.length) return;
    active = (next + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', highlight && i === active));
    items[active].scrollIntoView({ block: 'nearest' });
    menu.setAttribute('aria-activedescendant', items[active].id);
  }

  function place() {
    const appRect = root.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    const limit = appRect.height - EDGE * 2;
    menu.style.maxHeight = limit + 'px';
    const h = Math.min(menu.offsetHeight, limit);

    const below = appRect.bottom - t.bottom - GAP - EDGE;
    const above = t.top - appRect.top - GAP - EDGE;
    const flip = h > below && above > below;

    let top = flip ? t.top - appRect.top - GAP - h : t.bottom - appRect.top + GAP;
    top = Math.min(Math.max(top, EDGE), Math.max(EDGE, appRect.height - EDGE - h));

    menu.style.width = Math.round(t.width) + 'px';
    menu.style.left = Math.round(Math.max(EDGE, Math.min(t.left - appRect.left,
      appRect.width - EDGE - t.width))) + 'px';
    menu.style.top = Math.round(top) + 'px';
    menu.style.transformOrigin = flip ? 'bottom center' : 'top center';
  }

  function open() {
    if (openMenu) closeOpen();

    scrim = document.createElement('div');
    scrim.className = 'select-scrim';
    scrim.addEventListener('pointerdown', (e) => { e.preventDefault(); close(true); });

    menu = document.createElement('div');
    menu.className = 'select-menu';
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;
    menu.innerHTML = [...select.options].map((opt, i) => `
      <button type="button" role="option" id="${select.id || 'sel'}-opt-${i}"
              aria-selected="${i === select.selectedIndex}" data-i="${i}">
        <span class="select-opt-label">${opt.textContent}</span>
        <span class="select-opt-check">${icons.check()}</span>
      </button>`).join('');

    root.appendChild(scrim);
    root.appendChild(menu);
    place();
    requestAnimationFrame(() => menu.classList.add('open'));

    menu.querySelectorAll('[role="option"]').forEach((el) => {
      el.addEventListener('click', () => { commit(+el.dataset.i); close(true); });
      el.addEventListener('pointerenter', () => setActive(+el.dataset.i));
    });

    menu.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowUp: -1 };
      if (e.key in keys) { e.preventDefault(); setActive(active + keys[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(select.options.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(active); close(true); }
    });

    trigger.setAttribute('aria-expanded', 'true');
    openMenu = { close };
    menu.focus();
    setActive(Math.max(select.selectedIndex, 0), false);
  }

  function close(restoreFocus = false) {
    if (!menu) return;
    const dying = menu;
    const dyingScrim = scrim;
    menu = null;
    scrim = null;
    openMenu = null;
    trigger.setAttribute('aria-expanded', 'false');
    dying.classList.remove('open');
    dyingScrim.classList.add('leaving');
    setTimeout(() => { dying.remove(); dyingScrim.remove(); }, 160);
    if (restoreFocus) trigger.focus();
  }

  trigger.addEventListener('click', () => (menu ? close(true) : open()));
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
  });
}

export function enhanceAllSelects(scope = document) {
  scope.querySelectorAll('select:not([data-enhanced])').forEach((s) => enhanceSelect(s));
}
