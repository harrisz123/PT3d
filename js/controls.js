/**
 * Touch Swipe & Mouse Flick Controls for Paper Toss 3D
 * Instant Directional Trajectory Tracking & Sustained Energy Meter Edition
 */
class TouchControls {
  constructor(canvasContainer, onFlickCallback) {
    this.container = canvasContainer;
    this.onFlick = onFlickCallback;

    this.isDragging = false;
    this.touchStart = { x: 0, y: 0, time: 0 };
    this.touchEnd = { x: 0, y: 0, time: 0 };
    this.trackPoints = [];

    this.enabled = true;
    this.hideTimeout = null;

    // Two-Finger Camera Orbit State
    this.isOrbiting = false;
    this.orbitLast = { x: 0, y: 0 };
    this.orbitSensitivity = 0.0032; // radians per pixel dragged

    // Smoothed Impulse for smooth rendering
    this.smoothImpulse = { x: 0, y: 0, z: 0 };
    this.smoothPowerPercent = 0;

    // Energy Meter DOM Elements
    this.meterHud = document.getElementById('energy-meter');
    this.meterFill = document.getElementById('meter-fill');
    this.meterPercent = document.getElementById('meter-percent');
    this.meterEst = document.getElementById('meter-dist-est');

    this.initListeners();
  }

