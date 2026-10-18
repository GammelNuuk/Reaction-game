/**
 * timer.js
 * 
 * Handles high-precision reaction timing, random delay generation,
 * paint-synchronized timestamping, and statistical metrics (Personal Best and Last-5 Average).
 */

import { TIMING, STORAGE_KEYS, PERFORMANCE_TIERS } from './constants.js';

export class ReactionTimer {
  constructor() {
    this.waitTimeoutId = null;
    this.goTimestamp = 0;
    this.isWaiting = false;
    this.isGoActive = false;

    // Load persisted stats
    this.personalBest = this.loadPersonalBest();
    this.history = this.loadHistory();
  }

  /**
   * Generates a cryptographically-fair or uniform random duration between
   * MIN_WAIT_MS and MAX_WAIT_MS (1.5 to 5.0 seconds).
   * Unpredictable timing prevents players from rhythmically pre-clicking.
   */
  getRandomWaitDuration() {
    return TIMING.MIN_WAIT_MS + Math.random() * (TIMING.MAX_WAIT_MS - TIMING.MIN_WAIT_MS);
  }

  /**
   * Begins the waiting period.
   * Clears any active timeouts first to guarantee zero ghost events.
   * 
   * @param {Function} onGoReady Callback executed when the wait period concludes.
   */
  startWait(onGoReady) {
    this.cancelWait();
    this.isWaiting = true;
    this.isGoActive = false;

    const delay = this.getRandomWaitDuration();

    this.waitTimeoutId = setTimeout(() => {
      this.isWaiting = false;

      /**
       * CRITICAL TIMING ACCURACY DECISION:
       * A setTimeout callback marks when JavaScript gets execution time, NOT when
       * pixels are actually rasterized and presented on the screen.
       * If we stamped performance.now() immediately here, the clock would start
       * up to 16ms (or more on 60Hz displays) before the user could visually perceive the signal.
       * 
       * By calling requestAnimationFrame, we trigger the DOM/visual update and record
       * the timestamp precisely as the browser prepares the display frame.
       */
      requestAnimationFrame((frameTimestamp) => {
        this.goTimestamp = frameTimestamp || performance.now();
        this.isGoActive = true;
        if (typeof onGoReady === 'function') {
          onGoReady(this.goTimestamp);
        }
      });
    }, delay);
  }

  /**
   * Cancels any pending wait timeout.
   * Called during early clicks, tab switching, or manual resets.
   */
  cancelWait() {
    if (this.waitTimeoutId !== null) {
      clearTimeout(this.waitTimeoutId);
      this.waitTimeoutId = null;
    }
    this.isWaiting = false;
    this.isGoActive = false;
    this.goTimestamp = 0;
  }

  /**
   * Measures player reaction time at input time.
   * 
   * @returns {Object} { reactionMs, isNewBest, averageMs, tier }
   */
  recordReaction() {
    if (!this.isGoActive || this.goTimestamp === 0) {
      return null;
    }

    const inputTimestamp = performance.now();
    const rawTime = inputTimestamp - this.goTimestamp;
    const reactionMs = Math.round(rawTime);

    this.isGoActive = false;

    // Check personal best
    let isNewBest = false;
    if (this.personalBest === null || reactionMs < this.personalBest) {
      this.personalBest = reactionMs;
      isNewBest = true;
      this.savePersonalBest(reactionMs);
    }

    // Update last 5 attempts history
    this.history.push(reactionMs);
    if (this.history.length > TIMING.HISTORY_SAMPLE_SIZE) {
      this.history.shift(); // Keep only last N attempts
    }
    this.saveHistory(this.history);

    const averageMs = this.calculateAverage();
    const tier = this.getTier(reactionMs);

    return {
      reactionMs,
      isNewBest,
      personalBest: this.personalBest,
      averageMs,
      history: [...this.history],
      tier,
    };
  }

  /**
   * Calculates the mean of the recent attempts array.
   */
  calculateAverage() {
    if (this.history.length === 0) return null;
    const sum = this.history.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / this.history.length);
  }

  /**
   * Evaluates player's performance tier.
   */
  getTier(ms) {
    return PERFORMANCE_TIERS.find((t) => ms <= t.maxMs) || PERFORMANCE_TIERS[PERFORMANCE_TIERS.length - 1];
  }

  /**
   * LocalStorage persistence with defensive try/catch blocks
   * to ensure no crashes in Private Browsing, sandboxed iframes, or disabled storage environments.
   */
  loadPersonalBest() {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.PERSONAL_BEST);
      return val !== null ? parseInt(val, 10) : null;
    } catch (e) {
      console.warn('LocalStorage unavailable for personal best:', e);
      return null;
    }
  }

  savePersonalBest(bestMs) {
    try {
      localStorage.setItem(STORAGE_KEYS.PERSONAL_BEST, bestMs.toString());
    } catch (e) {
      console.warn('Failed to save personal best to LocalStorage:', e);
    }
  }

  loadHistory() {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.slice(-TIMING.HISTORY_SAMPLE_SIZE);
      }
      return [];
    } catch (e) {
      console.warn('LocalStorage unavailable for history:', e);
      return [];
    }
  }

  saveHistory(hist) {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(hist));
    } catch (e) {
      console.warn('Failed to save history to LocalStorage:', e);
    }
  }

  /**
   * Clears saved personal best and history.
   */
  clearStorage() {
    this.personalBest = null;
    this.history = [];
    try {
      localStorage.removeItem(STORAGE_KEYS.PERSONAL_BEST);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
  }
}
