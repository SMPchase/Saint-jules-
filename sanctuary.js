
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#f7e97f55',
  progressColor: '#f7e97f',
  barWidth: 2,
  height: 80
});

wavesurfer.load('https://raw.githubusercontent.com/SMPchase/Saint-jules-/main/Ouroboros.wav');

const audio = document.getElementById('audio');
audio.addEventListener('play', () => wavesurfer.play());
audio.addEventListener('pause', () => wavesurfer.pause());
