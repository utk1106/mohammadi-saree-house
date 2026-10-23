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
  const holdAfter = prefersReducedMotion ? 0 : 500;

  const exitAt = prefersReducedMotion ? 0 : lastTileDelay + tileAnimDuration + holdAfter;

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

// Mobile hamburger menu — toggles the dropdown, closes on link click or outside tap
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  const closeMenu = () => {
    links.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  document.addEventListener('click', (e) => {
    if (!links.classList.contains('is-open')) return;
    if (!links.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });
});

// Collection carousel — auto-advances through the product shelf every few
// seconds; prev/next arrows step manually and reset the autoplay timer.
// The track shows a window of the full card list, swapped in with a quick
// fade rather than sliding (lets mobile show a 2x3 grid, desktop a 1x4 row).
document.addEventListener('DOMContentLoaded', () => {
  const carousel = document.querySelector('.collection__carousel');
  const track = document.getElementById('collectionTrack');
  const prevBtn = document.getElementById('collectionPrev');
  const nextBtn = document.getElementById('collectionNext');
  if (!carousel || !track || !prevBtn || !nextBtn) return;

  const allCards = Array.from(track.children);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AUTOPLAY_MS = 6500;
  const SWAP_FADE_MS = 250;
  const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

  let index = 0;
  let visibleCount = isDesktop() ? 4 : 6;
  let autoplayTimer = null;

  const maxIndex = () => Math.max(allCards.length - visibleCount, 0);

  const render = () => {
    track.classList.add('is-swapping');
    setTimeout(() => {
      track.replaceChildren(...allCards.slice(index, index + visibleCount));
      track.classList.remove('is-swapping');
    }, prefersReducedMotion ? 0 : SWAP_FADE_MS);
  };

  const goNext = () => {
    index = index >= maxIndex() ? 0 : index + 1;
    render();
  };

  const goPrev = () => {
    index = index <= 0 ? maxIndex() : index - 1;
    render();
  };

  const stopAutoplay = () => { clearInterval(autoplayTimer); autoplayTimer = null; };
  const startAutoplay = () => {
    if (prefersReducedMotion) return;
    stopAutoplay();
    autoplayTimer = setInterval(goNext, AUTOPLAY_MS);
  };

  nextBtn.addEventListener('click', () => { goNext(); startAutoplay(); });
  prevBtn.addEventListener('click', () => { goPrev(); startAutoplay(); });

  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);

  window.addEventListener('resize', () => {
    const newVisibleCount = isDesktop() ? 4 : 6;
    if (newVisibleCount === visibleCount) return;
    visibleCount = newVisibleCount;
    index = Math.min(index, maxIndex());
    render();
  });

  track.replaceChildren(...allCards.slice(index, index + visibleCount));
  startAutoplay();

  // Shelf videos only play while their card is actually visible inside the
  // carousel viewport — avoids every video decoding/playing at once off-screen.
  const videos = allCards.map((card) => card.querySelector('video')).filter(Boolean);
  if (videos.length && 'IntersectionObserver' in window) {
    const viewport = document.querySelector('.collection__viewport');
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.play().catch(() => {});
        } else {
          entry.target.pause();
        }
      });
    }, { root: viewport, threshold: 0.6 });
    videos.forEach((video) => videoObserver.observe(video));
  }
});

// Product media lightbox — tap/click a product photo or shelf video to view
// it full-size. Delegated on the document since the carousel swaps card
// nodes in and out.
document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxVideo = document.getElementById('lightboxVideo');
  if (!lightbox || !lightboxImage || !lightboxVideo) return;

  const openImage = (img) => {
    lightboxVideo.hidden = true;
    lightboxVideo.pause();
    lightboxVideo.removeAttribute('src');
    lightboxImage.hidden = false;
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt;
    lightbox.hidden = false;
  };
  const openVideo = (video) => {
    lightboxImage.hidden = true;
    lightboxImage.src = '';
    lightboxVideo.hidden = false;
    lightboxVideo.src = video.currentSrc || video.src;
    lightboxVideo.muted = false;
    lightbox.hidden = false;
    lightboxVideo.play().catch(() => {});
  };
  const close = () => {
    lightbox.hidden = true;
    lightboxImage.src = '';
    lightboxVideo.pause();
    lightboxVideo.removeAttribute('src');
  };

  document.addEventListener('click', (e) => {
    if (!lightbox.hidden && lightbox.contains(e.target) && e.target !== lightboxVideo) { close(); return; }
    const img = e.target.closest('.product-card img');
    if (img) { openImage(img); return; }
    const video = e.target.closest('.product-card video');
    if (video) openVideo(video);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightbox.hidden) close();
  });

  // Long-pressing product media should zoom it, not open the browser's
  // native "save/share" menu (Android Chrome triggers this on long-press).
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.product-card img, .product-card video')) e.preventDefault();
  });
});
