/**
 * Three.js WebGL Scene Renderer for Paper Toss 3D
 * 100% Mobile Browser Compatibility Edition
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
    this.officeEnvGroup = null;

    // Trajectory Arc Guide System
    this.trajectoryGroup = null;
    this.trajectoryDots = [];
    this.targetLandingRing = null;
    this.numTrajectoryDots = 14;

    // Active Surface & State
    this.currentSurfaceY = -1.45;

    // Materials & Textures
    this.paperMaterial = null;
    this.notebookTexture = null;

    this.init();
  }

  init() {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e293b);
    this.scene.fog = new THREE.FogExp2(0x1e293b, 0.028);

    // 2. Camera setup with dynamic aspect calculation for mobile viewports
    const aspect = window.innerWidth / window.innerHeight;
    const initialFov = aspect < 0.55 ? 64 : (aspect < 0.8 ? 60 : 52);
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 70);
    this.updateCameraForAspect(aspect);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container.appendChild(this.renderer.domElement);

    // 4. Textures
    this.notebookTexture = this.generateRealisticNotebookTexture();

    // 5. Lights
    this.setupLighting();

    // 6. Build Scene Objects
    this.buildExpansiveOfficeEnvironment();
    this.buildTrashBin();
    this.buildRealisticPaperBall();
    this.buildParabolicTrajectoryGuide();

    // Window Resize Event
    window.addEventListener('resize', () => this.onWindowResize());
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
    ctx.fillText('Score: 100%', 180, 440);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  updateCameraForAspect(aspect) {
    if (aspect < 0.55) {
      // Tall Narrow Phone Screen (e.g. iPhone 15/14, Galaxy S24)
      this.camera.fov = 64;
      this.camera.position.set(0, 0.2, 0.85);
      this.camera.lookAt(0, -0.3, -4.5);
    } else if (aspect < 0.8) {
      // Standard Mobile Portrait Viewport
      this.camera.fov = 60;
      this.camera.position.set(0, 0.15, 0.75);
      this.camera.lookAt(0, -0.35, -4.5);
    } else {
      // Desktop / Tablet Landscape Viewport
      this.camera.fov = 52;
      this.camera.position.set(0, 0.1, 0.65);
      this.camera.lookAt(0, -0.4, -4.5);
    }
    this.camera.updateProjectionMatrix();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xfef3c7, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    dirLight.position.set(4, 10, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 35;
    dirLight.shadow.camera.left = -14;
    dirLight.shadow.camera.right = 14;
    dirLight.shadow.camera.top = 14;
    dirLight.shadow.camera.bottom = -6;
    dirLight.shadow.bias = -0.0003;
    dirLight.shadow.radius = 3;
    this.scene.add(dirLight);

    const windowLight = new THREE.DirectionalLight(0x60a5fa, 0.55);
    windowLight.position.set(-8, 5, -4);
    this.scene.add(windowLight);
  }

  /* =========================================================================
   * EXPANSIVE OPEN OFFICE ENVIRONMENT (36m x 40m Room Area)
   * ========================================================================= */
  buildExpansiveOfficeEnvironment() {
    this.officeEnvGroup = new THREE.Group();

    const floorGeo = new THREE.PlaneGeometry(36, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.5, -12);
    floor.receiveShadow = true;
    this.officeEnvGroup.add(floor);

    const baseboardGeo = new THREE.BoxGeometry(36, 0.18, 0.06);
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const baseboard = new THREE.Mesh(baseboardGeo, baseboardMat);
    baseboard.position.set(0, -1.41, -27.97);
    this.officeEnvGroup.add(baseboard);

    const wallGeo = new THREE.PlaneGeometry(36, 18);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 7.5, -28);
    backWall.receiveShadow = true;
    this.officeEnvGroup.add(backWall);

    const leftWallGeo = new THREE.PlaneGeometry(40, 18);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-18, 7.5, -12);
    leftWall.receiveShadow = true;
    this.officeEnvGroup.add(leftWall);

    const rightWallGeo = new THREE.PlaneGeometry(40, 18);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(18, 7.5, -12);
    rightWall.receiveShadow = true;
    this.officeEnvGroup.add(rightWall);

    const deskGeo = new THREE.BoxGeometry(2.8, 0.06, 0.6);
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.35, metalness: 0.1 });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, -0.48, -0.45);
    desk.castShadow = true;
    desk.receiveShadow = true;
    this.officeEnvGroup.add(desk);

    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    [[-1.35, -0.98, -0.2], [1.35, -0.98, -0.2], [-1.35, -0.98, -0.7], [1.35, -0.98, -0.7]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...p);
      leg.castShadow = true;
      this.officeEnvGroup.add(leg);
    });

    this.buildRightSideTable();
    this.buildChairsAroundTable();
    this.buildCoffeeMug();
    this.buildDeskAccessories();
    this.buildOfficePoster();
    this.buildOfficeWindow();

    this.scene.add(this.officeEnvGroup);
  }

  buildRightSideTable() {
    const tableGroup = new THREE.Group();
    const topGeo = new THREE.BoxGeometry(2.6, 0.08, 3.4);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 });
    const top = new THREE.Mesh(topGeo, tableMat);
    top.position.y = 1.0;
    top.castShadow = true;
    top.receiveShadow = true;
    tableGroup.add(top);

    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    [[-1.1, 0.5, -1.5], [1.1, 0.5, -1.5], [-1.1, 0.5, 1.5], [1.1, 0.5, 1.5]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...p);
      leg.castShadow = true;
      tableGroup.add(leg);
    });

    tableGroup.position.set(6.5, -1.5, -9.0);
    this.officeEnvGroup.add(tableGroup);
  }

  buildChairsAroundTable() {
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

    const createChair = (x, z, rotationY) => {
      const chair = new THREE.Group();

      const seatGeo = new THREE.BoxGeometry(0.7, 0.06, 0.7);
      const seat = new THREE.Mesh(seatGeo, chairMat);
      seat.position.y = 0.5;
      seat.castShadow = true;
      chair.add(seat);

      const backGeo = new THREE.BoxGeometry(0.7, 0.6, 0.06);
      const back = new THREE.Mesh(backGeo, chairMat);
      back.position.set(0, 0.8, -0.32);
      back.castShadow = true;
      chair.add(back);

      const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8);
      [[-0.3, 0.25, -0.3], [0.3, 0.25, -0.3], [-0.3, 0.25, 0.3], [0.3, 0.25, 0.3]].forEach(p => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...p);
        chair.add(leg);
      });

      chair.position.set(x, -1.5, z);
      chair.rotation.y = rotationY;
      this.officeEnvGroup.add(chair);
    };

    createChair(6.5, -12.0, 0);
    createChair(6.5, -6.0, Math.PI);
  }

  buildCoffeeMug() {
    const mugGroup = new THREE.Group();
    const mugGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.12, 16);
    const mugMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.2 });
    const mug = new THREE.Mesh(mugGeo, mugMat);
    mug.position.y = 0.06;
    mug.castShadow = true;
    mugGroup.add(mug);

    const liquidGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.015, 16);
    const liquidMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.1 });
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.position.y = 0.11;
    mugGroup.add(liquid);

    const handleGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16, Math.PI);
    const handle = new THREE.Mesh(handleGeo, mugMat);
    handle.position.set(0.06, 0.06, 0);
    handle.rotation.z = -Math.PI / 2;
    mugGroup.add(handle);

    mugGroup.position.set(1.15, -0.45, -0.5);
    this.officeEnvGroup.add(mugGroup);
  }

  buildDeskAccessories() {
    const stickyGeo = new THREE.BoxGeometry(0.1, 0.02, 0.1);
    const stickyMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.9 });
    const sticky = new THREE.Mesh(stickyGeo, stickyMat);
    sticky.position.set(-1.0, -0.44, -0.4);
    sticky.rotation.y = 0.15;
    this.officeEnvGroup.add(sticky);
  }

  buildOfficePoster() {
    const posterGroup = new THREE.Group();

    const frameGeo = new THREE.BoxGeometry(2.6, 1.8, 0.06);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    posterGroup.add(frame);

    const canvasGeo = new THREE.PlaneGeometry(2.4, 1.6);
    const canvasMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
    canvasMesh.position.z = 0.032;
    posterGroup.add(canvasMesh);

    posterGroup.position.set(0, 3.5, -27.95);
    this.officeEnvGroup.add(posterGroup);
  }

  buildOfficeWindow() {
    const windowGroup = new THREE.Group();

    const frameGeo = new THREE.BoxGeometry(0.1, 5.0, 3.8);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    windowGroup.add(frame);

    const glassGeo = new THREE.PlaneGeometry(3.6, 4.8);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.85 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.rotation.y = Math.PI / 2;
    glass.position.x = 0.06;
    windowGroup.add(glass);

    windowGroup.position.set(-17.9, 3.2, -8);
    this.officeEnvGroup.add(windowGroup);
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

    const dotGeo = new THREE.SphereGeometry(0.035, 12, 12);
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

    const ringGeo = new THREE.TorusGeometry(0.36, 0.025, 16, 32);
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
   * DECREASED COMPACT PAPER BALL (0.075 RADIUS)
   * ---------------------------------------------------- */
  buildRealisticPaperBall() {
    const baseGeo = new THREE.IcosahedronGeometry(0.075, 3);
    const posAttr = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const foldNoise = (Math.sin(vertex.x * 28) * Math.cos(vertex.z * 28) + Math.sin(vertex.y * 28)) * 0.016;
      const crinkleNoise = (Math.sin(vertex.x * 65 + vertex.y * 65) + Math.cos(vertex.z * 65)) * 0.009;
      const totalDisplacement = foldNoise + crinkleNoise;
      vertex.addScaledVector(vertex.clone().normalize(), totalDisplacement);
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    baseGeo.computeVertexNormals();

    this.paperMaterial = new THREE.MeshStandardMaterial({
      map: this.notebookTexture,
      bumpMap: this.notebookTexture,
      bumpScale: 0.07,
      roughness: 0.96,
      metalness: 0.01,
      color: 0xffffff
    });

    this.paperBallMesh = new THREE.Mesh(baseGeo, this.paperMaterial);
    this.paperBallMesh.castShadow = true;
    this.paperBallMesh.receiveShadow = true;
    
    this.paperBallMesh.position.set(0, -0.405, -0.45);
    this.scene.add(this.paperBallMesh);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.28)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(0.22, 0.22);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    this.ballShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.ballShadowMesh.rotation.x = -Math.PI / 2;
    this.ballShadowMesh.position.set(0, -0.449, -0.45);
    this.scene.add(this.ballShadowMesh);
  }

  updateTrashBinPosition(targetX, targetZ, surfaceY = -1.45, environmentTheme = 'office') {
    this.currentSurfaceY = surfaceY;
    this.trashBinGroup.position.set(targetX, surfaceY, -targetZ);
  }

  update(physicsEngine, dt) {
    // 1. Update Paper Ball Mesh Position & Rotation
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

    // 2. Update Table Contact Shadow
    if (this.ballShadowMesh) {
      if (physicsEngine.state === 'IDLE') {
        this.ballShadowMesh.position.set(physicsEngine.position.x, -0.449, physicsEngine.position.z);
        this.ballShadowMesh.material.opacity = 1.0;
      } else {
        const heightAboveTable = physicsEngine.position.y - (-0.405);
        this.ballShadowMesh.material.opacity = Math.max(0, 1.0 - heightAboveTable * 4.0);
      }
    }

    // 3. Render 3D Scene
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
