/* =========================================================
   NOVARA — motion module (lazy-loaded chunk)
   Scroll-reveal + animated number counters. Imported via dynamic
   import() only when the browser is idle and reduced motion is off.
   ========================================================= */

/** Reveal elements as they enter the viewport, with a subtle stagger. */
function initReveal(): void {
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!items.length) return;

  const io = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const siblings = Array.from(el.parentElement?.children ?? []).filter((c) =>
          c.hasAttribute('data-reveal')
        );
        const idx = Math.max(0, siblings.indexOf(el));
        el.style.setProperty('--reveal-delay', `${Math.min(idx, 6) * 0.07}s`);
        el.classList.add('is-visible');
        observer.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
  );

  items.forEach((el) => io.observe(el));
}

/** Count up numbers when the stats section scrolls into view. */
function initCounters(): void {
  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  if (!counters.length) return;

  const animate = (el: HTMLElement) => {
    const target = parseFloat(el.dataset.count ?? '0') || 0;
    const suffix = el.dataset.suffix ?? '';
    const duration = 1200;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => io.observe(el));
}

export function init(): void {
  initReveal();
  initCounters();
}
