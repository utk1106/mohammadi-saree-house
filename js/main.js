document.addEventListener('DOMContentLoaded', () => {
  const intro = document.getElementById('intro');
  if (!intro) return;

  const tiles = intro.querySelectorAll('.intro__tile');
  tiles.forEach((tile, i) => tile.style.setProperty('--i', i));

  const alreadyPlayed = sessionStorage.getItem('mshIntroPlayed') === '1';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (alreadyPlayed) {
    intro.classList.add('intro--hidden');
    intro.setAttribute('hidden', '');
    return;
  }

  document.body.classList.add('intro-active');

  const tileCount = tiles.length;
  const lastTileDelay = (tileCount - 1) * 90; // ms, matches --i stagger in CSS
  const tileAnimDuration = 750; // ms, matches .intro__tile animation duration
  const brandDelay = 950;
  const brandDuration = 800;
  const holdAfter = prefersReducedMotion ? 0 : 500;

  const exitAt = prefersReducedMotion
    ? 0
    : Math.max(lastTileDelay + tileAnimDuration, brandDelay + brandDuration) + holdAfter;

  const exitTransitionMs = prefersReducedMotion ? 300 : 700;

  setTimeout(() => {
    intro.classList.add('intro--exit');
    setTimeout(() => {
      intro.classList.add('intro--hidden');
      document.body.classList.remove('intro-active');
      sessionStorage.setItem('mshIntroPlayed', '1');
      setTimeout(() => intro.setAttribute('hidden', ''), 50);
    }, exitTransitionMs);
  }, exitAt);
});

// Interactive 3D tilt on product cards — pointer-driven, desktop/trackpad only
// (real touch devices don't have hover, so we leave their tap/scale behavior as-is)
document.addEventListener('DOMContentLoaded', () => {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canHover || prefersReducedMotion) return;

  const maxTilt = 10; // degrees

  document.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 2 * maxTilt;
      const rotateX = (0.5 - y) * 2 * maxTilt;
      card.classList.add('is-tilting');
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
    });

    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-tilting');
      card.style.transform = '';
    });
  });
});

// Scroll-spy — highlight the nav link for whichever section is currently in view
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
  if (!navLinks.length) return;

  const sections = Array.from(navLinks)
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const setActive = (id) => {
    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  sections.forEach((section) => observer.observe(section));
});

// Nav grows wider with scroll — links reveal progressively, fully expanded by
// EXPAND_DISTANCE px of scroll. Desktop only; mobile nav links stay hidden
// (no menu built for them yet).
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelector('.nav__links');
  if (!navLinks) return;

  const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const EXPAND_DISTANCE = 450; // px of scroll to reach fully expanded

  const measureNaturalWidth = () => {
    const prevMaxWidth = navLinks.style.maxWidth;
    navLinks.style.maxWidth = 'none';
    const width = navLinks.scrollWidth;
    navLinks.style.maxWidth = prevMaxWidth;
    return width;
  };

  let linksMaxWidth = measureNaturalWidth();
  let ticking = false;

  const render = () => {
    ticking = false;
    if (!isDesktop()) {
      navLinks.style.maxWidth = '';
      navLinks.style.opacity = '';
      return;
    }
    const progress = Math.min(window.scrollY / EXPAND_DISTANCE, 1);
    navLinks.style.maxWidth = `${progress * linksMaxWidth}px`;
    navLinks.style.opacity = progress.toFixed(2);
  };

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(render);
      ticking = true;
    }
  };

  const onResize = () => {
    linksMaxWidth = measureNaturalWidth();
    onScroll();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  render();
});
