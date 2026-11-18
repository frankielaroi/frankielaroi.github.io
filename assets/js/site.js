/* Shared behaviour: theme, nav state, command palette, scroll story,
   project-row spotlight. Every page is complete without this file. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --- Theme ------------------------------------------------------------ */
  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function setTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    var btn = document.querySelector('.theme-toggle');
    if (btn) btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  function toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  var themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) {
    themeBtn.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeBtn.addEventListener('click', toggleTheme);
  }

  /* --- Toast ------------------------------------------------------------ */
  var toastEl;
  var toastTimer;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.setAttribute('data-show', 'false'); }, 2200);
  }

  /* --- Nav: hairline once scrolled, battery fallback -------------------- */
  var nav = document.querySelector('.nav');
  var fill = document.querySelector('.cell__fill');
  var cssScrollTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');

  function onScroll() {
    if (nav) nav.setAttribute('data-scrolled', String(window.scrollY > 6));
    if (fill && !cssScrollTimeline) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 1;
      fill.style.setProperty('--soc', String(0.12 + p * 0.88));
    }
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* --- Command palette -------------------------------------------------- */
  var EMAIL = 'frankiekweku@gmail.com';

  function go(url) {
    return function () { window.location.href = url; };
  }

  function open(url) {
    return function () { window.open(url, '_blank', 'noopener'); };
  }

  var actions = [
    { group: 'Pages', label: 'Home', hint: '/', run: go('/') },
    { group: 'Pages', label: 'About and experience', hint: '/about', run: go('/about/') },
    { group: 'Pages', label: 'Projects', hint: '/projects', run: go('/projects/') },
    { group: 'Pages', label: 'Contact', hint: '/contact', run: go('/contact/') },
    { group: 'Work', label: 'Kofa Technologies: what I ship', hint: 'now', run: go('/#kofa'), keys: 'battery swap clean energy current job' },
    { group: 'Work', label: 'PharmaSysGH', hint: 'project', run: go('/projects/#pharmasysgh'), keys: 'pharmacy saas pos' },
    { group: 'Work', label: 'CyberDefend 360', hint: 'project', run: go('/projects/#cyberdefend'), keys: 'security phishing' },
    { group: 'Work', label: 'FinWatch', hint: 'project', run: go('/projects/#finwatch'), keys: 'aml fraud ml xgboost' },
    { group: 'Work', label: 'TokenLink Africa', hint: 'project', run: go('/projects/#tokenlink'), keys: 'tokenization fintech' },
    { group: 'Work', label: 'Skills', hint: 'stack', run: go('/about/#skills'), keys: 'react next typescript node flutter' },
    {
      group: 'Do', label: 'Copy email address', hint: EMAIL, keys: 'mail contact',
      run: function () {
        var done = function () { toast('Email copied'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(EMAIL).then(done, function () { window.location.href = 'mailto:' + EMAIL; });
        } else {
          window.location.href = 'mailto:' + EMAIL;
        }
      }
    },
    { group: 'Do', label: 'Book a call', hint: '30 min', run: open('https://appt.link/meet-with-frank-ntim-tetteh-UjyAqSXd'), keys: 'meeting calendar' },
    { group: 'Do', label: 'Switch theme', hint: 'light / dark', run: toggleTheme, keys: 'dark light mode' },
    { group: 'Elsewhere', label: 'GitHub', hint: 'frankielaroi', run: open('https://github.com/frankielaroi') },
    { group: 'Elsewhere', label: 'LinkedIn', hint: 'frank-tetteh', run: open('https://linkedin.com/in/frank-tetteh-a64900259') }
  ];

  var dialog = document.getElementById('palette');
  var input = dialog && dialog.querySelector('.palette__input');
  var list = dialog && dialog.querySelector('.palette__list');
  var visible = [];
  var active = 0;
  var lastFocus = null;

  function render() {
    var q = input.value.trim().toLowerCase();
    visible = actions.filter(function (a) {
      if (!q) return true;
      return (a.label + ' ' + a.group + ' ' + (a.keys || '') + ' ' + a.hint).toLowerCase().indexOf(q) !== -1;
    });
    if (active >= visible.length) active = 0;

    list.innerHTML = '';
    if (!visible.length) {
      var empty = document.createElement('p');
      empty.className = 'palette__empty';
      empty.textContent = 'Nothing matches "' + input.value.trim() + '". Try a page, a project or "email".';
      list.appendChild(empty);
      input.removeAttribute('aria-activedescendant');
      return;
    }

    var group = null;
    visible.forEach(function (a, i) {
      if (a.group !== group) {
        group = a.group;
        var g = document.createElement('div');
        g.className = 'palette__group';
        g.setAttribute('role', 'presentation');
        g.textContent = group;
        list.appendChild(g);
      }
      var item = document.createElement('div');
      item.className = 'palette__item';
      item.id = 'pal-' + i;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(i === active));
      item.innerHTML = '<span></span><span class="palette__hint"></span>';
      item.firstChild.textContent = a.label;
      item.lastChild.textContent = a.hint;
      item.addEventListener('mousemove', function () {
        if (active !== i) { active = i; mark(); }
      });
      item.addEventListener('click', function () { runAt(i); });
      list.appendChild(item);
    });
    mark();
  }

  function mark() {
    Array.prototype.forEach.call(list.querySelectorAll('.palette__item'), function (el, i) {
      el.setAttribute('aria-selected', String(i === active));
    });
    var cur = document.getElementById('pal-' + active);
    if (cur) {
      input.setAttribute('aria-activedescendant', cur.id);
      cur.scrollIntoView({ block: 'nearest' });
    }
  }

  function runAt(i) {
    var a = visible[i];
    if (!a) return;
    closePalette();
    a.run();
  }

  function openPalette() {
    if (!dialog || dialog.open) return;
    lastFocus = document.activeElement;
    input.value = '';
    active = 0;
    render();
    dialog.showModal();
    input.focus();
  }

  function closePalette() {
    if (dialog && dialog.open) dialog.close();
  }

  if (dialog) {
    dialog.addEventListener('close', function () {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) closePalette();
    });
    input.addEventListener('input', function () { active = 0; render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = (active + 1) % Math.max(visible.length, 1);
        mark();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active - 1 + visible.length) % Math.max(visible.length, 1);
        mark();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runAt(active);
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-palette-open]'), function (btn) {
      btn.addEventListener('click', openPalette);
    });

    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (dialog.open) closePalette(); else openPalette();
      } else if (e.key === '/' && !typing && !dialog.open) {
        e.preventDefault();
        openPalette();
      }
    });

    var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    Array.prototype.forEach.call(document.querySelectorAll('[data-mod-key]'), function (k) {
      k.textContent = isMac ? '⌘K' : 'Ctrl K';
    });
  }

  /* --- Scroll story: which step is in the middle of the screen --------- */
  var figure = document.querySelector('.story__figure');
  var steps = document.querySelectorAll('.step');
  var stepLabel = document.querySelector('[data-step-label]');
  if (figure && steps.length && 'IntersectionObserver' in window) {
    var setStep = function (i) {
      figure.setAttribute('data-step', String(i));
      Array.prototype.forEach.call(steps, function (s, j) {
        s.setAttribute('data-active', String(i === j));
      });
      if (stepLabel) stepLabel.textContent = steps[i].getAttribute('data-label') || '';
    };
    setStep(0);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          setStep(Array.prototype.indexOf.call(steps, entry.target));
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    Array.prototype.forEach.call(steps, function (s) { io.observe(s); });
  }

  /* --- Project rows: light follows the pointer ------------------------- */
  if (window.matchMedia('(pointer: fine)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.index__row'), function (row) {
      row.addEventListener('pointermove', function (e) {
        var r = row.getBoundingClientRect();
        row.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        row.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* If the 3D modules never start (CDN blocked, offline), drop the 3D layout. */
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (!window.__views3d) root.classList.remove('has-3d');
    }, 5000);
  });

  window.__site = { reduceMotion: reduceMotion, currentTheme: currentTheme };
})();
