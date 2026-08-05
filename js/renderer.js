/**
 * Three.js WebGL Scene Renderer for Paper Toss 3D
 * Classic Office Corridor / Hallway Environment Edition
 * Optimized specifically for 19.5:9 & 20:9 Portrait Smartphone Displays
 */
class GameRenderer {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Meshes & Groups
    this.paperBallMesh = null;
    this.ballShadowMesh = null;
    this.trashBinGroup = null;
    this.binFloorShadow = null;
    this.corridorEnvGroup = null;

    // Trajectory Arc Guide System
    this.trajectoryGroup = null;
    this.trajectoryDots = [];
    this.targetLandingRing = null;
    this.numTrajectoryDots = 14;

    // Active Surface & State
    this.currentSurfaceY = -1.45;

    // Camera Yaw-Follow & Player Orbit Offset
    this.baseLook = { y: -0.28, z: -5.0 };
    this.yawTargetX = 0;
    this.currentYawX = 0;
    this.yawOffset = 0;
    this.pitchOffset = 0;
    this.maxYawOffset = 0.65;
    this.maxPitchOffset = 0.35;

    // Table-Placement Visibility Boost
    this.currentSurfaceType = 'floor';
    this.elapsedTime = 0;
    this.binTableScale = 1.35;

    // Materials & Textures
    this.paperMaterial = null;
    this.notebookTexture = null;

