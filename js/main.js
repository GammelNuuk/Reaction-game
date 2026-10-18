/**
 * main.js
 * 
 * Main application coordinator and Finite State Machine (FSM).
 * Coordinates user input (pointerdown, keydown), high-precision timing,
 * WebGL 3D scene visual state, Web Audio synthesis, and UI updates.
 */

import { GAME_STATES } from './constants.js';
import { audio } from './audio.js';
import { ReactionTimer } from './timer.js';
import { GameScene } from './scene.js';

class ReactionGameApp {
  constructor() {
    this.state = GAME_STATES.IDLE;
    this.timer = new ReactionTimer();

    // DOM Elements
    this.dom = {
      body: document.body,
      gameRoot: document.getElementById('game-root'),
      canvas: document.getElementById('webgl-canvas'),
      stageIcon: document.getElementById('stage-icon'),
      stageTitle: document.getElementById('stage-title'),
      stageDesc: document.getElementById('stage-desc'),
      stageAction: document.getElementById('stage-action'),
      resultDisplay: document.getElementById('result-display'),
      resultTimeVal: document.getElementById('result-time-val'),
      resultTierBadge: document.getElementById('result-tier-badge'),
      resultTierIcon: document.getElementById('result-tier-icon'),
      resultTierLabel: document.getElementById('result-tier-label'),
      newBestBanner: document.getElementById('new-best-banner'),
      statPb: document.getElementById('stat-pb'),
      statAvg: document.getElementById('stat-avg'),
      statChips: document.getElementById('stat-chips'),
      btnMute: document.getElementById('btn-mute'),
      muteIcon: document.getElementById('mute-icon'),
      muteLabel: document.getElementById('mute-label'),
      btnReset: document.getElementById('btn-reset'),
    };

    // Initialize Three.js 3D Background Scene
    this.scene = new GameScene(this.dom.canvas);
    if (!this.scene.isWebGLAvailable) {
      this.dom.body.classList.add('no-webgl');
    }

    this.init();
  }

  /**
   * Initializes event listeners, audio UI, and statistical displays.
   */
  init() {
    this.updateStatsDisplay();
    this.updateMuteUI(this.audioIsMuted());
    this.bindEvents();
    this.transitionTo(GAME_STATES.IDLE);
  }

  audioIsMuted() {
    return audio.isMuted;
  }

