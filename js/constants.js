/**
 * constants.js
 * 
 * Central configuration for the Reaction Timer Game.
 * Houses shared color tokens (used across CSS and Three.js materials),
 * game state identifiers, timing thresholds, and storage keys.
 */

// Shared color palette (Hex strings for CSS and numeric equivalents for Three.js)
export const PALETTE = {
  background: '#0F1117',
  surface: '#1A1D27',
  text: '#F5F7FA',
  textMuted: '#8B93A7',
  wait: '#2B2F6B',     // Deep indigo
  go: '#2EF2A0',       // Electric mint
  tooSoon: '#FF8A3D',  // Warm orange
  highlight: '#FFD23F', // Gold
  // Hex numbers for Three.js Color / Material constructors
  three: {
    background: 0x0F1117,
    surface: 0x1A1D27,
    text: 0xF5F7FA,
    wait: 0x2B2F6B,
    go: 0x2EF2A0,
    tooSoon: 0xFF8A3D,
    highlight: 0xFFD23F,
    ambient: 0x1A1D27,
    lightGo: 0x2EF2A0,
    lightWait: 0x4850B8,
  }
};

// Strict finite state machine values
export const GAME_STATES = Object.freeze({
  IDLE: 'idle',
  WAITING: 'waiting',
  GO: 'go',
  TOO_SOON: 'too-soon',
  RESULT: 'result',
});

// Timing configuration (random delay between 1.5s and 5.0s to eliminate anticipation)
export const TIMING = Object.freeze({
  MIN_WAIT_MS: 1500,
  MAX_WAIT_MS: 5000,
  HISTORY_SAMPLE_SIZE: 5,
});

// LocalStorage persistence keys
export const STORAGE_KEYS = Object.freeze({
  PERSONAL_BEST: 'reaction_game_best_ms',
  HISTORY: 'reaction_game_recent_history',
  MUTED: 'reaction_game_audio_muted',
});

// Qualitative feedback tiers for reaction speeds (for game feel & motivation)
export const PERFORMANCE_TIERS = Object.freeze([
  { maxMs: 180, label: 'Superhuman Reflexes!', icon: '⚡' },
  { maxMs: 220, label: 'Esports Tier', icon: '🎯' },
  { maxMs: 260, label: 'Sharp & Snappy', icon: '✨' },
  { maxMs: 320, label: 'Solid Average', icon: '👍' },
  { maxMs: Infinity, label: 'A bit sleepy, try again!', icon: '☕' },
]);
