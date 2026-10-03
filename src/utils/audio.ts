export interface ChimePreset {
  id: string;
  name: string;
  description: string;
  play: () => void;
}

let sharedCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedCtx = new AudioContextClass();
    }
  }
  return sharedCtx;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(err => {
      console.warn("Failed to resume AudioContext:", err);
    });
  }
}

// Auto unlock on first user interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx) {
      ctx.resume().catch(err => {
        console.warn("Failed to resume AudioContext during unlock:", err);
      });
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0;
        osc.start();
        osc.stop(ctx.currentTime + 0.01);
      } catch (e) {
        // ignore
      }
    }
    window.removeEventListener('click', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
  };
  window.addEventListener('click', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
}

// 1. Premium Modern (Default)
export function playPremiumModernChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 659.25; // E5
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.4);

    const delay = 0.08;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 880.00; // A5
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + delay);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.45);
    osc2.start(ctx.currentTime + delay);
    osc2.stop(ctx.currentTime + delay + 0.5);
  } catch (err) {
    console.error("Failed to play Premium Modern Chime:", err);
  }
}

export const playNotificationChime = playPremiumModernChime;
