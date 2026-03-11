/**
 * Web Audio API-based sound manager for escape room game.
 * Synthesizes all sounds programmatically — no audio files needed.
 */

let audioCtx: AudioContext | null = null;
let muted = false;

// Load mute state from localStorage
try {
  muted = localStorage.getItem("escape-room-muted") === "true";
} catch {}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  delay = 0,
) {
  if (muted) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

function playNoise(duration: number, volume = 0.05, delay = 0) {
  if (muted) return;
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

export const audio = {
  /** Ascending arpeggio — puzzle correct */
  correct() {
    playTone(523, 0.15, "sine", 0.12, 0);      // C5
    playTone(659, 0.15, "sine", 0.12, 0.1);     // E5
    playTone(784, 0.25, "sine", 0.15, 0.2);     // G5
  },

  /** Low descending buzz — wrong answer */
  wrong() {
    playTone(200, 0.15, "sawtooth", 0.08, 0);
    playTone(150, 0.2, "sawtooth", 0.06, 0.12);
  },

  /** Short bell — hint delivered */
  hint() {
    playTone(880, 0.3, "sine", 0.1, 0);
    playTone(1100, 0.2, "sine", 0.06, 0.15);
  },

  /** Timer warning beep */
  timerWarning() {
    playTone(1000, 0.1, "square", 0.08, 0);
    playTone(1000, 0.1, "square", 0.08, 0.2);
  },

  /** Door/transition whoosh */
  transition() {
    playNoise(0.4, 0.06);
  },

  /** Celebratory jingle — game completed */
  victory() {
    playTone(523, 0.15, "sine", 0.12, 0);    // C5
    playTone(659, 0.15, "sine", 0.12, 0.12);  // E5
    playTone(784, 0.15, "sine", 0.12, 0.24);  // G5
    playTone(1047, 0.4, "sine", 0.15, 0.36);  // C6
  },

  /** Descending failure tone */
  failure() {
    playTone(440, 0.3, "sine", 0.1, 0);       // A4
    playTone(349, 0.3, "sine", 0.1, 0.25);    // F4
    playTone(294, 0.5, "sine", 0.08, 0.5);    // D4
  },

  /** Object pickup click */
  pickup() {
    playTone(600, 0.08, "sine", 0.1, 0);
    playTone(800, 0.06, "sine", 0.08, 0.05);
  },

  /** Partner solved something — notification ping */
  partnerSolve() {
    playTone(700, 0.12, "triangle", 0.08, 0);
    playTone(900, 0.15, "triangle", 0.06, 0.1);
  },

  /** Chat message received */
  chatPing() {
    playTone(600, 0.08, "sine", 0.05, 0);
  },

  /** Get/set mute state */
  isMuted() {
    return muted;
  },

  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem("escape-room-muted", String(value));
    } catch {}
  },

  toggleMute() {
    this.setMuted(!muted);
    return muted;
  },
};
