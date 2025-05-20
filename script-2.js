
setTimeout(() => {
  const intro = document.getElementById('gifIntro');
  intro.classList.add('fade-out');
  setTimeout(() => {
    intro.style.display = 'none';
  }, 2000);
}, 10000);
