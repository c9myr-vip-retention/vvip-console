// The "new message" sound for the bell. Made with Web Audio, so there is no file to load. Browsers only allow sound after the person has
// clicked or pressed a key once on the page, so armSound() waits for the first one. The on/off choice is kept per browser.
const KEY = "notif_sound";
let ac = null, armed = false;

export const soundOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch (e) { return true; } };
export const setSoundOn = (on) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* private mode */ } };

function ctx() {
  if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}

/** Call once: the first click or key press on the page unlocks the sound. */
export function armSound() {
  if (armed) return;
  armed = true;
  const go = () => { ctx(); window.removeEventListener("pointerdown", go); window.removeEventListener("keydown", go); };
  window.addEventListener("pointerdown", go); window.addEventListener("keydown", go);
}

/** Two soft rising notes. Quiet on purpose: it is heard many times a day. */
export function ding() {
  try {
    const a = ctx();
    if (!a || a.state !== "running") return;
    [[880, 0], [1318.5, 0.13]].forEach(([hz, at]) => {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
      o.type = "sine"; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + 0.3);
    });
  } catch (e) { /* no sound is better than a broken page */ }
}
