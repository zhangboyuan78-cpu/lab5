/* Shenzhen in 75 Seconds: original interaction code, 2026. No external libraries. */
'use strict';

const audio = document.getElementById('soundscape');
const screen = document.getElementById('screen');
const playButton = document.getElementById('playButton');
const playIcon = document.getElementById('playIcon');
const seekBar = document.getElementById('seekBar');
const volumeBar = document.getElementById('volumeBar');
const currentTimeLabel = document.getElementById('currentTime');
const durationLabel = document.getElementById('duration');
const reactivityButton = document.getElementById('reactivityButton');
const motionStatus = document.getElementById('motionStatus');
const visuals = [...document.querySelectorAll('.visual')];
const chapterButtons = [...document.querySelectorAll('[data-jump]')];
const chapterPills = [...document.querySelectorAll('.chapter')];
const visualBars = document.getElementById('visualBars');
const DURATION = 75;
const CHAPTER_LENGTH = 25;
const descriptions = [
  { title: 'FUTIAN, 08:00', zh: '福田', subtitle: 'The city wakes up. Footsteps, train rhythms, moving traffic.' },
  { title: 'HUAQIANGBEI, 14:00', zh: '华强北', subtitle: 'A street of invention. Electronic notes, crowds, urban energy.' },
  { title: 'SHENZHEN BAY, 18:00', zh: '深圳湾', subtitle: 'A quieter horizon. Breeze, water, and the distant city.' }
];

let ctx = null;
let analyser = null;
let frequencyData = null;
let animationFrame = 0;
let activeScene = -1;
let motionEnabled = true;
let isScrubbing = false;
let audioGraphAttempted = false;

// Create sound-reactive equalizer elements with accessible graphic decoration.
const barEls = Array.from({length: 19}, () => {
  const bar = document.createElement('span');
  bar.style.height = '7px';
  visualBars.append(bar);
  return bar;
});

const timeString = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

function showScene(time) {
  const index = Math.min(2, Math.max(0, Math.floor(Math.max(0, time) / CHAPTER_LENGTH)));
  if (index === activeScene) return;
  activeScene = index;
  visuals.forEach((el, i) => {
    el.classList.toggle('is-active', i === index);
    el.setAttribute('aria-hidden', String(i !== index));
  });
  chapterPills.forEach((el, i) => {
    el.classList.toggle('is-current', i === index);
    if (i === index) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
  document.getElementById('sceneCount').textContent = String(index + 1).padStart(2, '0');
  document.getElementById('sceneTitle').textContent = descriptions[index].title;
  document.getElementById('sceneSubtitle').textContent = descriptions[index].subtitle;
  document.getElementById('sceneChinese').textContent = descriptions[index].zh;
}

function updateTime() {
  const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : DURATION;
  const position = Math.min(total, Math.max(0, audio.currentTime || 0));
  if (!isScrubbing) {
    seekBar.value = String(position);
    currentTimeLabel.textContent = timeString(position);
  }
  seekBar.max = String(total);
  seekBar.style.setProperty('--progress', `${100 * position / total}%`);
  durationLabel.textContent = timeString(total);
  showScene(position >= total ? total - .01 : position);
}

function setPlayButton(isPlaying) {
  playButton.setAttribute('aria-pressed', String(isPlaying));
  playButton.setAttribute('aria-label', isPlaying ? 'Pause soundscape' : 'Play soundscape');
  playIcon.innerHTML = isPlaying
    ? '<path d="M7 5h4v14H7zM14 5h4v14h-4z"/>'
    : '<path d="M8 5.7v12.6L18.5 12z"/>';
}

function createAudioGraph() {
  if (audioGraphAttempted) return;
  audioGraphAttempted = true;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    ctx = new AudioContextClass();
    const source = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.connect(ctx.destination);
  } catch (error) {
    console.info('Sound analysis not available; normal audio playback is still enabled.', error);
  }
}

function animate() {
  animationFrame = requestAnimationFrame(animate);
  if (!motionEnabled) return;
  let energy = 0.11;
  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(frequencyData);
    let total = 0;
    for (let i = 2; i < Math.min(90, frequencyData.length); i++) total += frequencyData[i];
    energy = Math.min(1, (total / (Math.min(90, frequencyData.length) - 2)) / 140);
  } else if (!audio.paused) {
    energy = .23 + Math.sin(performance.now() / 350) * .07;
  }
  screen.style.setProperty('--energy', energy.toFixed(3));
  barEls.forEach((bar, i) => {
    let val;
    if (analyser && frequencyData && !audio.paused) {
      val = frequencyData[Math.min(frequencyData.length - 1, i * 4 + 2)] / 255;
    } else {
      val = audio.paused ? .035 : .13 + .12 * Math.abs(Math.sin(performance.now()/290 + i*1.8));
    }
    bar.style.height = `${5 + Math.round(val * 49)}px`;
  });
}

