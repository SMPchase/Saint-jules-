
document.addEventListener('DOMContentLoaded', () => {
  const intro = document.getElementById('gifIntro');

  setTimeout(() => {
    intro.classList.add('fade-out');
    setTimeout(() => {
      intro.style.display = 'none';
    }, 2000); // match the transition fade duration
  }, 8500); // wait for GIF display duration (10 seconds)
});
