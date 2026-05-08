// PageMind custom tooltip — intercepts all native title tooltips
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
    currentTarget = el;
    const t = create();
    t.textContent = text;
    t.classList.remove('visible', 'above', 'below');

    // position: prefer above, fall back to below
    const rect = el.getBoundingClientRect();
    t.style.left = '0';
    t.style.top = '0';
    t.style.visibility = 'hidden';
    t.style.display = 'block';

    const tw = t.offsetWidth;
    const th = t.offsetHeight;

    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));

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
    void t.offsetWidth;
    t.classList.add('visible');
  }

  function hide() {
    clearTimeout(showTimer);
    showTimer = null;
    if (tip) tip.classList.remove('visible');
    currentTarget = null;
  }

  // On first sight of a [title], permanently move it to data-tooltip
  // so the native tooltip never fires — even on rapid hover in/out.
  function ensureDataTooltip(el) {
    if (el.hasAttribute('data-tooltip')) return el;
    const text = el.getAttribute('title');
    if (!text) return null;
    el.setAttribute('data-tooltip', text);
    el.removeAttribute('title');
    return el;
  }

  // Use MutationObserver to catch dynamically added [title] elements
  // and convert them immediately, before the browser can show native tooltip.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'title') {
        const el = m.target;
        if (el.hasAttribute('title') && el.getAttribute('title')) {
          el.setAttribute('data-tooltip', el.getAttribute('title'));
          el.removeAttribute('title');
        }
      }
      if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.hasAttribute('title')) ensureDataTooltip(node);
          node.querySelectorAll?.('[title]').forEach(ensureDataTooltip);
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['title'],
  });

  // Convert all existing [title] on load
  document.querySelectorAll('[title]').forEach(ensureDataTooltip);

  document.addEventListener('pointerenter', function (e) {
    if (!e.target || !e.target.closest) return;
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    // If already showing for same element, skip
    if (currentTarget === el) return;
    hide();
    currentTarget = el;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(el), 380);
  }, true);

  document.addEventListener('pointerleave', function (e) {
    if (!e.target || !e.target.closest) return;
    const leaving = e.target.closest('[data-tooltip]');
    if (leaving && leaving === currentTarget) {
      hide();
    }
  }, true);

  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('wheel', hide, { passive: true, capture: true });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hide();
  }, true);
})();
