/**
 * scene.js
 * 
 * Manages the Three.js 3D WebGL backdrop.
 * Renders low-poly floating geometric shapes with dynamic physical lighting,
 * state-driven animations, desktop parallax, reduced-motion compliance,
 * and robust graceful fallback when WebGL is unsupported.
 */

import * as THREE from 'three';
import { PALETTE, GAME_STATES } from './constants.js';

export class GameScene {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.isWebGLAvailable = this.checkWebGLSupport();

    if (!this.isWebGLAvailable) {
      console.warn('WebGL is not available in this environment. Falling back to CSS mode.');
      if (this.canvas) this.canvas.style.display = 'none';
      return;
    }

    this.shapes = [];
    this.currentState = GAME_STATES.IDLE;
    this.isPaused = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Desktop parallax tracking
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    // Shake animation state for "Too soon!"
    this.shakeIntensity = 0;

    // Clock for consistent frame-rate independent animations
    this.clock = new THREE.Clock();

    this.init();
  }

  /**
   * Verifies WebGL context creation before attempting initialization.
   */
  checkWebGLSupport() {
    try {
      const testCanvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Sets up Three.js scene, camera, renderer, lighting, and low-poly meshes.
   */
  init() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.three.background);

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 0, 14);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    // Performance optimization: Cap pixel ratio at 2 to protect mobile GPUs
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // 4. Lighting (Soft ambient + key directional + dynamic state point light)
    this.ambientLight = new THREE.AmbientLight(PALETTE.three.ambient, 1.8);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.keyLight.position.set(6, 10, 8);
    this.scene.add(this.keyLight);

    this.stateLight = new THREE.PointLight(PALETTE.three.lightWait, 2.5, 25);
    this.stateLight.position.set(0, 0, 4);
    this.scene.add(this.stateLight);

    // 5. Build geometric meshes
    this.createShapes();

    // 6. Event Listeners
    this.bindEvents();

    // 7. Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /**
   * Creates a curated set of low-poly geometric shapes.
   * Kept strategically around the perimeter so central UI text remains crystal clear.
   */
  createShapes() {
    // Reusable low-poly geometries (flatShading highlights the geometric facets)
    const geometries = [
      new THREE.IcosahedronGeometry(1.2, 0),
      new THREE.OctahedronGeometry(1.3, 0),
      new THREE.DodecahedronGeometry(1.1, 0),
      new THREE.TorusKnotGeometry(0.85, 0.32, 32, 8, 2, 3),
      new THREE.IcosahedronGeometry(0.9, 0),
      new THREE.OctahedronGeometry(1.0, 0),
    ];

    // Coordinates flanking the central UI column
    const layout = [
      { x: -5.0, y: 3.2, z: -1.5, geom: geometries[0], rotSpeed: 0.6 },
      { x: 5.2, y: 3.0, z: -2.0, geom: geometries[3], rotSpeed: 0.8 },
      { x: -5.8, y: -2.8, z: -0.5, geom: geometries[1], rotSpeed: 0.5 },
      { x: 5.5, y: -2.6, z: -1.2, geom: geometries[2], rotSpeed: 0.7 },
      { x: -2.8, y: 4.2, z: -3.5, geom: geometries[4], rotSpeed: 0.4 },
      { x: 3.2, y: -4.0, z: -3.0, geom: geometries[5], rotSpeed: 0.65 },
      { x: 0.0, y: 4.8, z: -4.0, geom: geometries[0], rotSpeed: 0.3 },
    ];

    this.shapeGroup = new THREE.Group();
    this.scene.add(this.shapeGroup);

    layout.forEach((cfg, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: PALETTE.three.surface,
        roughness: 0.35,
        metalness: 0.25,
        flatShading: true,
        emissive: new THREE.Color(PALETTE.three.background),
        emissiveIntensity: 0.2,
      });

      const mesh = new THREE.Mesh(cfg.geom, material);
      mesh.position.set(cfg.x, cfg.y, cfg.z);

      // Random initial rotation for visual variety
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const shapeData = {
        mesh,
        basePos: mesh.position.clone(),
        baseScale: 1.0,
        currentScale: 1.0,
        targetScale: 1.0,
        baseRotSpeed: cfg.rotSpeed,
        currentRotSpeed: cfg.rotSpeed,
        targetRotSpeed: cfg.rotSpeed,
        driftPhase: index * 1.3,
        targetColor: new THREE.Color(PALETTE.three.surface),
        targetEmissive: new THREE.Color(PALETTE.three.background),
        targetEmissiveIntensity: 0.2,
      };

      this.shapes.push(shapeData);
      this.shapeGroup.add(mesh);
    });
  }

  /**
   * Updates shape properties and lighting based on game state transitions.
   * 
   * @param {string} state - The new GAME_STATES value.
   * @param {Object} options - Additional context (e.g., isNewBest: true)
   */
  setState(state, options = {}) {
    if (!this.isWebGLAvailable) return;
    this.currentState = state;

    switch (state) {
      case GAME_STATES.IDLE:
        this.stateLight.color.set(PALETTE.three.lightWait);
        this.stateLight.intensity = 2.0;

        this.shapes.forEach((s) => {
          s.targetScale = s.baseScale;
          s.targetRotSpeed = s.baseRotSpeed;
          s.targetColor.set(PALETTE.three.surface);
          s.targetEmissive.set(PALETTE.three.background);
          s.targetEmissiveIntensity = 0.2;
        });
        break;

      case GAME_STATES.WAITING:
        // Shapes slow down and dim slightly, building tension.
        // Movement stays completely constant and steady to prevent any telegraphing!
        this.stateLight.color.set(PALETTE.three.wait);
        this.stateLight.intensity = 1.6;

        this.shapes.forEach((s) => {
          s.targetScale = this.reducedMotion ? s.baseScale : s.baseScale * 0.92;
          s.targetRotSpeed = s.baseRotSpeed * 0.35; // Slower, steady crawl
          s.targetColor.set(PALETTE.three.wait);
          s.targetEmissive.set(PALETTE.three.wait);
          s.targetEmissiveIntensity = 0.3;
        });
        break;

      case GAME_STATES.GO:
        // Instant energetic reaction: shapes flash mint, scale up, spin fast
        this.stateLight.color.set(PALETTE.three.go);
        this.stateLight.intensity = 5.0;

        this.shapes.forEach((s) => {
          if (!this.reducedMotion) {
            // Immediate impulse pop
            s.currentScale = s.baseScale * 1.35;
            s.targetScale = s.baseScale * 1.15;
            s.currentRotSpeed = s.baseRotSpeed * 4.0;
            s.targetRotSpeed = s.baseRotSpeed * 2.2;
          }
          s.mesh.material.color.set(PALETTE.three.go);
          s.targetColor.set(PALETTE.three.go);
          s.mesh.material.emissive.set(PALETTE.three.go);
          s.targetEmissive.set(PALETTE.three.go);
          s.mesh.material.emissiveIntensity = 0.7;
          s.targetEmissiveIntensity = 0.5;
        });
        break;

      case GAME_STATES.TOO_SOON:
        // Quick warm orange shake / jolt
        this.stateLight.color.set(PALETTE.three.tooSoon);
        this.stateLight.intensity = 4.0;
        this.shakeIntensity = this.reducedMotion ? 0 : 0.45;

        this.shapes.forEach((s) => {
          s.targetScale = s.baseScale;
          s.targetRotSpeed = s.baseRotSpeed * 1.8;
          s.mesh.material.color.set(PALETTE.three.tooSoon);
          s.targetColor.set(PALETTE.three.tooSoon);
          s.mesh.material.emissive.set(PALETTE.three.tooSoon);
          s.targetEmissive.set(PALETTE.three.surface);
          s.mesh.material.emissiveIntensity = 0.8;
          s.targetEmissiveIntensity = 0.2;
        });
        break;

      case GAME_STATES.RESULT:
        const isNewBest = !!options.isNewBest;

        if (isNewBest) {
          // Celebratory gold burst
          this.stateLight.color.set(PALETTE.three.highlight);
          this.stateLight.intensity = 4.5;

          this.shapes.forEach((s) => {
            if (!this.reducedMotion) {
              s.currentScale = s.baseScale * 1.25;
              s.currentRotSpeed = s.baseRotSpeed * 3.0;
            }
            s.targetScale = s.baseScale;
            s.targetRotSpeed = s.baseRotSpeed;
            s.mesh.material.color.set(PALETTE.three.highlight);
            s.targetColor.set(PALETTE.three.highlight);
            s.mesh.material.emissive.set(PALETTE.three.highlight);
            s.targetEmissive.set(PALETTE.three.background);
            s.mesh.material.emissiveIntensity = 0.75;
            s.targetEmissiveIntensity = 0.25;
          });
        } else {
          // Clean return to settled state
          this.stateLight.color.set(PALETTE.three.lightWait);
          this.stateLight.intensity = 2.2;

          this.shapes.forEach((s) => {
            s.targetScale = s.baseScale;
            s.targetRotSpeed = s.baseRotSpeed;
            s.targetColor.set(PALETTE.three.surface);
            s.targetEmissive.set(PALETTE.three.background);
            s.targetEmissiveIntensity = 0.2;
          });
        }
        break;
    }
  }

  /**
   * Desktop mouse parallax listener.
   */
  bindEvents() {
    window.addEventListener('resize', this.onResize.bind(this));

    // Listen for reduced motion preference changes live
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
    });

    // Parallax on desktop pointermove
    window.addEventListener('pointermove', (e) => {
      if (this.reducedMotion) return;
      // Normalize to range [-1, 1]
      this.mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // Pause rendering loop when tab is hidden to save GPU & CPU cycles
    document.addEventListener('visibilitychange', () => {
      this.isPaused = document.hidden;
      if (!this.isPaused) {
        this.clock.start();
      }
    });
  }

  onResize() {
    if (!this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /**
   * Main WebGL animation loop.
   * Completely decoupled from the reaction timer to maintain timing fidelity.
   */
  animate() {
    requestAnimationFrame(this.animate);

    if (this.isPaused) return;

    const delta = Math.min(this.clock.getDelta(), 0.1); // Clamp large delta on tab return
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Smooth desktop parallax lerp
    if (!this.reducedMotion) {
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * (delta * 3.5);
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * (delta * 3.5);

      this.camera.position.x = this.mouse.x * 0.8;
      this.camera.position.y = this.mouse.y * 0.6;
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.position.set(0, 0, 14);
      this.camera.lookAt(0, 0, 0);
    }

    // 2. Shake decay for "Too soon!"
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    if (this.shakeIntensity > 0.001) {
      shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.lerp(this.shakeIntensity, 0, delta * 9);
    }

    // 3. Update each 3D shape
    const motionFactor = this.reducedMotion ? 0.15 : 1.0;

    this.shapes.forEach((item) => {
      // Rotation
      item.currentRotSpeed = THREE.MathUtils.lerp(
        item.currentRotSpeed,
        item.targetRotSpeed,
        delta * 3.0
      );

      const rotStep = item.currentRotSpeed * delta * motionFactor;
      item.mesh.rotation.x += rotStep * 0.7;
      item.mesh.rotation.y += rotStep * 1.0;
      item.mesh.rotation.z += rotStep * 0.4;

      // Gentle organic floating drift
      const floatX = Math.sin(elapsedTime * 0.7 + item.driftPhase) * (0.35 * motionFactor);
      const floatY = Math.cos(elapsedTime * 0.8 + item.driftPhase) * (0.45 * motionFactor);

      item.mesh.position.x = item.basePos.x + floatX + shakeOffsetX;
      item.mesh.position.y = item.basePos.y + floatY + shakeOffsetY;

      // Scale lerp
      item.currentScale = THREE.MathUtils.lerp(
        item.currentScale,
        item.targetScale,
        delta * 6.0
      );
      item.mesh.scale.setScalar(item.currentScale);

      // Material color and emissive lerp
      item.mesh.material.color.lerp(item.targetColor, delta * 5.0);
      item.mesh.material.emissive.lerp(item.targetEmissive, delta * 5.0);
      item.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(
        item.mesh.material.emissiveIntensity,
        item.targetEmissiveIntensity,
        delta * 5.0
      );
    });

    this.renderer.render(this.scene, this.camera);
  }
}