  initListeners() {
    // Mouse Events
    this.container.addEventListener('mousedown', (e) => this.handleStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => this.handleMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', (e) => this.handleEnd(e.clientX, e.clientY));

    // Touch Events
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length >= 2) {
        // Two fingers = camera orbit. Cancel any single-finger flick drag
        // in progress so lifting fingers afterward doesn't launch a throw.
        this.isDragging = false;
        this.isOrbiting = true;
        this.orbitLast = this.getTouchMidpoint(e.touches);
        this.hideEnergyMeter(0);
        if (window.gameInstance && window.gameInstance.renderer) {
          window.gameInstance.renderer.hideTrajectoryArrow();
        }
      } else if (e.touches.length === 1 && !this.isOrbiting) {
        this.handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isOrbiting && e.touches.length >= 2) {
        const mid = this.getTouchMidpoint(e.touches);
        const dx = mid.x - this.orbitLast.x;
        const dy = mid.y - this.orbitLast.y;
        this.orbitLast = mid;

        if (window.gameInstance && window.gameInstance.renderer) {
          window.gameInstance.renderer.adjustCameraOffset(
            -dx * this.orbitSensitivity,
            dy * this.orbitSensitivity
          );
        }
        return;
      }
      if (e.touches.length > 0 && this.isDragging) {
        this.handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.isOrbiting = false;
      }
      if (this.isOrbiting) return;
      if (e.changedTouches.length > 0) {
        this.handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    }, { passive: true });
  }

  getTouchMidpoint(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  handleStart(x, y) {
    if (!this.enabled) return;
    if (y < window.innerHeight * 0.3) return;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.isDragging = true;
    const now = performance.now();
    this.touchStart = { x, y, time: now };
    this.trackPoints = [{ x, y, time: now }];

    this.smoothImpulse = { x: 0, y: 0, z: 0 };
    this.smoothPowerPercent = 0;

    this.showEnergyMeter();
  }

  handleMove(x, y) {
    if (!this.isDragging) return;
    const now = performance.now();
    this.trackPoints.push({ x, y, time: now });

    if (this.trackPoints.length > 4) {
      this.trackPoints.shift();
    }

    // Instantaneous Directional Trajectory Tracking
    const aspect = window.innerWidth / window.innerHeight;
    
    // Direct lateral X displacement from start touch point for instant responsiveness
    const deltaX = x - this.touchStart.x;
    const deltaY = this.touchStart.y - y; // upward displacement

    // Calculate recent velocity for Z impulse
    const pFirst = this.trackPoints[0];
    const pLast = this.trackPoints[this.trackPoints.length - 1];
    const dt = Math.max(10, pLast.time - pFirst.time);
    const speedY = ((pFirst.y - pLast.y) / dt) * 1000;

    // Instant Lateral Impulse X (responds immediately when changing drag direction)
    const targetImpulseX = (deltaX / (window.innerWidth * 0.4)) * 4.5 * aspect;

    // Upward Impulse Y & Forward Impulse Z
    const targetImpulseY = Math.min(Math.max((Math.max(deltaY, speedY) / 1000) * 3.8 + 2.5, 4.2), 9.0);
    const targetImpulseZ = -Math.min(Math.max((Math.max(deltaY * 2, speedY) / 1000) * 6.5 + 4.5, 5.5), 16.0);

    // Fast responsive lerp (alpha = 0.5) so direction switches instantly
    const alpha = 0.5;
    this.smoothImpulse.x += (targetImpulseX - this.smoothImpulse.x) * alpha;
    this.smoothImpulse.y += (targetImpulseY - this.smoothImpulse.y) * alpha;
    this.smoothImpulse.z += (targetImpulseZ - this.smoothImpulse.z) * alpha;

    // Calculate Power Ratio & Distance
    const targetPowerRatio = Math.min(1.0, Math.max(0.0, (Math.max(deltaY * 2, speedY) - 150) / 1800));
    const targetPowerPercent = Math.round(targetPowerRatio * 100);
    this.smoothPowerPercent += (targetPowerPercent - this.smoothPowerPercent) * alpha;

    const displayPercent = Math.round(this.smoothPowerPercent);
    const estDistance = Math.abs(this.smoothImpulse.z * 0.72);

    this.updateEnergyMeter(displayPercent, estDistance);

    // Update 3D Parabolic Trajectory Arc (instantly pivots with finger motion)
    if (window.gameInstance && window.gameInstance.renderer) {
      window.gameInstance.renderer.updateTrajectoryArrow(displayPercent, this.smoothImpulse);
    }
  }

  handleEnd(x, y) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const now = performance.now();
    this.touchEnd = { x, y, time: now };

    const deltaY = this.touchStart.y - y;
    const totalDuration = now - this.touchStart.time;

    if (deltaY > 30 && totalDuration < 550) {
      const finalImpulse = {
        x: this.smoothImpulse.x,
        y: this.smoothImpulse.y,
        z: this.smoothImpulse.z
      };

      this.triggerHaptic('light');

      if (this.onFlick) {
        this.onFlick(finalImpulse);
      }
    }

    // Hide Trajectory Arc on Launch
    if (window.gameInstance && window.gameInstance.renderer) {
      window.gameInstance.renderer.hideTrajectoryArrow();
    }

    // Keep Energy Meter Visible Post-Launch for 1.4 seconds
    this.hideEnergyMeter(1400);
  }

  showEnergyMeter() {
    if (this.meterHud) this.meterHud.classList.add('active');
  }

  updateEnergyMeter(percent, estDistance) {
    if (this.meterFill) {
      this.meterFill.style.width = `${percent}%`;

      if (percent > 85) {
        this.meterFill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        this.meterFill.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.8)';
      } else if (percent > 50) {
        this.meterFill.style.background = 'linear-gradient(90deg, #10b981, #f59e0b)';
        this.meterFill.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.6)';
      } else {
        this.meterFill.style.background = 'linear-gradient(90deg, #38bdf8, #3b82f6)';
        this.meterFill.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.6)';
      }
    }

    if (this.meterPercent) this.meterPercent.textContent = `${percent}%`;
    if (this.meterEst) this.meterEst.textContent = `EST. ${estDistance.toFixed(1)}m`;
  }

  hideEnergyMeter(delayMs = 1400) {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (this.meterHud) this.meterHud.classList.remove('active');
    }, delayMs);
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

  setEnabled(state) {
    this.enabled = state;
  }
}

window.TouchControls = TouchControls;
