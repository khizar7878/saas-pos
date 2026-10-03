import { getAudioContext } from './audio';

let ringtoneInterval: any = null;
let activeOscillators: OscillatorNode[] = [];

export function startIncomingRingtone() {
  stopRingtone();
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const playTone = () => {
    try {
      if (!ctx || ctx.state === 'closed') return;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.12, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(783.99, now + 0.7);
      gain3.gain.setValueAtTime(0, now);
      gain3.gain.setValueAtTime(0.12, now + 0.7);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.7);
      osc3.stop(now + 1.25);

      activeOscillators.push(osc1, osc2, osc3);
    } catch (err) {
      console.warn("Ringtone play error:", err);
    }
  };

  playTone();
  ringtoneInterval = setInterval(playTone, 2000);
}

export function startOutgoingRingback() {
  stopRingtone();
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const playRingback = () => {
    try {
      if (!ctx || ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.5);
      osc2.stop(now + 1.5);

      activeOscillators.push(osc1, osc2);
    } catch (e) {
      console.warn("Ringback play error:", e);
    }
  };

  playRingback();
  ringtoneInterval = setInterval(playRingback, 3500);
}

export function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  activeOscillators.forEach(osc => {
    try {
      osc.stop();
    } catch (e) {
      // ignore
    }
  });
  activeOscillators = [];
}
