/*
 * The incoming-call ring, synthesised with the Web Audio API (no sound file).
 *
 * Browsers only let a page play sound after the user has interacted with it,
 * which is why staff click "Go on duty" instead of being on duty the moment
 * the portal opens: that click calls unlockAudio(), and the unlocked
 * AudioContext can then ring later without another click.
 *
 * The whole ring (every burst for the full ring time) is scheduled on the
 * audio clock up front rather than repeated with setInterval: browsers slow
 * timers in background tabs down to once a minute, but not the audio clock.
 */

// Matches the server's ring time; the server's call:ring-stopped ends it sooner.
const RING_SECONDS = 30;
const CYCLE_SECONDS = 3;
const VOLUME = 0.15;

let context: AudioContext | null = null;
let output: GainNode | null = null;

/** Call from a click handler. Safe to call again. */
export function unlockAudio() {
  if (!context) context = new AudioContext();
  if (context.state === 'suspended') void context.resume();
}

/** Starts (or restarts) the ring. Silent if audio was never unlocked. */
export function startRingtone() {
  if (!context) return;
  stopRingtone();

  const out = context.createGain();
  out.gain.value = VOLUME;
  out.connect(context.destination);
  output = out;

  const start = context.currentTime + 0.05;
  for (let cycle = 0; cycle * CYCLE_SECONDS < RING_SECONDS; cycle++) {
    const at = start + cycle * CYCLE_SECONDS;
    burst(context, out, at, 0.4);
    burst(context, out, at + 0.6, 0.4);
  }
}

/** Disconnecting the output silences everything scheduled on it at once. */
export function stopRingtone() {
  output?.disconnect();
  output = null;
}

/** One "ring": two tones together (a classic phone ring), with a short fade to avoid clicks. */
function burst(ctx: AudioContext, out: GainNode, at: number, duration: number) {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(1, at + 0.02);
  envelope.gain.setValueAtTime(1, at + duration - 0.02);
  envelope.gain.linearRampToValueAtTime(0, at + duration);
  envelope.connect(out);

  for (const frequency of [440, 480]) {
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(envelope);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }
}
