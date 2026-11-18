/* Small helpers shared by the 3D scenes. */
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const finePointer = window.matchMedia('(pointer: fine)');

export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ground: v('--ground', '#0e1626'),
    panel: v('--panel', '#142036'),
    panel2: v('--panel-2', '#1a2943'),
    line: v('--line-strong', '#344a6e'),
    node: v('--ink-faint', '#7d8ca4'),
    ink: v('--ink', '#e8edf4'),
    muted: v('--ink-muted', '#9fadc2'),
    charge: v('--charge', '#f5a524'),
    full: v('--full', '#3dd6b0'),
    danger: v('--danger', '#ff7a6b')
  };
}

export function onThemeChange(fn) {
  document.addEventListener('themechange', fn);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', fn);
}

export function watchVisibility(el, fn) {
  if (!('IntersectionObserver' in window)) return fn(true);
  new IntersectionObserver((entries) => fn(entries[0].isIntersecting)).observe(el);
}

/* Let the page paint its text first, then build the scene. */
export function afterFirstPaint(fn) {
  const go = () => requestAnimationFrame(() => setTimeout(fn, 0));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
