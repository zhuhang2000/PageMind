// PageMind custom tooltip — upgrades all native title tooltips
(function initTooltip() {
  let tip = null;
  let currentTarget = null;
  let showTimer = null;

  function create() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'pm-tooltip';
    document.body.appendChild(tip);
    return tip;
  }

  function show(el) {
    const text = el.getAttribute('data-tooltip');
    if (!text) return;
    const t = create();
    t.textContent = text;
    t.classList.remove('visible', 'above', 'below');

    // position: prefer above, fall back to below
    const rect = el.getBoundingClientRect();
    t.style.left = '0';
    t.style.top = '0';
    t.style.visibility = 'hidden';
    t.style.display = 'block';
    document.body.appendChild(t);

    const tw = t.offsetWidth;
    const th = t.offsetHeight;

    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));

    const arrowEl = t.querySelector('::before') || t;
    const arrowLeft = Math.max(8, Math.min(rect.left + rect.width / 2 - left - 3.5, tw - 16));
    t.style.setProperty('--arrow-left', arrowLeft + 'px');

    let top;
    const gap = 7;
    if (rect.top - th - gap > 4) {
      top = rect.top - th - gap;
      t.classList.add('above');
    } else {
      top = rect.bottom + gap;
      t.classList.add('below');
    }

    t.style.left = left + 'px';
    t.style.top = top + 'px';
    t.style.visibility = '';
    // force reflow for transition
    void t.offsetWidth;
    t.classList.add('visible');
  }

  function hide() {
    clearTimeout(showTimer);
    if (tip) tip.classList.remove('visible');
    if (currentTarget) {
      const text = currentTarget.getAttribute('data-tooltip');
      if (text) {
        currentTarget.setAttribute('title', text);
        currentTarget.removeAttribute('data-tooltip');
      }
      currentTarget = null;
    }
  }

  document.addEventListener('pointerenter', function (e) {
    const el = e.target.closest('[title]');
    if (!el) return;
    const text = el.getAttribute('title');
    if (!text) return;
    // steal title to suppress native tooltip
    el.setAttribute('data-tooltip', text);
    el.removeAttribute('title');
    currentTarget = el;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(el), 380);
  }, true);

  document.addEventListener('pointerleave', function (e) {
    if (currentTarget && (e.target === currentTarget || e.target.closest('[data-tooltip]') === currentTarget)) {
      hide();
    }
  }, true);

  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('wheel', hide, { passive: true, capture: true });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hide();
  }, true);
})();
