/* Shared behaviour: theme toggle, mobile drawer, sticky-nav rule.
   The page is complete without this file; nothing here reveals content. */
(function () {
  'use strict';

  /* --- Mobile drawer ---------------------------------------------------- */
  var drawer = document.querySelector('.drawer');
  var openBtn = document.querySelector('[data-drawer-open]');
  var closeBtn = document.querySelector('[data-drawer-close]');

  function setDrawer(open) {
    if (!drawer) return;
    drawer.setAttribute('data-open', String(open));
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open && closeBtn) closeBtn.focus();
    else if (!open && openBtn) openBtn.focus();
  }

  if (openBtn) openBtn.addEventListener('click', function () { setDrawer(true); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
  if (drawer) {
    Array.prototype.forEach.call(drawer.querySelectorAll('a'), function (link) {
      link.addEventListener('click', function () { setDrawer(false); });
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.getAttribute('data-open') === 'true') {
      setDrawer(false);
    }
  });

  /* --- Theme ------------------------------------------------------------ */
  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var root = document.documentElement;
      var current = root.getAttribute('data-theme');
      if (!current) {
        current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      toggle.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      try { localStorage.setItem('theme', next); } catch (err) { /* storage unavailable */ }
    });
  }

  /* --- Hairline under the nav once the page moves ----------------------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var mark = function () { nav.setAttribute('data-scrolled', String(window.scrollY > 6)); };
    mark();
    window.addEventListener('scroll', mark, { passive: true });
  }
})();