  /**
   * Global event routing.
   * Crucial game feel decision: Inputs are captured immediately on press
   * (pointerdown & keydown), NEVER on release (mouseup/keyup/click).
   */
  bindEvents() {
    // 1. Pointer Down (covers Mouse, Touch, Stylus with zero artificial delay)
    this.dom.gameRoot.addEventListener('pointerdown', (e) => {
      // Don't trigger game loop if clicking header control buttons
      if (e.target.closest('.header-controls')) return;
      this.handlePlayerInput();
    });

    // 2. Keyboard Space bar (and M shortcut for mute)
    window.addEventListener('keydown', (e) => {
      // Audio mute shortcut
      if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
        this.toggleAudioMute();
        return;
      }

      // Space bar triggers gameplay
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent standard page scroll
        if (e.repeat) return; // Ignore autorepeat when held
        this.handlePlayerInput();
      }
    });

    // 3. Audio Toggle Button
    this.dom.btnMute.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.dom.btnMute.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAudioMute();
    });

    // 4. Reset Personal Records Button
    this.dom.btnReset.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.dom.btnReset.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Reset your personal best and recent reaction history?')) {
        this.timer.clearStorage();
        this.updateStatsDisplay();
      }
    });

    // 5. Fairness & Robustness: Handle Window Blur & Tab Switching
    // If the player switches tabs during Waiting or Go, invalidate the round
    // to prevent misleading timestamps or background ghost events.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === GAME_STATES.WAITING || this.state === GAME_STATES.GO) {
          this.timer.cancelWait();
          this.transitionTo(GAME_STATES.IDLE, {
            message: 'Round cancelled due to tab switch. Ready when you are!',
          });
        }
      }
    });

    window.addEventListener('blur', () => {
      if (this.state === GAME_STATES.WAITING) {
        this.timer.cancelWait();
        this.transitionTo(GAME_STATES.IDLE);
      }
    });
  }

  /**
   * Central input dispatcher based on current finite state.
   */
  handlePlayerInput() {
    // Unlock Web Audio context on the first interactive gesture
    audio.initContext();

    switch (this.state) {
      case GAME_STATES.IDLE:
      case GAME_STATES.TOO_SOON:
      case GAME_STATES.RESULT:
        // Transition to WAITING state to start a new attempt
        this.transitionTo(GAME_STATES.WAITING);
        break;

      case GAME_STATES.WAITING:
        // Player clicked prematurely before the GO signal
        this.handleEarlyClick();
        break;

      case GAME_STATES.GO:
        // Player reacted to the signal!
        this.handleSuccessfulReaction();
        break;
    }
  }

  /**
   * Handles early click foul (Fairness enforcement).
   */
  handleEarlyClick() {
    this.timer.cancelWait();
    audio.playTooSoon();
    this.transitionTo(GAME_STATES.TOO_SOON);
  }

  /**
   * Handles valid reaction when GO is active.
   */
  handleSuccessfulReaction() {
    const result = this.timer.recordReaction();
    if (!result) return;

    if (result.isNewBest) {
      audio.playNewBest();
    } else {
      audio.playReaction();
    }

    this.updateStatsDisplay();
    this.transitionTo(GAME_STATES.RESULT, result);
  }

  /**
   * State Machine Transitions
   * Updates CSS attributes, 3D Three.js scene, and screen text.
   */
  transitionTo(newState, payload = {}) {
    this.state = newState;
    this.dom.body.dataset.state = newState;

    // Notify Three.js scene
    this.scene.setState(newState, payload);

    // Hide conditional elements by default
    this.dom.resultDisplay.style.display = 'none';
    this.dom.resultTierBadge.style.display = 'none';
    this.dom.newBestBanner.style.display = 'none';

    switch (newState) {
      case GAME_STATES.IDLE:
        this.dom.stageIcon.textContent = '⚡';
        this.dom.stageTitle.textContent = 'PulseReflex';
        this.dom.stageDesc.textContent = payload.message || 'When the screen turns electric green, click or press Space as fast as you can.';
        this.dom.stageAction.textContent = 'Click, tap, or press Space to start';
        break;

      case GAME_STATES.WAITING:
        this.dom.stageIcon.textContent = '⏳';
        this.dom.stageTitle.textContent = 'Wait for green...';
        this.dom.stageDesc.textContent = 'Focus on the screen. The signal will appear in 1.5 to 5 seconds.';
        this.dom.stageAction.textContent = 'Don\'t click yet!';

        // Begin high precision wait countdown
        this.timer.startWait(() => {
          // Callback invoked on the exact paint frame of the GO signal
          this.transitionTo(GAME_STATES.GO);
        });
        break;

      case GAME_STATES.GO:
        audio.playGo();
        this.dom.stageIcon.textContent = '💥';
        this.dom.stageTitle.textContent = 'GO!';
        this.dom.stageDesc.textContent = 'CLICK NOW!';
        this.dom.stageAction.textContent = 'CLICK OR PRESS SPACE!';
        break;

      case GAME_STATES.TOO_SOON:
        this.dom.stageIcon.textContent = '⚠️';
        this.dom.stageTitle.textContent = 'Too soon!';
        this.dom.stageDesc.textContent = 'You reacted before the signal appeared. Patience is key!';
        this.dom.stageAction.textContent = 'Click or press Space to try again';
        break;

      case GAME_STATES.RESULT:
        this.dom.stageIcon.textContent = payload.isNewBest ? '🏆' : '🎯';
        this.dom.stageTitle.textContent = payload.isNewBest ? 'Incredible Speed!' : 'Reaction Time';
        
        // Show numerical result
        this.dom.resultDisplay.style.display = 'block';
        this.dom.resultTimeVal.textContent = payload.reactionMs;

        // Show reflex tier rating badge
        if (payload.tier) {
          this.dom.resultTierBadge.style.display = 'inline-flex';
          this.dom.resultTierIcon.textContent = payload.tier.icon;
          this.dom.resultTierLabel.textContent = payload.tier.label;
        }

        // Show celebratory gold banner if beaten
        if (payload.isNewBest) {
          this.dom.newBestBanner.style.display = 'inline-flex';
        }

        this.dom.stageDesc.textContent = `Attempt registered at ${payload.reactionMs} ms.`;
        this.dom.stageAction.textContent = 'Click or press Space to play again';
        break;
    }
  }

  /**
   * Refreshes Personal Best, Last-5 Average, and attempt chips in the UI.
   */
  updateStatsDisplay() {
    // Personal best
    const pb = this.timer.personalBest;
    this.dom.statPb.textContent = pb !== null ? `${pb} ms` : '—';

    // Last 5 Average
    const avg = this.timer.calculateAverage();
    this.dom.statAvg.textContent = avg !== null ? `${avg} ms` : '—';

    // Recent attempts chips
    const history = this.timer.history;
    if (history.length === 0) {
      this.dom.statChips.innerHTML = '<span class="history-chip">—</span>';
    } else {
      this.dom.statChips.innerHTML = history
        .map((ms, index) => `<span class="history-chip" title="Attempt ${index + 1}">${ms} ms</span>`)
        .join('');
    }
  }

  /**
   * Toggles audio mute and updates button styling/labels.
   */
  toggleAudioMute() {
    const isMuted = audio.toggleMute();
    this.updateMuteUI(isMuted);
  }

  updateMuteUI(isMuted) {
    this.dom.muteIcon.textContent = isMuted ? '🔇' : '🔊';
    this.dom.muteLabel.textContent = isMuted ? 'Muted' : 'Audio On';
    this.dom.btnMute.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
  }
}

// Bootstrap application once DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  new ReactionGameApp();
});
