const audio = document.getElementById('background-music');
const button = document.getElementById('music-toggle');
const label = button.querySelector('span');
let fadeFrame = 0;
let attempt = 0;
const update = () => {
  const playing = !audio.paused;
  button.classList.toggle('playing', playing);
  button.setAttribute('aria-pressed', String(playing));
  button.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
  label.textContent = playing ? '音乐开' : '音乐关';
};
async function start() {
  const current = ++attempt;
  cancelAnimationFrame(fadeFrame);
  audio.volume = 0;
  try {
    await audio.play();
    if (current !== attempt) return;
    update();
    const began = performance.now();
    const fade = now => {
      if (current !== attempt || audio.paused) return;
      const progress = Math.min(1, (now - began) / 1800);
      audio.volume = .3 * progress;
      if (progress < 1) fadeFrame = requestAnimationFrame(fade);
    };
    fadeFrame = requestAnimationFrame(fade);
  } catch { if (current === attempt) update(); }
}
button.addEventListener('click', () => {
  if (audio.paused) void start();
  else { ++attempt; cancelAnimationFrame(fadeFrame); audio.pause(); update(); }
});
const opening = document.getElementById('opening');
// Browsers that allow autoplay start on the opening; otherwise the first
// opening-page gesture unlocks playback without waiting for entry.
void start();
const unlock = () => {
  if (audio.paused) void start();
};
opening.addEventListener('pointerdown', unlock, { once: true });
opening.addEventListener('keydown', unlock, { once: true });
document.getElementById('enter-stream').addEventListener('click', () => {
  if (audio.paused) void start();
}, { once: true });
audio.addEventListener('play', update);
audio.addEventListener('pause', update);
audio.addEventListener('error', update);
update();