    this.init();
  }

  init() {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.024);

    // 2. Perspective Camera tuned for Office Corridor Portrait framing
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.05, 100);
    this.updateCameraForAspect(aspect);

    // 3. WebGL Renderer with High-DPI & Logarithmic Depth support
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    // 4. Textures
    this.notebookTexture = this.generateRealisticNotebookTexture();

    // 5. Lighting System
    this.setupLighting();

    // 6. Build Office Corridor Scene Objects
    this.buildOfficeCorridorEnvironment();
    this.buildTrashBin();
    this.buildRealisticCompactPaperBall();
    this.buildParabolicTrajectoryGuide();

    // Window Resize Event
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onWindowResize(), 150);
    });
  }

  generateRealisticNotebookTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fcfdfe';
    ctx.fillRect(0, 0, 1024, 1024);

    const imgData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + grain));
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + grain));
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + grain));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
    ctx.lineWidth = 3;
    for (let y = 64; y < 1024; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 1024);
    ctx.stroke();

    ctx.fillStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('PAPER TOSS 3D', 180, 180);
    ctx.fillText('E = mc²', 180, 310);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /* =========================================================================
   * CORRIDOR CAMERA CALIBRATION FOR PORTRAIT SMARTPHONE SCREENS:
   * Frames the 4.0m wide hallway down its length, eliminating wide side gaps
   * and fitting 100% of the game area within modern 19.5:9 / 20:9 screens!
   * ========================================================================= */
  updateCameraForAspect(aspect) {
    if (aspect < 0.55) {
      // Smartphone Portrait (e.g. 360x760pt, iPhone 12-16)
      this.camera.fov = 58;
      this.camera.position.set(0, 0.38, 1.85);
      this.baseLook = { y: -0.28, z: -5.0 };
    } else if (aspect < 0.8) {
      // Standard Portrait
      this.camera.fov = 54;
      this.camera.position.set(0, 0.34, 1.75);
      this.baseLook = { y: -0.3, z: -5.0 };
    } else if (aspect >= 1.5) {
      // Widescreen Landscape
      this.camera.fov = 48;
      this.camera.position.set(0, 0.28, 1.55);
      this.baseLook = { y: -0.35, z: -5.2 };
    } else {
      this.camera.fov = 50;
      this.camera.position.set(0, 0.32, 1.65);
      this.baseLook = { y: -0.32, z: -5.0 };
    }

    this.applyCameraLook();
    this.camera.updateProjectionMatrix();
  }

  setBinFollowX(targetX) {
    this.yawTargetX = targetX * 0.12;
  }

  adjustCameraOffset(deltaYaw, deltaPitch) {
    this.yawOffset = Math.max(-this.maxYawOffset, Math.min(this.maxYawOffset, this.yawOffset + deltaYaw));
    this.pitchOffset = Math.max(-this.maxPitchOffset, Math.min(this.maxPitchOffset, this.pitchOffset + deltaPitch));
    this.applyCameraLook();
  }

  applyCameraLook() {
    const lookX = this.currentYawX + Math.sin(this.yawOffset);
    const lookY = this.baseLook.y + Math.sin(this.pitchOffset);
    const lookZ = this.baseLook.z;
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  setupLighting() {
    // Ambient warmth
    const ambientLight = new THREE.AmbientLight(0xfef3c7, 0.65);
    this.scene.add(ambientLight);

    // Primary hallway directional light
    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    dirLight.position.set(2, 8, 2);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 35;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 14;
    dirLight.shadow.camera.bottom = -6;
    dirLight.shadow.bias = -0.0003;
    dirLight.shadow.radius = 3;
    this.scene.add(dirLight);

    // Corridor accent lighting along the ceiling
    const ceilingLight = new THREE.PointLight(0x38bdf8, 0.8, 18);
    ceilingLight.position.set(0, 2.5, -8);
    this.scene.add(ceilingLight);
  }

  /* =========================================================================
   * CLASSIC 3D OFFICE CORRIDOR / HALLWAY DESIGN SYSTEM
   * Width: 4.2m, Height: 4.5m, Depth: 32.0m
   * Perfectly proportioned for tall narrow smartphone screens!
   * ========================================================================= */
  buildOfficeCorridorEnvironment() {
    this.corridorEnvGroup = new THREE.Group();

    // 1. Polished Corridor Floor (Width: 4.2m, Depth: 32m)
    const floorGeo = new THREE.PlaneGeometry(4.2, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.25
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.5, -14);
    floor.receiveShadow = true;
    this.corridorEnvGroup.add(floor);

    // Center Hallway Runner Carpet (Width: 1.8m)
    const runnerGeo = new THREE.PlaneGeometry(1.8, 30);
    const runnerMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.85,
      metalness: 0.02
    });
    const runner = new THREE.Mesh(runnerGeo, runnerMat);
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, -1.49, -14);
    runner.receiveShadow = true;
    this.corridorEnvGroup.add(runner);

    // 2. Ceiling (Width: 4.2m, Height: 3.0m)
    const ceilingGeo = new THREE.PlaneGeometry(4.2, 32);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 3.0, -14);
    this.corridorEnvGroup.add(ceiling);

    // Recessed LED Ceiling Light Strips down the hallway
    for (let z = -2; z >= -26; z -= 6) {
      const panelGeo = new THREE.BoxGeometry(0.8, 0.04, 1.8);
      const panelMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(0, 2.97, z);
      this.corridorEnvGroup.add(panel);
    }

    // 3. Left Wall (X = -2.1m)
    const leftWallGeo = new THREE.PlaneGeometry(32, 4.5);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.92 });
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-2.1, 0.75, -14);
    leftWall.receiveShadow = true;
    this.corridorEnvGroup.add(leftWall);

    // 4. Right Wall (X = 2.1m)
    const rightWallGeo = new THREE.PlaneGeometry(32, 4.5);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(2.1, 0.75, -14);
    rightWall.receiveShadow = true;
    this.corridorEnvGroup.add(rightWall);

    // 5. Back Corridor Wall (Z = -28.0m)
    const backWallGeo = new THREE.PlaneGeometry(4.2, 4.5);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 0.75, -28.0);
    backWall.receiveShadow = true;
    this.corridorEnvGroup.add(backWall);

    // Baseboards along corridor floor edges
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const baseLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 32), baseMat);
    baseLeft.position.set(-2.06, -1.41, -14);
    this.corridorEnvGroup.add(baseLeft);

    const baseRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 32), baseMat);
    baseRight.position.set(2.06, -1.41, -14);
    this.corridorEnvGroup.add(baseRight);

    // Office Doors along hallway walls
    this.buildOfficeDoors();

    // Side Furniture in Corridor (Table, Chairs, Water Cooler)
    this.buildSideFurniture();

    // Wall Framed Art & Signage
    this.buildWallDecorations();

    // 6. Compact Warm Wood Toss Ledge (X = 0, Z = -0.75m)
    const deskGeo = new THREE.BoxGeometry(0.8, 0.08, 0.45);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x6c3b17,
      roughness: 0.38,
      metalness: 0.08
    });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, -0.63, -0.75);
    desk.castShadow = true;
    desk.receiveShadow = true;
    this.corridorEnvGroup.add(desk);

    // Bevelled Warm Wood Trim
    const trimGeo = new THREE.BoxGeometry(0.84, 0.02, 0.03);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.25, metalness: 0.3 });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, -0.58, -0.52);
    this.corridorEnvGroup.add(trim);

    // Desk Legs
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
    [[-0.35, -1.08, -0.6], [0.35, -1.08, -0.6], [-0.35, -1.08, -0.9], [0.35, -1.08, -0.9]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...p);
      leg.castShadow = true;
      this.corridorEnvGroup.add(leg);
    });

    this.scene.add(this.corridorEnvGroup);
  }

  buildOfficeDoors() {
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });

    const createDoor = (x, z, isLeftWall) => {
      const doorGroup = new THREE.Group();

      const frameGeo = new THREE.BoxGeometry(0.06, 2.2, 1.1);
      const frame = new THREE.Mesh(frameGeo, doorFrameMat);
      doorGroup.add(frame);

      const panelGeo = new THREE.BoxGeometry(0.04, 2.1, 1.0);
      const panel = new THREE.Mesh(panelGeo, doorMat);
      panel.position.x = isLeftWall ? 0.02 : -0.02;
      doorGroup.add(panel);

      const knobGeo = new THREE.SphereGeometry(0.04, 12, 12);
      const knob = new THREE.Mesh(knobGeo, knobMat);
      knob.position.set(isLeftWall ? 0.06 : -0.06, 0, 0.38);
      doorGroup.add(knob);

      doorGroup.position.set(x, -0.35, z);
      this.corridorEnvGroup.add(doorGroup);
    };

    // Doors along Left Wall
    createDoor(-2.08, -6.0, true);
    createDoor(-2.08, -14.0, true);
    createDoor(-2.08, -22.0, true);

    // Doors along Right Wall
    createDoor(2.08, -10.0, false);
    createDoor(2.08, -18.0, false);

    // Back Center Corridor Double Door
    const backDoorGeo = new THREE.BoxGeometry(1.6, 2.3, 0.06);
    const backDoor = new THREE.Mesh(backDoorGeo, doorMat);
    backDoor.position.set(0, -0.3, -27.96);
    this.corridorEnvGroup.add(backDoor);
  }

  buildSideFurniture() {
    // 1. Corridor Side Table on Right (X = 1.3m, Z = -8.5m)
    const tableGroup = new THREE.Group();
    const topGeo = new THREE.BoxGeometry(0.9, 0.08, 2.2);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 });
    const top = new THREE.Mesh(topGeo, tableMat);
    top.position.y = 1.0;
    top.castShadow = true;
    top.receiveShadow = true;
    tableGroup.add(top);

    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    [[-0.35, 0.5, -0.9], [0.35, 0.5, -0.9], [-0.35, 0.5, 0.9], [0.35, 0.5, 0.9]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...p);
      leg.castShadow = true;
      tableGroup.add(leg);
    });

    tableGroup.position.set(1.3, -1.5, -8.5);
    this.corridorEnvGroup.add(tableGroup);

    // 2. Chairs beside Side Table
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    const createChair = (x, z, rotY) => {
      const chair = new THREE.Group();

      const seatGeo = new THREE.BoxGeometry(0.55, 0.06, 0.55);
      const seat = new THREE.Mesh(seatGeo, chairMat);
      seat.position.y = 0.5;
      seat.castShadow = true;
      chair.add(seat);

      const backGeo = new THREE.BoxGeometry(0.55, 0.5, 0.06);
      const back = new THREE.Mesh(backGeo, chairMat);
      back.position.set(0, 0.75, -0.25);
      back.castShadow = true;
      chair.add(back);

      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
      [[-0.22, 0.25, -0.22], [0.22, 0.25, -0.22], [-0.22, 0.25, 0.22], [0.22, 0.25, 0.22]].forEach(p => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...p);
        chair.add(leg);
      });

      chair.position.set(x, -1.5, z);
      chair.rotation.y = rotY;
      this.corridorEnvGroup.add(chair);
    };

    createChair(1.3, -11.5, 0);
    createChair(1.3, -5.5, Math.PI);

    // 3. Water Cooler on Left Side (X = -1.4m, Z = -10.0m)
    const coolerGroup = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.9, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.45;
    coolerGroup.add(body);

    const bottleGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.45, 16);
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1
    });
    const bottle = new THREE.Mesh(bottleGeo, bottleMat);
    bottle.position.y = 1.1;
    coolerGroup.add(bottle);

    coolerGroup.position.set(-1.4, -1.5, -10.0);
    this.corridorEnvGroup.add(coolerGroup);
  }

  buildWallDecorations() {
    // Framed Office Artwork on Corridor Walls
    const createArt = (x, z, rotY) => {
      const artGroup = new THREE.Group();
      const frameGeo = new THREE.BoxGeometry(1.4, 0.9, 0.04);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      artGroup.add(frame);

      const canvasGeo = new THREE.PlaneGeometry(1.3, 0.8);
      const canvasMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
      const canvas = new THREE.Mesh(canvasGeo, canvasMat);
      canvas.position.z = 0.022;
      artGroup.add(canvas);

      artGroup.position.set(x, 0.8, z);
      artGroup.rotation.y = rotY;
      this.corridorEnvGroup.add(artGroup);
    };

    createArt(-2.07, -10.0, Math.PI / 2);
    createArt(2.07, -14.0, -Math.PI / 2);
  }

  /* =========================================================================
   * CLASSIC WIREFRAME MESH TRASH BIN
   * ========================================================================= */
  buildTrashBin() {
    this.trashBinGroup = new THREE.Group();

    const binRadiusTop = 0.38;
    const binRadiusBottom = 0.28;
    const binHeight = 0.8;

    const binGeo = new THREE.CylinderGeometry(binRadiusTop, binRadiusBottom, binHeight, 24, 1, true);
    const binMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.35,
      metalness: 0.85,
      wireframe: true,
      side: THREE.DoubleSide
    });
    const binMesh = new THREE.Mesh(binGeo, binMat);
    binMesh.position.y = binHeight / 2;
    binMesh.castShadow = true;
    binMesh.receiveShadow = true;
    this.trashBinGroup.add(binMesh);

    const rimGeo = new THREE.TorusGeometry(binRadiusTop, 0.025, 12, 32);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.2,
      metalness: 0.95
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = binHeight;
    rimMesh.castShadow = true;
    this.trashBinGroup.add(rimMesh);

    const baseGeo = new THREE.CylinderGeometry(binRadiusBottom, binRadiusBottom, 0.04, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.02;
    baseMesh.receiveShadow = true;
    this.trashBinGroup.add(baseMesh);

    // Surface Contact Shadow Disc
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.65)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const binShadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const binShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    this.binFloorShadow = new THREE.Mesh(binShadowGeo, binShadowMat);
    this.binFloorShadow.rotation.x = -Math.PI / 2;
    this.binFloorShadow.position.y = 0.005;
    this.trashBinGroup.add(this.binFloorShadow);

    this.trashBinGroup.position.set(0, -1.5, -4.5);
    this.scene.add(this.trashBinGroup);
  }

  /* =========================================================================
   * 3D PARABOLIC TRAJECTORY ARC & LANDING RING
   * ========================================================================= */
  buildParabolicTrajectoryGuide() {
    this.trajectoryGroup = new THREE.Group();

    const dotGeo = new THREE.SphereGeometry(0.03, 12, 12);
    for (let i = 0; i < this.numTrajectoryDots; i++) {
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      this.trajectoryDots.push(dot);
      this.trajectoryGroup.add(dot);
    }

    const ringGeo = new THREE.TorusGeometry(0.36, 0.022, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85
    });
    this.targetLandingRing = new THREE.Mesh(ringGeo, ringMat);
    this.targetLandingRing.rotation.x = Math.PI / 2;
    this.trajectoryGroup.add(this.targetLandingRing);

    this.trajectoryGroup.visible = false;
    this.scene.add(this.trajectoryGroup);
  }

  updateTrajectoryArrow(powerPercent, impulse) {
    if (!this.trajectoryGroup) return;

    if (powerPercent > 2) {
      this.trajectoryGroup.visible = true;

      const gravity = 9.81;
      const drag = 0.12;
      const startX = this.paperBallMesh.position.x;
      const startY = this.paperBallMesh.position.y;
      const startZ = this.paperBallMesh.position.z;

      let vx = impulse.x;
      let vy = impulse.y;
      let vz = impulse.z;
      let px = startX;
      let py = startY;
      let pz = startZ;

      const totalSteps = 24;
      const timeStep = 0.035;

      const sampledPoints = [];
      for (let s = 0; s < totalSteps; s++) {
        vy -= gravity * timeStep;
        const dragFactor = 1 - drag * timeStep;
        vx *= dragFactor;
        vy *= dragFactor;
        vz *= dragFactor;

        px += vx * timeStep;
        py += vy * timeStep;
        pz += vz * timeStep;

        if (s % 2 === 0 && sampledPoints.length < this.numTrajectoryDots) {
          sampledPoints.push({ x: px, y: py, z: pz });
        }
      }

      for (let i = 0; i < this.numTrajectoryDots; i++) {
        const dot = this.trajectoryDots[i];
        if (i < sampledPoints.length) {
          dot.visible = true;
          dot.position.set(sampledPoints[i].x, sampledPoints[i].y, sampledPoints[i].z);
          const scaleRatio = 1.0 - (i / this.numTrajectoryDots) * 0.4;
          dot.scale.set(scaleRatio, scaleRatio, scaleRatio);
        } else {
          dot.visible = false;
        }
      }

      const lastPoint = sampledPoints.length > 0 ? sampledPoints[sampledPoints.length - 1] : { x: px, y: py, z: pz };
      this.targetLandingRing.position.set(lastPoint.x, this.trashBinGroup.position.y + 0.8, lastPoint.z);

      const targetBinX = this.trashBinGroup.position.x;
      const targetBinZ = this.trashBinGroup.position.z;
      const distToBinCenter = Math.sqrt(Math.pow(lastPoint.x - targetBinX, 2) + Math.pow(lastPoint.z - (-targetBinZ), 2));

      let arcColor = 0x38bdf8;
      if (distToBinCenter < 0.28) {
        arcColor = 0x10b981; // Emerald Green Swish
      } else if (distToBinCenter < 0.42) {
        arcColor = 0xf59e0b; // Amber Rim Bounce
      }

      this.targetLandingRing.material.color.setHex(arcColor);
      this.trajectoryDots.forEach(dot => dot.material.color.setHex(arcColor));

    } else {
      this.trajectoryGroup.visible = false;
    }
  }

  hideTrajectoryArrow() {
    if (this.trajectoryGroup) {
      this.trajectoryGroup.visible = false;
    }
  }

  /* ----------------------------------------------------
   * REALISTIC COMPACT PAPER BALL (0.05 RADIUS)
   * ---------------------------------------------------- */
  buildRealisticCompactPaperBall() {
    const baseGeo = new THREE.IcosahedronGeometry(0.05, 3);
    const posAttr = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const foldNoise = (Math.sin(vertex.x * 35) * Math.cos(vertex.z * 35) + Math.sin(vertex.y * 35)) * 0.011;
      const crinkleNoise = (Math.sin(vertex.x * 80 + vertex.y * 80) + Math.cos(vertex.z * 80)) * 0.006;
      const totalDisplacement = foldNoise + crinkleNoise;
      vertex.addScaledVector(vertex.clone().normalize(), totalDisplacement);
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    baseGeo.computeVertexNormals();

    this.paperMaterial = new THREE.MeshPhysicalMaterial({
      map: this.notebookTexture,
      bumpMap: this.notebookTexture,
      bumpScale: 0.045,
      roughness: 0.88,
      metalness: 0.0,
      clearcoat: 0.15,
      clearcoatRoughness: 0.65,
      color: 0xfdfbf5
    });

    this.paperBallMesh = new THREE.Mesh(baseGeo, this.paperMaterial);
    this.paperBallMesh.castShadow = true;
    this.paperBallMesh.receiveShadow = true;
    
    this.paperBallMesh.position.set(0, -0.55, -0.75);
    this.scene.add(this.paperBallMesh);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.3)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    this.ballShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.ballShadowMesh.rotation.x = -Math.PI / 2;
    this.ballShadowMesh.position.set(0, -0.57, -0.75);
    this.scene.add(this.ballShadowMesh);
  }

  updateTrashBinPosition(targetX, targetZ, surfaceY = -1.45, environmentTheme = 'corridor', surfaceType = 'floor') {
    this.currentSurfaceY = surfaceY;
    this.currentSurfaceType = surfaceType;
    this.trashBinGroup.position.set(targetX, surfaceY, -targetZ);
    this.setBinFollowX(targetX);
  }

  update(physicsEngine, dt) {
    this.elapsedTime += dt;

    // Smoothly pan camera towards bin target
    this.currentYawX += (this.yawTargetX - this.currentYawX) * Math.min(1, dt * 3.5);
    this.applyCameraLook();

    // Bin table visibility scaling
    const targetBinScale = this.currentSurfaceType === 'table'
      ? this.binTableScale + Math.sin(this.elapsedTime * 3.2) * 0.045
      : 1.0;
    const currentScale = this.trashBinGroup.scale.x;
    const nextScale = currentScale + (targetBinScale - currentScale) * Math.min(1, dt * 6);
    this.trashBinGroup.scale.setScalar(nextScale);

    // Update Paper Ball Mesh Position & Rotation
    this.paperBallMesh.position.set(
      physicsEngine.position.x,
      physicsEngine.position.y,
      physicsEngine.position.z
    );
    this.paperBallMesh.rotation.set(
      physicsEngine.rotation.x,
      physicsEngine.rotation.y,
      physicsEngine.rotation.z
    );

    // Update Table Contact Shadow
    if (this.ballShadowMesh) {
      if (physicsEngine.state === 'IDLE') {
        this.ballShadowMesh.position.set(physicsEngine.position.x, -0.57, physicsEngine.position.z);
        this.ballShadowMesh.material.opacity = 1.0;
      } else {
        const heightAboveTable = physicsEngine.position.y - (-0.55);
        this.ballShadowMesh.material.opacity = Math.max(0, 1.0 - heightAboveTable * 4.0);
      }
    }

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  triggerConfettiCelebration() {
    const confettiCount = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(confettiCount * 3);
    const colors = new Float32Array(confettiCount * 3);

    const palette = [0x3b82f6, 0xf59e0b, 0x10b981, 0xec4899, 0x8b5cf6];

    for (let i = 0; i < confettiCount; i++) {
      const idx = i * 3;
      positions[idx] = this.trashBinGroup.position.x + (Math.random() - 0.5) * 0.8;
      positions[idx + 1] = this.trashBinGroup.position.y + 0.8 + Math.random() * 0.5;
      positions[idx + 2] = this.trashBinGroup.position.z + (Math.random() - 0.5) * 0.8;

      const color = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 1
    });

    const confettiMesh = new THREE.Points(geo, mat);
    this.scene.add(confettiMesh);

    let elapsed = 0;
    const animateConfetti = () => {
      elapsed += 0.03;
      mat.opacity = 1 - elapsed / 1.5;
      const posArr = geo.attributes.position.array;
      for (let i = 1; i < posArr.length; i += 3) {
        posArr[i] -= 0.015;
      }
      geo.attributes.position.needsUpdate = true;

      if (elapsed < 1.5) {
        requestAnimationFrame(animateConfetti);
      } else {
        this.scene.remove(confettiMesh);
      }
    };
    animateConfetti();
  }

  onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.updateCameraForAspect(aspect);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.GameRenderer = GameRenderer;