async function playAudio() {
  createAudioGraph();
  try {
    if (ctx && ctx.state === 'suspended') await ctx.resume();
    await audio.play();
  } catch (error) {
    console.error('Could not start audio playback:', error);
    setPlayButton(false);
  }
}

playButton.addEventListener('click', () => {
  if (audio.paused) playAudio();
  else audio.pause();
});

function jumpTo(seconds) {
  const position = Math.max(0, Math.min(DURATION - .1, seconds));
  if (audio.readyState === 0) {
    audio.addEventListener('loadedmetadata', () => { audio.currentTime = position; updateTime(); }, {once: true});
    audio.load();
  } else {
    audio.currentTime = position;
  }
  updateTime();
  // Jumping previews a chapter and leaves playback state unchanged.
}
chapterButtons.forEach(button => button.addEventListener('click', () => jumpTo(Number(button.dataset.jump))));
seekBar.addEventListener('pointerdown', () => { isScrubbing = true; });
seekBar.addEventListener('input', () => {
  isScrubbing = true;
  const value = Number(seekBar.value);
  seekBar.style.setProperty('--progress', `${100 * value / Number(seekBar.max)}%`);
  currentTimeLabel.textContent = timeString(value);
  showScene(value);
  audio.currentTime = value;
});
seekBar.addEventListener('change', () => { isScrubbing = false; updateTime(); });
seekBar.addEventListener('pointerup', () => { isScrubbing = false; updateTime(); });
volumeBar.addEventListener('input', () => { audio.volume = Number(volumeBar.value); });
reactivityButton.addEventListener('click', () => {
  motionEnabled = !motionEnabled;
  reactivityButton.setAttribute('aria-pressed', String(motionEnabled));
  motionStatus.textContent = motionEnabled ? 'ON' : 'OFF';
  if (!motionEnabled) {
    screen.style.setProperty('--energy', '0');
    screen.style.setProperty('--px', '0px');
    screen.style.setProperty('--py', '0px');
    barEls.forEach(bar => {bar.style.height = '6px';});
  }
});
// Optional mouse parallax. A small offset keeps text and controls stationary.
screen.addEventListener('pointermove', event => {
  if (!motionEnabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = screen.getBoundingClientRect();
  const px = ((event.clientX - r.left) / r.width - 0.5) * -10;
  const py = ((event.clientY - r.top) / r.height - 0.5) * -6;
  visuals.forEach(v => { v.style.setProperty('--px', `${px.toFixed(1)}px`); v.style.setProperty('--py', `${py.toFixed(1)}px`); });
});
screen.addEventListener('pointerleave', () => {
  visuals.forEach(v => { v.style.setProperty('--px', '0px'); v.style.setProperty('--py', '0px'); });
});
audio.addEventListener('play', () => { setPlayButton(true); if (!animationFrame) animate(); });
audio.addEventListener('pause', () => setPlayButton(false));
audio.addEventListener('ended', () => { setPlayButton(false); updateTime(); });
audio.addEventListener('loadedmetadata', updateTime);
audio.addEventListener('timeupdate', updateTime);
audio.addEventListener('seeked', updateTime);
audio.addEventListener('error', () => { document.getElementById('sceneSubtitle').textContent = 'Audio could not load. Please check that the assets folder was uploaded with the page.'; });
audio.volume = Number(volumeBar.value);
updateTime();
// Key shortcuts intentionally work only outside focused form controls.
document.addEventListener('keydown', event => {
  if (['INPUT','BUTTON','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); if (audio.paused) playAudio(); else audio.pause(); }
  if (['Digit1','Digit2','Digit3'].includes(event.code)) jumpTo((Number(event.code.slice(-1)) - 1) * 25);
});
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  motionEnabled = false;
  reactivityButton.setAttribute('aria-pressed', 'false');
  motionStatus.textContent = 'OFF';
}
