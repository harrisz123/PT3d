/**
 * 3D Physics Simulation Engine for Paper Toss 3D
 * Compact Paper Ball & Spacious Environment Edition
 */
class PhysicsEngine {
  constructor() {
    this.gravity = 9.81;
    this.airDrag = 0.12;
    this.ballRadius = 0.075; // Decreased compact paper ball radius
    
    // Ball Start Position - Resting flush on top of table surface (Y = -0.405)
    this.startPos = { x: 0, y: -0.405, z: -0.45 };

    // Ball State
    this.position = { ...this.startPos };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.angularVelocity = { x: 0, y: 0, z: 0 };
    
    this.state = 'IDLE'; // IDLE, FLYING, BOUNCING, SCORED, MISSED
    this.flightTime = 0;
    this.hasRimHit = false;
    this.rimHitCount = 0;

    // Dynamic Trash Bin Target Location & Surface Height
    this.binTarget = {
      x: 0,
      y: -1.45,
      z: -4.5,
      rimY: -0.65,
      rimRadius: 0.38,
      rimHeight: 0.8,
      surfaceY: -1.45,
      surfaceType: 'floor'
    };

    // Callback handlers
    this.onSwish = null;
    this.onRimHit = null;
    this.onFloorHit = null;
    this.onMiss = null;
  }

  setBinPosition(targetX, targetZ, surfaceY = -1.45, surfaceType = 'floor') {
    this.binTarget.x = targetX;
    this.binTarget.z = -targetZ;
    this.binTarget.surfaceY = surfaceY;
    this.binTarget.rimY = surfaceY + this.binTarget.rimHeight;
    this.binTarget.surfaceType = surfaceType;
    this.resetBall();
  }

  resetBall() {
    this.position = { ...this.startPos };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.angularVelocity = { x: 0, y: 0, z: 0 };
    this.state = 'IDLE';
    this.flightTime = 0;
    this.hasRimHit = false;
    this.rimHitCount = 0;
  }

  launchBall(impulse) {
    if (this.state !== 'IDLE') return;
    this.velocity = { x: impulse.x, y: impulse.y, z: impulse.z };
    this.angularVelocity = {
      x: (Math.random() - 0.5) * 12,
      y: (Math.random() - 0.5) * 8,
      z: impulse.x * -1.5
    };
    this.state = 'FLYING';
    this.flightTime = 0;
  }

  update(dt) {
    if (this.state === 'IDLE') return;

    const subDt = Math.min(dt, 0.02);
    this.flightTime += subDt;

    // Apply spin rotation
    this.rotation.x += this.angularVelocity.x * subDt;
    this.rotation.y += this.angularVelocity.y * subDt;
    this.rotation.z += this.angularVelocity.z * subDt;

    if (this.state === 'FLYING' || this.state === 'BOUNCING') {
      // Apply forces: Gravity & Drag
      this.velocity.y -= this.gravity * subDt;

      // Air resistance
      const drag = 1 - this.airDrag * subDt;
      this.velocity.x *= drag;
      this.velocity.y *= drag;
      this.velocity.z *= drag;

      // Update position
      const prevPos = { ...this.position };
      this.position.x += this.velocity.x * subDt;
      this.position.y += this.velocity.y * subDt;
      this.position.z += this.velocity.z * subDt;

      // Check collision logic
      this.checkCollisions(prevPos);
    } else if (this.state === 'SCORED') {
      // Ball dropping inside basket
      const binBottomY = this.binTarget.surfaceY + 0.05;
      if (this.position.y > binBottomY) {
        this.position.y -= 2.0 * subDt;
        this.velocity.x *= 0.3;
        this.velocity.z *= 0.3;
      }
    }
  }

  checkCollisions(prevPos) {
    const rimY = this.binTarget.rimY;
    const rimZ = this.binTarget.z;
    const rimX = this.binTarget.x;
    const rimRadius = this.binTarget.rimRadius;

    const dx = this.position.x - rimX;
    const dz = this.position.z - rimZ;
    const distXZ = Math.sqrt(dx * dx + dz * dz);

    // 1. BASKET ENTRY CHECK
    if (this.state === 'FLYING' && prevPos.y >= rimY && this.position.y <= rimY) {
      if (Math.abs(this.position.z - rimZ) < 0.45 && distXZ < rimRadius - 0.04) {
        // CLEAN SWISH SCORE!
        this.state = 'SCORED';
        this.velocity.x *= 0.1;
        this.velocity.z *= 0.1;
        this.velocity.y = -0.6;
        if (this.onSwish) this.onSwish(this.hasRimHit);
        return;
      }
    }

    // 2. BIN RIM COLLISION
    const rimYMin = rimY - 0.15;
    const rimYMax = rimY + 0.15;

    if ((this.state === 'FLYING' || this.state === 'BOUNCING') &&
        Math.abs(this.position.z - rimZ) < 0.38 &&
        this.position.y >= rimYMin && this.position.y <= rimYMax) {
      
      const rimEdgeDist = Math.abs(distXZ - rimRadius);
      if (rimEdgeDist < this.ballRadius + 0.02) {
        this.state = 'BOUNCING';
        this.hasRimHit = true;
        this.rimHitCount++;

        const nx = distXZ > 0 ? dx / distXZ : 1;
        const nz = distXZ > 0 ? dz / distXZ : 0;

        const dot = this.velocity.x * nx + this.velocity.z * nz;
        const restitution = 0.55;

        this.velocity.x = (this.velocity.x - (1 + restitution) * dot * nx) * 0.75;
        this.velocity.z = (this.velocity.z - (1 + restitution) * dot * nz) * 0.75;
        this.velocity.y = Math.abs(this.velocity.y) * 0.45 + 1.2;

        if (this.onRimHit && this.rimHitCount <= 3) {
          this.onRimHit();
        }
      }
    }

    // 3. SURFACE / FLOOR COLLISION
    let collisionY = -1.45 + this.ballRadius;

    if (Math.abs(this.position.x - 6.5) < 1.8 && Math.abs(this.position.z - (-9.0)) < 2.0) {
      collisionY = -0.5 + this.ballRadius; // Table top surface height
    } else if (Math.abs(this.position.x - 6.5) < 1.0 && 
               (Math.abs(this.position.z - (-12.0)) < 1.0 || Math.abs(this.position.z - (-6.0)) < 1.0)) {
      collisionY = -1.0 + this.ballRadius; // Chair seat height
    }

    if (this.position.y <= collisionY) {
      this.position.y = collisionY;
      
      if (Math.abs(this.velocity.y) > 0.8 && this.state !== 'MISSED') {
        this.velocity.y = -this.velocity.y * 0.35;
        this.velocity.x *= 0.55;
        this.velocity.z *= 0.55;
        if (this.onFloorHit) this.onFloorHit();
      } else {
        this.velocity = { x: 0, y: 0, z: 0 };
        this.angularVelocity = { x: 0, y: 0, z: 0 };
        if (this.state !== 'SCORED' && this.state !== 'MISSED') {
          this.state = 'MISSED';
          if (this.onMiss) this.onMiss();
        }
      }
    }

    // 4. OUT OF BOUNDS SAFETY RESET
    if (this.position.z < -32 || Math.abs(this.position.x) > 22) {
      if (this.state !== 'SCORED' && this.state !== 'MISSED') {
        this.state = 'MISSED';
        if (this.onMiss) this.onMiss();
      }
    }
  }
}

window.PhysicsEngine = PhysicsEngine;
