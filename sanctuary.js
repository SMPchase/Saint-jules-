let wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#f7e97f33',
  progressColor: '#f7e97f',
  barWidth: 2,
  height: 80,
  responsive: true
});

wavesurfer.load('https://raw.githubusercontent.com/SMPchase/Saint-jules-/main/Ouroboros.mp3');

// UI Elements
const playBtn = document.getElementById('play-btn');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const volumeSlider = document.getElementById('volume');
const progressBar = document.getElementById('progress');

// Play/Pause toggle
playBtn.addEventListener('click', () => {
  wavesurfer.playPause();
  playBtn.textContent = wavesurfer.isPlaying() ? 'Pause' : 'Play';
});

// Volume control
volumeSlider.addEventListener('input', () => {
  wavesurfer.setVolume(volumeSlider.value);
});

// Update time display
wavesurfer.on('ready', () => {
  totalTimeEl.textContent = formatTime(wavesurfer.getDuration());
  progressBar.max = Math.floor(wavesurfer.getDuration());
});

wavesurfer.on('audioprocess', () => {
  const time = wavesurfer.getCurrentTime();
  currentTimeEl.textContent = formatTime(time);
  progressBar.value = time;
});

wavesurfer.on('seek', (progress) => {
  const duration = wavesurfer.getDuration();
  progressBar.value = progress * duration;
});

progressBar.addEventListener('input', () => {
  wavesurfer.seekTo(progressBar.value / wavesurfer.getDuration());
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
