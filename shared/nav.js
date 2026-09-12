(function(){
  var b=document.querySelector('.menu-btn'),n=document.querySelector('nav.main');
  if(b&&n){
    b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false');});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&n.classList.contains('open')){n.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus();}});
  }
  var modes=document.querySelectorAll('.modes button');
  modes.forEach(function(m){m.addEventListener('click',function(){
    modes.forEach(function(x){x.setAttribute('aria-pressed',x===m?'true':'false');});
    document.querySelectorAll('[data-mode]').forEach(function(p){p.hidden=p.getAttribute('data-mode')!==m.getAttribute('data-target');});
  });});
})();
