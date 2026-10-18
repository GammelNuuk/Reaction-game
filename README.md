# PulseReflex // 3D WebGL Reaction Timer Game

> A fast, high-precision WebGL reaction timer game built with Three.js and the Web Audio API, engineered for competitive game feel, sub-millisecond fairness, and rock-solid accessibility.

[![Live Demo](https://img.shields.io/badge/Demo-Play%20Online-2EF2A0?style=for-the-badge)](https://your-username.github.io/reactiongame/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

---

### Demo Preview
<!-- Placeholder for Gameplay GIF / Video -->
![PulseReflex Gameplay Preview](https://via.placeholder.com/800x450/0F1117/2EF2A0?text=PulseReflex+Gameplay+Demo+GIF)

*Live Demo:* [https://your-portfolio.itch.io/pulsereflex](https://your-portfolio.itch.io/pulsereflex) (or [GitHub Pages Link](https://your-username.github.io/reactiongame/))

---

## Features

- **Core Gameplay Loop**:
  - Interactive start screen with multi-modal cues (Click, Tap, or Spacebar).
  - Unpredictable wait state (randomized between 1.5s and 5.0s) to eliminate rhythmic anticipation.
  - Unmistakable **"GO!"** signal: full-screen electric mint color change, text/icon inversion, Three.js shape impulse, and crisp audio chime.
  - Sub-millisecond timing measured from the exact display paint frame.
  - Satisfying result reveal with qualitative reflex tiers (Superhuman, Esports Tier, Sharp, etc.).
- **Fairness & Competitive Integrity**:
  - Early click detection ("Too soon!") immediately faults and resets the round, preventing spamming.
  - Registered on physical press (`pointerdown` / `keydown`), eliminating the ~80–120ms human finger lift-off latency of release events (`click` / `keyup`).
  - Active timeout cancellation ensures zero ghost signals or stale state triggers.
- **Dynamic Three.js WebGL Visuals**:
  - Floating low-poly geometric meshes (icosahedrons, octahedrons, torus knots, dodecahedrons) with flat shading and soft multi-point lighting.
  - Responsive visual states:
    - *Idle*: Gentle organic drift and rotation.
    - *Waiting*: Shapes slow down and dim slightly, building tension without telegraphing when GO occurs.
    - *GO!*: Instant scale burst, speed acceleration, and electric mint emissive flash.
    - *Too soon*: Warm orange jolt and directional screen shake.
    - *Result / New Best*: Settled state with celebratory gold radiance burst.
  - Subtle mouse/pointer parallax on desktop.
- **Procedural Game Audio**:
  - Synthesized in real time using the **Web Audio API**—no external audio files or network latency.
  - Distinct sound profiles for GO signal, valid reaction, early foul, and personal best fanfare.
  - Persistent audio mute toggle with keyboard shortcut (`M`).
- **Data Persistence & Retention**:
  - Personal Best saved to `localStorage` (safely wrapped in `try/catch` for private browsing and sandboxed iframes).
  - Real-time rolling average of the last 5 attempts with attempt history chips.
  - Local record reset utility for fresh testing sessions.
- **Accessibility & Engine Polish**:
  - Fully responsive across mobile, tablet, and ultra-wide screens.
  - Dual-channel signaling: doesn't rely on color alone (combines full-screen color tint, bold typography changes, high-contrast brightness shift, and audio).
  - Numerical stability via `font-variant-numeric: tabular-nums` to prevent layout reflow during measurement.
  - Respects `prefers-reduced-motion` by dampening 3D movements and disabling shakes.
  - Seamless fallback to flat CSS color scheme if WebGL is disabled or unsupported.

---

## Technical Decisions

### 1. Why `performance.now()` instead of `Date.now()`?
`Date.now()` provides Unix epoch time in integer milliseconds and is subject to system clock drifts, NTP synchronization jumps, and OS clock adjustments. In contrast, `performance.now()` provides a monotonic, high-resolution floating-point timestamp measured in fractions of a millisecond that never steps backward, guaranteeing absolute fairness across attempts.

### 2. Why `pointerdown` and `keydown` instead of `click` / `keyup`?
Standard web `click` events only fire when a pointer completes both press and release. Human finger release latency introduces roughly 70–120ms of artificial lag that measures muscular lift-off rather than neural visual reaction time. Furthermore, mobile browsers historically injected tap delays. Using `pointerdown` and `keydown` (with `e.preventDefault()` on Space to prevent window scrolling) ensures the game records the player's reflex at the exact instant physical contact is made.

### 3. Decoupling Timing from Three.js Render Loop
Games must never tie physical or timing mechanics to frame rates. If the game's reaction clock were tied to `requestAnimationFrame` ticks in the Three.js loop, a frame drop from 60 FPS to 30 FPS would add up to 33ms of quantization jitter to the player's score. Instead:
- State transitions and input listeners run asynchronously on direct event loop dispatches.
- The GO timestamp is synchronized to the display refresh via `requestAnimationFrame` on the transition frame, ensuring the clock starts only when the visual signal is rasterized.

### 4. Early Clicks ("Too soon!") Handling
If a player attempts to guess or pre-empt the signal during the `waiting` phase, the pending `setTimeout` is cancelled immediately with `clearTimeout`, and the state machine moves to `too-soon`. The 3D scene jolts in warm orange, an error buzzer sounds, and the round is invalidated, preventing lucky pre-clicks from polluting the personal best.

### 5. Tab Focus & Background Handling (`visibilitychange`)
If a player minimizes the tab or switches windows while waiting, browsers throttle background timers and animation frames. PulseReflex listens to `visibilitychange` and window `blur` events, immediately aborting any active wait countdown and returning safely to the idle state. This prevents "ghost" signals from firing while the player is away.

### 6. Graceful WebGL Fallback
Not all embedded web views or battery-saver devices have an operational WebGL context. The `GameScene` class performs feature detection on initialization. If WebGL context creation fails, the canvas is hidden and the `no-webgl` class is applied to `<body>`. The CSS custom properties and state overlays take over seamlessly, ensuring the game remains 100% playable with zero visual degradation in UI clarity.

---

## Project Structure

```
reactiongame/
├── index.html           # Semantic HTML with CDN Three.js import map & meta tags
├── style.css            # Dark theme, CSS tokens, responsive flexbox & state overlays
├── js/
│   ├── constants.js     # Shared color palette, state machine enum, timing ranges
│   ├── audio.js         # Web Audio API synthesizers and mute persistence
│   ├── timer.js         # Paint-synced reaction timer & localStorage metrics
│   ├── scene.js         # Three.js 3D backdrop, lighting, parallax, & state animations
│   └── main.js          # Finite State Machine controller & input routing
└── README.md            # Documentation, design rationale, and deployment guide
```

---

## Running Locally

Because this project utilizes standard browser **ES Modules (`import`/`export`)** and an **import map**, running it directly via the `file://` protocol may trigger browser CORS restrictions. Run it through any simple static HTTP server:

### Option A: VS Code Live Server
1. Open the project folder in VS Code.
2. Click **"Go Live"** in the bottom status bar (requires the *Live Server* extension).

### Option B: Python 3
```bash
python3 -m http.server 8080
# Open http://localhost:8080 in your browser
```

### Option C: Node.js / npx
```bash
npx serve .
# Or:
npx http-server .
```

---

## Deployment

### Deploying to GitHub Pages
1. Push this repository to GitHub.
2. Navigate to your repository **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select `Deploy from a branch`.
4. Choose the `main` (or `master`) branch, root folder (`/`), and click **Save**.
5. Your game will be live at `https://<your-username>.github.io/<repo-name>/`.
*(Note: All asset links and scripts use relative paths (`./`), so it works out of the box in subfolders!)*

### Deploying to itch.io
1. Compress all files (`index.html`, `style.css`, `js/`, etc.) into a `.zip` archive:
   ```bash
   zip -r reactiongame.zip index.html style.css js/
   ```
2. Create a new project on itch.io.
3. Under **Kind of project**, select **HTML**.
4. In the **Uploads** section, upload `reactiongame.zip` and tick the checkbox: **"This file will be played in the browser"**.
5. Set the viewport dimensions (e.g. `960x640` or check **"Fullscreen button"** and **"Automatically determine size"**).
6. Save and publish!

---

## What I'd Add Next

- **Soundtrack & Ambient Audio**: An interactive procedural audio drone that builds harmonic tension during the waiting period.
- **Histogram / Reflex Distribution Chart**: An in-game canvas chart showing the player's reaction time distribution compared to human population bell curves (e.g., standard normal distribution where median is ~250ms).
- **Audio-Only / Tactile Reaction Mode**: An accessibility mode where the prompt is purely audio or haptic vibration (on supported mobile devices) to test auditory vs. visual reaction pathways.
- **Customization Settings**: User-customizable 3D themes (e.g. Cyberpunk Neon, Retro Vaporwave, Minimalist Monolith).
