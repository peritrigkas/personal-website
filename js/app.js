// hamburger menu toggle
  const burgerBtn = document.getElementById('burgerBtn');
  const navlinks = document.getElementById('navlinks');
  burgerBtn.addEventListener('click', ()=>{
    const open = navlinks.classList.toggle('open');
    burgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    burgerBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  navlinks.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', ()=>{
      navlinks.classList.remove('open');
      burgerBtn.setAttribute('aria-expanded', 'false');
      burgerBtn.setAttribute('aria-label', 'Open menu');
    });
  });

  // reveal timeline items as they scroll into view
  const items = document.querySelectorAll('.tl-item');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in'); }
    });
  }, { threshold:0.25 });
  items.forEach(i=>io.observe(i));
