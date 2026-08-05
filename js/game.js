/**
 * Core Game Controller & State Manager for Paper Toss 3D
 * Classic Office Wild Shuffle Edition (Table, Chair, and Floor Surface Placement)
 */
class PaperTossGame {
  constructor() {
    // State
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('paper_toss_high_score') || '0', 10);
    this.streak = 0;
    this.currentModeKey = 'random'; // SHUFFLE is the default and only mode!

    // Mode Distance Ranges (Wild Shuffle across full room space)
    this.modes = {
      random: { name: 'Wild Shuffle', minZ: 3.2, maxZ: 10.5, minX: -3.0, maxX: 5.2 }
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

    // Start Game Loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  triggerHaptic(type) {
    if (navigator && typeof navigator.vibrate === 'function') {
      try {
        if (type === 'light') navigator.vibrate(15);
        else if (type === 'medium') navigator.vibrate(35);
        else if (type === 'score') navigator.vibrate([40, 50, 60]);
        else if (type === 'miss') navigator.vibrate([50, 30, 50]);
      } catch (e) {}
    }
  }

  setupUI() {
    // Sound Mute Toggle
    const audioBtn = document.getElementById('audio-btn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        window.soundEngine.init();
        this.triggerHaptic('light');
        const isMuted = window.soundEngine.toggleMute();
        audioBtn.innerHTML = isMuted ? '🔇' : '🔊';
      });
    }

    // Reset Game Button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.score = 0;
        this.streak = 0;
        this.triggerHaptic('light');
        this.updateHUD();
        this.physics.resetBall();
        this.repositionBin();
        this.showPopup('GAME RESET', 'combo');
      });
    }

    // Help Modal Triggers
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const modalClose = document.getElementById('modal-close');
    const modalStart = document.getElementById('modal-start-btn');

    if (helpBtn && helpModal) {
      helpBtn.addEventListener('click', () => {
        this.triggerHaptic('light');
        helpModal.classList.add('active');
      });
    }
    if (modalClose && helpModal) {
      modalClose.addEventListener('click', () => helpModal.classList.remove('active'));
    }
    if (modalStart && helpModal) {
      modalStart.addEventListener('click', () => {
        window.soundEngine.init();
        this.triggerHaptic('light');
        helpModal.classList.remove('active');
      });
    }
  }

  repositionBin() {
    const config = this.modes.random;
    const rand = Math.random();

    let targetX, targetZ, surfaceY, surfaceType;

    // 25% Chance to place bin ON TABLE TOP
    if (rand < 0.25) {
      targetX = 4.5;
      targetZ = 6.5;
      surfaceY = -0.5; // Table top surface height
      surfaceType = 'table';
    } 
    // 15% Chance to place bin ON CHAIR SEAT
    else if (rand >= 0.25 && rand < 0.40) {
      targetX = 4.5;
      targetZ = Math.random() > 0.5 ? 9.0 : 4.0;
      surfaceY = -1.0; // Chair seat height
      surfaceType = 'chair';
    } 
    // Otherwise place bin ON FLOOR
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
    const distanceEl = document.getElementById('target-distance-val');
    const offsetEl = document.getElementById('target-offset-val');

    if (distanceEl) distanceEl.textContent = `${this.currentBinZ.toFixed(1)}m`;
    if (offsetEl) {
      let locationText = 'ON FLOOR';
      if (this.currentSurfaceType === 'table') locationText = 'ON TABLE 🛋️';
      else if (this.currentSurfaceType === 'chair') locationText = 'ON CHAIR 🪑';
      else {
        const side = this.currentBinX > 0.2 ? 'RIGHT' : (this.currentBinX < -0.2 ? 'LEFT' : 'CENTER');
        locationText = `${side} (${Math.abs(this.currentBinX).toFixed(1)}m)`;
      }
      offsetEl.textContent = locationText;
    }
  }

  handleSwish(hasRimHit) {
    if (this.isResetting) return;
    this.isResetting = true;

    this.score++;
    this.streak++;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('paper_toss_high_score', this.highScore.toString());
    }

    window.soundEngine.playSwish();
    this.triggerHaptic('score');

    if (this.streak >= 3) {
      this.showPopup(`STREAK x${this.streak}!`, 'combo');
      window.soundEngine.playCheer();
      this.renderer.triggerConfettiCelebration();
    } else if (hasRimHit) {
      this.showPopup('BANK SHOT! +1', 'swish');
    } else {
      this.showPopup('SWISH! +1', 'swish');
    }

    this.updateHUD();

    setTimeout(() => {
      this.repositionBin();
      this.isResetting = false;
    }, 1200);
  }

  handleMiss() {
    if (this.isResetting) return;
    this.isResetting = true;

    this.streak = 0;
    this.showPopup('MISS!', 'miss');
    this.triggerHaptic('miss');
    this.updateHUD();

    setTimeout(() => {
      this.repositionBin();
      this.isResetting = false;
    }, 1400);
  }

  updateHUD() {
    const scoreEl = document.getElementById('score-val');
    const highScoreEl = document.getElementById('highscore-val');
    const streakBadge = document.getElementById('streak-badge');
    const streakCount = document.getElementById('streak-count');

    if (scoreEl) scoreEl.textContent = this.score;
    if (highScoreEl) highScoreEl.textContent = this.highScore;

    if (streakBadge && streakCount) {
      if (this.streak >= 2) {
        streakCount.textContent = this.streak;
        streakBadge.style.display = 'flex';
      } else {
        streakBadge.style.display = 'none';
      }
    }
  }

  showPopup(text, type = 'swish') {
    const popupContainer = document.getElementById('popup-container');
    if (!popupContainer) return;

    popupContainer.innerHTML = `<div class="popup-text ${type} show">${text}</div>`;
    setTimeout(() => {
      popupContainer.innerHTML = '';
    }, 1200);
  }

  hideSwipeGuide() {
    const guide = document.getElementById('swipe-guide');
    if (guide) guide.style.display = 'none';
  }

  gameLoop(currentTime) {
    if (!this.lastTime) this.lastTime = currentTime;
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.physics.update(dt);
    this.renderer.update(this.physics, dt);

    requestAnimationFrame((time) => this.gameLoop(time));
  }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new PaperTossGame();
});
