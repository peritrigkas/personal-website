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

  // copy-link button in the share row
  document.querySelectorAll('.share-copy').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const url = btn.getAttribute('data-copy-url') || window.location.href;
      try{
        await navigator.clipboard.writeText(url);
      }catch(e){
        const tmp = document.createElement('input');
        tmp.value = url;
        document.body.appendChild(tmp);
        tmp.select();
        try{ document.execCommand('copy'); }catch(_){}
        document.body.removeChild(tmp);
      }
      if(btn.nextElementSibling && btn.nextElementSibling.classList.contains('share-copied-hint')) return;
      btn.classList.add('is-copied');
      const hint = document.createElement('span');
      hint.className = 'share-copied-hint';
      hint.textContent = 'Copied!';
      btn.after(hint);
      setTimeout(()=>{ hint.remove(); btn.classList.remove('is-copied'); }, 1600);
    });
  });
