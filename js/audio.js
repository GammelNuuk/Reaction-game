/**
 * audio.js
 * 
 * Synthesized audio manager using the Web Audio API.
 * Eliminates external network asset dependencies, ensures zero-latency playback,
 * and maintains audio state persistence across sessions.
 */

import { STORAGE_KEYS } from './constants.js';

class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = this.loadMuteState();
    this.masterGain = null;
  }

  /**
   * Initializes the AudioContext upon first user interaction to comply
   * with modern browser autoplay policies.
   */
  initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Safe localStorage retrieval for the user's mute preference.
   */
  loadMuteState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MUTED);
      return stored !== null ? JSON.parse(stored) : false;
    } catch (e) {
      console.warn('LocalStorage unavailable for audio settings:', e);
      return false;
    }
  }

  /**
   * Toggles mute state and saves to localStorage.
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.initContext();
    this.isMuted = !this.isMuted;

    try {
      localStorage.setItem(STORAGE_KEYS.MUTED, JSON.stringify(this.isMuted));
    } catch (e) {
      console.warn('Unable to persist mute state:', e);
    }

    if (this.masterGain && this.ctx) {
      // Smooth fade to prevent popping when toggling mute
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 1, now + 0.05);
    }

    return this.isMuted;
  }

  /**
   * GO Signal sound:
   * Bright, high-energy dual chime sweep (major triad feel: 587Hz D5 -> 880Hz A5)
   * Designed to punch through instantly to stimulate reflex response.
   */
  playGo() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Primary bright lead
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);

    // Harmonic bell overtone
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.5, now); // E6
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.15);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.25);
  }

  /**
   * Valid Reaction sound:
   * Satisfying, crisp snap/click with an affirmative harmonic tone.
   */
  playReaction() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Transient crisp pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.08); // Quick upward snap (B5)

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Early click ("Too soon!") sound:
   * Dissonant low buzz / descending failure drop to clearly communicate foul.
   */
  playTooSoon() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.22); // Pitch fall

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Celebratory sound for achieving a New Personal Best:
   * Upward major arpeggio cascade.
   */
  playNewBest() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const noteTime = startTime + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.26);
    });
  }
}

export const audio = new AudioManager();
