<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>The Sanctuary | Saint Jules</title>

  <!-- Fonts + Theme CSS -->
  <link rel="stylesheet" href="sanctuary-player.css" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Open+Sans&display=swap" rel="stylesheet">
</head>
<body>

  <div class="container">
    <img class="angel" src="https://raw.githubusercontent.com/SMPchase/Saint-jules-/main/Glowing%20Saint%20Jules%20Angel.png" alt="Saint Jules Angel Logo">

    <h1>The Sanctuary</h1>
    <p class="message">
      You’ve crossed the threshold.<br>
      This is where purpose lives and doubt dies.<br><br>
      Stay grounded. Stay guided. Stay chosen.
    </p>

    <!-- Custom Music Player -->
    <div class="audio-block">
      <div id="waveform" class="waveform"></div>
      <div class="controls">
        <button id="play-btn">Play</button>
        <div class="time-display">
          <span id="current-time">0:00</span> / <span id="total-time">0:00</span>
        </div>
        <input type="range" id="progress" min="0" value="0">
        <div class="volume">
          <label for="volume">Vol</label>
          <input type="range" id="volume" min="0" max="1" step="0.01" value="1">
        </div>
      </div>
    </div>

    <!-- About -->
    <div class="about">
      <h3>About Saint Jules</h3>
      <p>Saint Jules is a vessel of sound, story, and spirit. Music is the message—this sanctuary is the echo.</p>
    </div>

    <!-- Social Links -->
    <div class="socials">
      <h3>Connect with Me</h3>
      <a href="https://instagram.com" target="_blank">Instagram</a>
      <a href="https://twitter.com" target="_blank">Twitter/X</a>
      <a href="https://youtube.com" target="_blank">YouTube</a>
    </div>

    <!-- Contact -->
    <div class="contact">
      <h3>Contact</h3>
      <p>Email: saintjules@glasswallrecords.com</p>
    </div>

    <footer>
      &copy; 2025 Saint Jules. A Glasswall Records Presentation.
    </footer>
  </div>

  <!-- Glasswall Logo -->
  <a class="glasswall-logo" href="http://glasswallrecords.com" target="_blank">
    <img src="https://github.com/SMPchase/Dame-Montrel/blob/main/Images%20/glasswalllogo.PNG?raw=true" alt="Glasswall Records Logo" />
  </a>

  <!-- Scripts -->
  <script src="https://unpkg.com/wavesurfer.js"></script>
  <script>
    const wavesurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#ccc',
      progressColor: '#fff',
      height: 80,
      responsive: true,
      barWidth: 2,
      url: "https://raw.githubusercontent.com/SMPchase/Saint-jules-/main/Ouroboros.mp3"
    });

    const playButton = document.getElementById('play-btn');
    const progressBar = document.getElementById('progress');
    const currentTime = document.getElementById('current-time');
    const totalTime = document.getElementById('total-time');
    const volumeSlider = document.getElementById('volume');

    playButton.addEventListener('click', () => {
      wavesurfer.playPause();
      playButton.textContent = wavesurfer.isPlaying() ? 'Pause' : 'Play';
    });

    wavesurfer.on('ready', () => {
      progressBar.max = wavesurfer.getDuration();
      totalTime.textContent = formatTime(wavesurfer.getDuration());
    });

    wavesurfer.on('audioprocess', () => {
      progressBar.value = wavesurfer.getCurrentTime();
      currentTime.textContent = formatTime(wavesurfer.getCurrentTime());
    });

    progressBar.addEventListener('input', () => {
      wavesurfer.setCurrentTime(progressBar.value);
    });

    volumeSlider.addEventListener('input', () => {
      wavesurfer.setVolume(volumeSlider.value);
    });

    function formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  </script>
</body>
</html>
