/**
 * Core Game Controller & State Manager for Paper Toss 3D
 * Expansive Office Room Placement Edition (Synchronized Table, Chair, and Expansive Floor Space)
 */
class PaperTossGame {
  constructor() {
    // State
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('paper_toss_high_score') || '0', 10);
    this.streak = 0;
    this.currentModeKey = 'random'; // SHUFFLE is the default and only mode!

    // Mode Distance Ranges (Expansive Room Space: Z up to 16.0m, X up to +/-6.5m)
    this.modes = {
      random: { name: 'Wild Shuffle', minZ: 3.0, maxZ: 16.0, minX: -6.5, maxX: 6.5 }
    };

    this.currentBinX = 0;
    this.currentBinZ = 5.0;
    this.currentSurfaceY = -1.45;
    this.currentSurfaceType = 'floor'; // 'floor', 'table', 'chair'

    // Systems
    this.physics = null;
    this.renderer = null;
    this.controls = null;
    this.lastTime = 0;

    this.isResetting = false;

    this.init();
  }

  init() {
    const canvasContainer = document.getElementById('canvas-container');
    this.renderer = new GameRenderer(canvasContainer);
    this.physics = new PhysicsEngine();

    // Setup Physics Callbacks
    this.physics.onSwish = (hasRimHit) => this.handleSwish(hasRimHit);
    this.physics.onRimHit = () => {
      window.soundEngine.playRimHit();
      this.triggerHaptic('medium');
    };
    this.physics.onFloorHit = () => window.soundEngine.playFloorDrop();
    this.physics.onMiss = () => this.handleMiss();

    // Controls setup
    this.controls = new TouchControls(canvasContainer, (impulse) => {
      if (this.isResetting) return;
      window.soundEngine.init();
      this.physics.launchBall(impulse);
      window.soundEngine.playFlick();
      this.hideSwipeGuide();
    });

    // UI & Buttons Setup
    this.setupUI();
    this.repositionBin();
    this.updateHUD();

    // Attach Game Instance globally for renderer & controls access
    window.gameInstance = this;

    // Start Game Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupUI() {
    // Score HUD elements
    this.scoreValEl = document.getElementById('score-val');
    this.highScoreValEl = document.getElementById('highscore-val');
    this.streakBadgeEl = document.getElementById('streak-badge');
    this.streakCountEl = document.getElementById('streak-count');
    this.targetDistanceEl = document.getElementById('target-distance-val');
    this.targetSubEl = document.getElementById('target-offset-val');
    this.popupContainerEl = document.getElementById('popup-container');
    this.swipeGuideEl = document.getElementById('swipe-guide');

    // System Action Buttons
    const audioBtn = document.getElementById('audio-btn');
    const resetBtn = document.getElementById('reset-btn');
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const modalCloseBtn = document.getElementById('modal-close');
    const modalStartBtn = document.getElementById('modal-start-btn');

    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isMuted = window.soundEngine.toggleMute();
        audioBtn.textContent = isMuted ? '🔇' : '🔊';
        this.triggerHaptic('selection');
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.triggerHaptic('medium');
        this.score = 0;
        this.streak = 0;
        this.updateHUD();
        this.repositionBin();
        this.physics.resetBall();
        this.showPopup('RESET!', 'miss');
      });
    }

    if (helpBtn && helpModal) {
      helpBtn.addEventListener('click', () => {
        this.triggerHaptic('selection');
        helpModal.classList.add('active');
      });
    }

    if (modalCloseBtn && helpModal) {
      modalCloseBtn.addEventListener('click', () => {
        helpModal.classList.remove('active');
      });
    }

    if (modalStartBtn && helpModal) {
      modalStartBtn.addEventListener('click', () => {
        window.soundEngine.init();
        this.triggerHaptic('light');
        helpModal.classList.remove('active');
      });
    }
  }

  /* =========================================================================
   * EXPANSIVE BIN REPOSITIONING SYSTEM:
   * Placed dynamically across the expanded 36m x 40m room space:
   * - 25% Chance: Sitting flush ON TABLE TOP (X = 5.8m, Z = 8.5m, Y = -0.5m)
   * - 15% Chance: Sitting flush ON CHAIR SEAT (X = 5.8m, Z = 11.5m / 5.5m, Y = -1.0m)
   * - 60% Chance: Floor placement across expansive room area (Z = 3.0m - 16.0m, X = -6.5m - 6.5m)
   * ========================================================================= */
  repositionBin() {
    const config = this.modes.random;
    const rand = Math.random();

    let targetX, targetZ, surfaceY, surfaceType;

    // 25% Chance to place bin ON TABLE TOP (X = 5.8m, Z = 8.5m)
    if (rand < 0.25) {
      targetX = 5.8;
      targetZ = 8.5;
      surfaceY = -0.5; // Table top surface height
      surfaceType = 'table';
    } 
    // 15% Chance to place bin ON CHAIR SEAT (X = 5.8m, Z = 11.5m or 5.5m)
    else if (rand >= 0.25 && rand < 0.40) {
      targetX = 5.8;
      targetZ = Math.random() > 0.5 ? 11.5 : 5.5;
      surfaceY = -1.0; // Chair seat height
      surfaceType = 'chair';
    } 
    // 60% Chance to place bin ON EXPANSIVE FLOOR AREA
    else {
      targetZ = config.minZ + Math.random() * (config.maxZ - config.minZ);
      targetX = config.minX + Math.random() * (config.maxX - config.minX);
      surfaceY = -1.45;
      surfaceType = 'floor';
    }

    this.currentBinX = parseFloat(targetX.toFixed(2));
    this.currentBinZ = parseFloat(targetZ.toFixed(2));
    this.currentSurfaceY = surfaceY;
    this.currentSurfaceType = surfaceType;

    this.physics.setBinPosition(this.currentBinX, this.currentBinZ, surfaceY, surfaceType);
    this.renderer.updateTrashBinPosition(this.currentBinX, this.currentBinZ, surfaceY, 'office', surfaceType);

    this.updateTargetUI();
  }

  updateTargetUI() {
    if (this.targetDistanceEl) {
      this.targetDistanceEl.textContent = `${this.currentBinZ.toFixed(1)}m`;
    }

    if (this.targetSubEl) {
      let offsetStr = 'ON FLOOR';
      if (this.currentSurfaceType === 'table') {
        offsetStr = 'ON TABLE';
      } else if (this.currentSurfaceType === 'chair') {
        offsetStr = 'ON CHAIR';
      } else {
        const offX = this.currentBinX;
        if (Math.abs(offX) < 0.3) {
          offsetStr = 'CENTER';
        } else if (offX < 0) {
          offsetStr = `LEFT (${Math.abs(offX).toFixed(1)}m)`;
        } else {
          offsetStr = `RIGHT (${offX.toFixed(1)}m)`;
        }
      }
      this.targetSubEl.textContent = offsetStr;
    }
  }

  handleSwish(hasRimHit) {
    if (this.isResetting) return;

    this.score += hasRimHit ? 1 : 2;
    this.streak++;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('paper_toss_high_score', this.highScore.toString());
    }

    if (hasRimHit) {
      window.soundEngine.playScore();
      this.showPopup('RIM SHOT! +1', 'combo');
      this.triggerHaptic('medium');
    } else {
      window.soundEngine.playSwish();
      this.showPopup('SWISH! +2', 'swish');
      this.triggerHaptic('success');
    }

    this.renderer.triggerConfettiCelebration();
    this.updateHUD();

    this.isResetting = true;
    setTimeout(() => {
      this.repositionBin();
      this.physics.resetBall();
      this.isResetting = false;
    }, 1400);
  }

  handleMiss() {
    if (this.isResetting) return;

    window.soundEngine.playMiss();
    this.triggerHaptic('error');
    this.streak = 0;
    this.showPopup('MISS!', 'miss');
    this.updateHUD();

    this.isResetting = true;
    setTimeout(() => {
      this.physics.resetBall();
      this.isResetting = false;
    }, 1200);
  }

  updateHUD() {
    if (this.scoreValEl) this.scoreValEl.textContent = this.score;
    if (this.highScoreValEl) this.highScoreValEl.textContent = this.highScore;

    if (this.streakBadgeEl && this.streakCountEl) {
      if (this.streak > 1) {
        this.streakCountEl.textContent = this.streak;
        this.streakBadgeEl.style.display = 'flex';
      } else {
        this.streakBadgeEl.style.display = 'none';
      }
    }
  }

  showPopup(text, styleClass) {
    if (!this.popupContainerEl) return;
    this.popupContainerEl.innerHTML = '';
    const pop = document.createElement('div');
    pop.className = `popup-text ${styleClass} show`;
    pop.textContent = text;
    this.popupContainerEl.appendChild(pop);
  }

  hideSwipeGuide() {
    if (this.swipeGuideEl) {
      this.swipeGuideEl.style.opacity = '0';
    }
  }

  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    try {
      switch (type) {
        case 'light': navigator.vibrate(10); break;
        case 'medium': navigator.vibrate(25); break;
        case 'selection': navigator.vibrate(15); break;
        case 'success': navigator.vibrate([15, 30, 40]); break;
        case 'error': navigator.vibrate([40, 40, 40]); break;
      }
    } catch (e) {
      // Haptics unavailable
    }
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    // 1. Update Physics
    this.physics.update(dt);

    // 2. Update Controls Live Energy Meter
    if (this.controls) {
      this.controls.update(dt);
    }

    // 3. Render 3D Frame
    if (this.renderer) {
      this.renderer.update(this.physics, dt);
    }

    requestAnimationFrame((t) => this loop(t));
  }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
  window.paperTossGame = new PaperTossGame();
});
