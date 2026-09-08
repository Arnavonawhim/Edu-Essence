// header background on scroll
  const header = document.getElementById('site-header');
  const onScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('bg-cream/90', 'backdrop-blur-md', 'shadow-[0_1px_0_rgba(31,36,33,0.08)]');
    } else {
      header.classList.remove('bg-cream/90', 'backdrop-blur-md', 'shadow-[0_1px_0_rgba(31,36,33,0.08)]');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // mobile menu
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');
  menuBtn.addEventListener('click', () => {
    const isOpen = !mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden');
    iconOpen.classList.toggle('hidden');
    iconClose.classList.toggle('hidden');
    menuBtn.setAttribute('aria-expanded', String(!isOpen));
  });
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
    iconOpen.classList.remove('hidden');
    iconClose.classList.add('hidden');
  }));

  // hero entrance reveal
  document.querySelectorAll('[data-reveal]').forEach((el, i) => {
    requestAnimationFrame(() => setTimeout(() => el.classList.add('in'), 80 + i * 90));
  });

  // dialect chip selection
  document.querySelectorAll('[data-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-chip]').forEach(c => {
        c.classList.remove('bg-beam', 'text-slate');
        c.classList.add('border', 'border-beam/30');
      });
      chip.classList.add('bg-beam', 'text-slate');
      chip.classList.remove('border', 'border-beam/30');
    });
  });

  // online/offline mode switch
  const toggle = document.getElementById('mode-toggle');
  const dot = document.getElementById('switch-dot');
  const track = document.getElementById('switch-track');
  let online = false;
  toggle.addEventListener('click', () => {
    online = !online;
    toggle.setAttribute('aria-pressed', String(online));
    dot.style.transform = online ? 'translateX(20px)' : 'translateX(0)';
    track.style.backgroundColor = online ? '#1F2421' : 'rgba(255,248,211,0.2)';
    track.style.boxShadow = online ? 'inset 0 0 0 1px rgba(255,248,211,0.4)' : 'none';
  });