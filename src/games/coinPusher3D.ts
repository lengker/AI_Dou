import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PLATFORM_W, PLATFORM_D, normToPlatformX } from '@/games/coinPusherConfig';

const PALETTE = {
  bg: 0x1a1028,
  gold: 0xffd700,
  wall: 0x4a3568,
  platform: 0x2a1a3a,
  deck: 0x3a2d52,
  pusher: 0x8aa4be,
  chute: 0x1a1028,
  saucer: 0x2a1838,
};

const COIN_RADIUS = 0.34;
const COIN_THICK = 0.052;
const COIN_HALF_Y = COIN_THICK / 2;
const COIN_MASS = 1.0;
const PLATFORM_TOP_Y = 0;
const COIN_REST_Y = PLATFORM_TOP_Y + COIN_HALF_Y + 0.003;
const PLATFORM_CENTER_Z = 0;
const FRONT_Z = PLATFORM_D / 2 - 0.12;
const SAUCER_Z = FRONT_Z + 0.32;
const MAX_SHARDS = 30;
const SAUCER_GAIN = 2;

const BACK_INNER_Z = -PLATFORM_D / 2 + 0.14;
const PUSHER_FRONT_MIN = BACK_INNER_Z + 0.28;
const PUSHER_FRONT_MAX = BACK_INNER_Z + 1.38;
const PUSHER_THICKNESS = 0.07;
const PUSHER_VISUAL_H = 0.034;
const PUSHER_HALF_W = PLATFORM_W / 2 - 0.04;
const PUSHER_SPEED = 0.85;
const PUSHER_PHYSICS_Y = PLATFORM_TOP_Y - PUSHER_THICKNESS / 2 + 0.001;
const PUSHER_VISUAL_Y = PLATFORM_TOP_Y + PUSHER_VISUAL_H / 2 + 0.004;
const SEED_WARMUP = 1.0;
const DROP_Z_MIN = BACK_INNER_Z + 0.12;
const DROP_Z_MAX = BACK_INNER_Z + 0.42;
const PHYSICS_STEP = 1 / 60;

export interface CoinPusher3DCallbacks {
  onCredits: (n: number) => void;
  onShards: (n: number) => void;
  onNormalCatch: () => void;
}

interface CoinEntry {
  body: CANNON.Body;
  mesh: THREE.Mesh;
  caught: boolean;
  falling?: boolean;
  fallT?: number;
}

export class CoinPusher3DEngine {
  private container: HTMLElement;
  private callbacks: CoinPusher3DCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private resizeObserver: ResizeObserver | null = null;
  private world!: CANNON.World;
  private coinMaterial!: CANNON.Material;
  private platformMaterial!: CANNON.Material;
  private pusherMaterial!: CANNON.Material;
  private coins: CoinEntry[] = [];
  private pusherBody!: CANNON.Body;
  private pusherMesh!: THREE.Mesh;
  private pusherMat!: THREE.MeshStandardMaterial;
  private pusherShape!: CANNON.Box;
  private lastPusherDepth = 0;
  private animId = 0;
  private lastTime = 0;
  private time = 0;
  private pusherFrontZ = PUSHER_FRONT_MIN;
  private pusherVelZ = 0;
  private disposed = false;
  private ready = false;
  private warmupLeft = SEED_WARMUP;

  credits = 0;
  shardsEarned = 0;

  constructor(container: HTMLElement, callbacks: CoinPusher3DCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    requestAnimationFrame(() => {
      if (!this.disposed) this.init();
    });
  }

  /** 平台后边沿对齐 2D 落币衔接缝，前沿仍露出出币口 */
  private fitCamera(w: number, h: number) {
    const aspect = w / Math.max(h, 1);
    const camY = 4.72;
    const camZ = 6.95;
    const lookY = 0.015;
    const lookZ = 0.42;
    const targetHalfW = PLATFORM_W / 2 + 0.04;
    const planeZ = BACK_INNER_Z;
    const dz = camZ - planeZ;
    const dy = camY - lookY;
    const dist = Math.sqrt(dy * dy + dz * dz);
    const vFovRad = 2 * Math.atan(targetHalfW / (dist * aspect)) * 1.02;
    const vFov = THREE.MathUtils.clamp((vFovRad * 180) / Math.PI, 38, 54);

    if (!this.camera) {
      this.camera = new THREE.PerspectiveCamera(vFov, aspect, 0.1, 80);
    } else {
      this.camera.fov = vFov;
      this.camera.aspect = aspect;
    }
    this.camera.position.set(0, camY, camZ);
    this.camera.lookAt(0, lookY, lookZ);
    this.camera.updateProjectionMatrix();
  }

  private surfaceMat(color: number, emissive = 0.08) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.04,
      emissive: color,
      emissiveIntensity: emissive,
    });
  }

  private init() {
    const w = this.container.clientWidth || 360;
    const h = this.container.clientHeight || 300;
    if (w <= 0 || h <= 0) {
      requestAnimationFrame(() => {
        if (!this.disposed) this.init();
      });
      return;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bg);
    this.scene.fog = new THREE.Fog(PALETTE.bg, 14, 24);
    this.fitCamera(w, h);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xccc0ff, 0x1a1028, 0.58));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(3, 11, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    this.scene.add(key);

    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 18;
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e6;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;

    this.coinMaterial = new CANNON.Material('coin');
    this.platformMaterial = new CANNON.Material('platform');
    this.pusherMaterial = new CANNON.Material('pusher');

    this.world.addContactMaterial(new CANNON.ContactMaterial(this.coinMaterial, this.coinMaterial, {
      friction: 0.45,
      restitution: 0.02,
      contactEquationStiffness: 1e6,
      contactEquationRelaxation: 4,
    }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.coinMaterial, this.platformMaterial, {
      friction: 0.5,
      restitution: 0.02,
    }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.coinMaterial, this.pusherMaterial, {
      friction: 0.55,
      restitution: 0.01,
    }));

    this.buildMachine();
    this.buildPusher();
    this.time = -Math.PI / (2 * PUSHER_SPEED);
    this.syncPusher(PUSHER_FRONT_MIN);
    this.seedStackedCoins(24);
    window.addEventListener('resize', this.onResize);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
    this.lastTime = performance.now();
    this.ready = true;
    this.animate();
  }

  private addStatic(mesh: THREE.Mesh, shape: CANNON.Shape, x: number, y: number, z: number, mat?: CANNON.Material) {
    const body = new CANNON.Body({ mass: 0, material: mat });
    body.addShape(shape);
    body.position.set(x, y, z);
    this.world.addBody(body);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
  }

  private buildMachine() {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_W, 0.18, PLATFORM_D),
      this.surfaceMat(PALETTE.platform, 0.05),
    );
    this.addStatic(
      base,
      new CANNON.Box(new CANNON.Vec3(PLATFORM_W / 2, 0.09, PLATFORM_D / 2)),
      0, -0.09, PLATFORM_CENTER_Z,
      this.platformMaterial,
    );

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_W, 0.025, PLATFORM_D),
      this.surfaceMat(PALETTE.deck, 0.06),
    );
    deck.position.set(0, PLATFORM_TOP_Y - 0.0125, PLATFORM_CENTER_Z);
    deck.receiveShadow = true;
    this.scene.add(deck);

    const lipW = (PLATFORM_W - 0.24) / 2;
    const lipMat = this.surfaceMat(PALETTE.gold, 0.22);
    const lipL = new THREE.Mesh(new THREE.BoxGeometry(lipW, 0.055, 0.09), lipMat);
    this.addStatic(
      lipL,
      new CANNON.Box(new CANNON.Vec3(lipW / 2, 0.0275, 0.045)),
      -(lipW / 2 + 0.1), 0.0275, FRONT_Z,
      this.platformMaterial,
    );
    const lipR = new THREE.Mesh(new THREE.BoxGeometry(lipW, 0.055, 0.09), lipMat);
    this.addStatic(
      lipR,
      new CANNON.Box(new CANNON.Vec3(lipW / 2, 0.0275, 0.045)),
      lipW / 2 + 0.1, 0.0275, FRONT_Z,
      this.platformMaterial,
    );

    const chute = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_W - 0.28, 0.22, 0.28),
      this.surfaceMat(PALETTE.chute, 0.03),
    );
    chute.position.set(0, -0.08, FRONT_Z + 0.18);
    this.scene.add(chute);

    const saucer = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_W - 0.36, 0.1, 0.42),
      this.surfaceMat(PALETTE.saucer, 0.15),
    );
    saucer.position.set(0, -0.12, SAUCER_Z);
    this.scene.add(saucer);

    const saucerGlow = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_W - 0.5, 0.04, 0.28),
      new THREE.MeshStandardMaterial({
        color: PALETTE.gold,
        emissive: PALETTE.gold,
        emissiveIntensity: 0.45,
        roughness: 0.5,
      }),
    );
    saucerGlow.position.set(0, -0.06, SAUCER_Z);
    this.scene.add(saucerGlow);

    const wallH = 0.52;
    const wallMat = this.surfaceMat(PALETTE.wall, 0.04);
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH, PLATFORM_D), wallMat);
    this.addStatic(
      wallL,
      new CANNON.Box(new CANNON.Vec3(0.05, wallH / 2, PLATFORM_D / 2)),
      -PLATFORM_W / 2 - 0.05, wallH / 2 - 0.08, PLATFORM_CENTER_Z,
    );
    const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH, PLATFORM_D), wallMat);
    this.addStatic(
      wallR,
      new CANNON.Box(new CANNON.Vec3(0.05, wallH / 2, PLATFORM_D / 2)),
      PLATFORM_W / 2 + 0.05, wallH / 2 - 0.08, PLATFORM_CENTER_Z,
    );

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_W, 0.32, 0.12),
      this.surfaceMat(PALETTE.wall, 0.05),
    );
    this.addStatic(
      back,
      new CANNON.Box(new CANNON.Vec3(PLATFORM_W / 2, 0.16, 0.06)),
      0, 0.16, -PLATFORM_D / 2 + 0.08,
    );

  }

  private buildPusher() {
    this.pusherBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: this.pusherMaterial,
    });
    this.pusherShape = new CANNON.Box(new CANNON.Vec3(PUSHER_HALF_W, PUSHER_THICKNESS / 2, 0.14));
    this.pusherBody.addShape(this.pusherShape);
    this.world.addBody(this.pusherBody);

    this.pusherMat = this.surfaceMat(PALETTE.pusher, 0.18);
    this.pusherMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PLATFORM_W - 0.08, PUSHER_VISUAL_H, 1),
      this.pusherMat,
    );
    this.pusherMesh.castShadow = false;
    this.pusherMesh.receiveShadow = false;
    this.pusherMesh.renderOrder = 1;
    this.scene.add(this.pusherMesh);
    this.syncPusher(PUSHER_FRONT_MIN);
  }

  /** 推板视觉用 scale，避免每帧重建几何体产生横纹 */
  private syncPusher(frontZ: number) {
    const backZ = BACK_INNER_Z;
    const depth = Math.max(0.14, frontZ - backZ);
    const centerZ = backZ + depth / 2;

    if (Math.abs(depth - this.lastPusherDepth) > 0.002) {
      this.pusherBody.removeShape(this.pusherShape);
      this.pusherShape = new CANNON.Box(new CANNON.Vec3(PUSHER_HALF_W, PUSHER_THICKNESS / 2, depth / 2));
      this.pusherBody.addShape(this.pusherShape);
      this.lastPusherDepth = depth;
    }
    this.pusherBody.position.set(0, PUSHER_PHYSICS_Y, centerZ);

    this.pusherMesh.scale.set(1, 1, depth);
    this.pusherMesh.position.set(0, PUSHER_VISUAL_Y, centerZ);
    this.pusherFrontZ = frontZ;
  }

  private targetPusherFrontZ(t: number) {
    const wave = (Math.sin(t * PUSHER_SPEED) + 1) / 2;
    return PUSHER_FRONT_MIN + wave * (PUSHER_FRONT_MAX - PUSHER_FRONT_MIN);
  }

  private createCoin(x: number, y: number, z: number, vx = 0, vy = 0, vz = 0): CoinEntry {
    const body = new CANNON.Body({
      mass: COIN_MASS,
      material: this.coinMaterial,
      linearDamping: 0.42,
      angularDamping: 0.88,
      sleepSpeedLimit: 0.05,
      sleepTimeLimit: 0.55,
    });
    body.addShape(new CANNON.Cylinder(COIN_RADIUS, COIN_RADIUS, COIN_THICK, 12));
    body.position.set(x, y, z);
    body.velocity.set(vx, vy, vz);
    body.angularFactor.set(1, 0.2, 1);
    body.updateMassProperties();
    this.world.addBody(body);

    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_THICK, 14),
      this.surfaceMat(PALETTE.gold, 0.22),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 3;
    this.scene.add(mesh);
    const entry: CoinEntry = { body, mesh, caught: false };
    this.coins.push(entry);
    return entry;
  }

  private canPlaceCoin(x: number, z: number, y: number) {
    const minDist = COIN_RADIUS * 1.85;
    for (const { body } of this.coins) {
      if (Math.hypot(body.position.x - x, body.position.z - z) < minDist && Math.abs(body.position.y - y) < COIN_THICK * 2) {
        return false;
      }
    }
    return true;
  }

  private seedStackedCoins(count: number) {
    const spanX = PLATFORM_W - 0.5;
    const zMin = PUSHER_FRONT_MAX + 0.25;
    const zMax = FRONT_Z - 0.5;
    let placed = 0;
    for (let layer = 0; layer < 3 && placed < count; layer++) {
      for (let row = 0; row < 4 && placed < count; row++) {
        for (let col = 0; col < 7 && placed < count; col++) {
          const x = -spanX / 2 + col * (spanX / 6) + (layer % 2) * 0.07;
          const z = zMin + (row / 3) * (zMax - zMin);
          const y = COIN_REST_Y + layer * COIN_THICK * 1.04;
          if (!this.canPlaceCoin(x, z, y)) continue;
          const c = this.createCoin(x, y, z);
          c.body.velocity.set(0, 0, 0);
          c.body.angularVelocity.set(0, 0, 0);
          c.body.sleep();
          placed += 1;
        }
      }
    }
  }

  receiveCoin(normX: number) {
    const x = normToPlatformX(normX);
    const dropZ = DROP_Z_MIN + Math.random() * (DROP_Z_MAX - DROP_Z_MIN);
    this.createCoin(
      x,
      1.5,
      dropZ,
      (Math.random() - 0.5) * 0.06,
      -0.08,
      0.02 + Math.random() * 0.03,
    );
  }

  private applyPusherDrive(frontZ: number) {
    if (Math.abs(this.pusherVelZ) < 0.008) return;
    const back = BACK_INNER_Z;

    for (const { body } of this.coins) {
      if (body.sleepState === CANNON.Body.SLEEPING && this.pusherVelZ > 0) {
        const pz = body.position.z;
        if (pz >= back && pz <= frontZ + 0.02) body.wakeUp();
      }
      if (Math.abs(body.position.x) > PUSHER_HALF_W + COIN_RADIUS) continue;
      const pz = body.position.z;
      if (pz < back - 0.02 || pz > frontZ + COIN_RADIUS * 0.6) continue;
      if (body.position.y > COIN_REST_Y + COIN_THICK * 4) continue;

      if (this.pusherVelZ > 0 && pz <= frontZ + 0.02) {
        const target = this.pusherVelZ * 0.92;
        if (body.velocity.z < target) body.velocity.z = target;
      }
    }
  }

  private settleCoins() {
    for (const { body } of this.coins) {
      const spd = body.velocity.length();
      const ang = body.angularVelocity.length();
      if (spd < 0.06 && ang < 0.12) {
        body.velocity.scale(0.8, body.velocity);
        body.angularVelocity.scale(0.75, body.angularVelocity);
        if (spd < 0.035 && ang < 0.06) body.sleep();
      }
    }
  }

  setCredits(n: number) {
    this.credits = n;
  }

  addBonusShards(n: number) {
    const add = Math.min(n, MAX_SHARDS - this.shardsEarned);
    this.shardsEarned += add;
    this.callbacks.onShards(this.shardsEarned);
  }

  private removeCoin(entry: CoinEntry) {
    this.world.removeBody(entry.body);
    this.scene.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    (entry.mesh.material as THREE.Material).dispose();
    const idx = this.coins.indexOf(entry);
    if (idx >= 0) this.coins.splice(idx, 1);
  }

  private startCatch(entry: CoinEntry) {
    if (entry.caught) return;
    entry.caught = true;
    entry.falling = true;
    entry.fallT = 0;
    this.world.removeBody(entry.body);
    entry.body.velocity.set(0, 0, 0);
  }

  private updateFallingCoins(dt: number) {
    for (const entry of this.coins) {
      if (!entry.falling) continue;
      entry.fallT = (entry.fallT ?? 0) + dt;
      const t = Math.min(1, entry.fallT / 0.35);
      const y0 = entry.body.position.y;
      entry.mesh.position.set(
        entry.body.position.x,
        THREE.MathUtils.lerp(y0, -0.14, t * t),
        THREE.MathUtils.lerp(entry.body.position.z, SAUCER_Z, t),
      );
      entry.mesh.rotation.x += dt * 6;
      if (t >= 1) {
        this.credits += SAUCER_GAIN;
        if (this.shardsEarned < MAX_SHARDS) {
          this.shardsEarned += 1;
          this.callbacks.onShards(this.shardsEarned);
        }
        this.callbacks.onCredits(this.credits);
        this.callbacks.onNormalCatch();
        this.removeCoin(entry);
      }
    }
  }

  private handleCatch(entry: CoinEntry) {
    if (entry.caught) return;
    const { x, z, y } = entry.body.position;
    const lowEnough = y < COIN_REST_Y + COIN_THICK * 2.2;

    if (z >= FRONT_Z - 0.04 && lowEnough && Math.abs(x) <= PLATFORM_W / 2 - 0.08) {
      this.startCatch(entry);
    } else if (y < -1.2 || z > FRONT_Z + 1.0) {
      this.removeCoin(entry);
    }
  }

  private syncMeshes() {
    for (const entry of this.coins) {
      if (entry.falling) continue;
      const { body, mesh } = entry;
      mesh.position.set(body.position.x, body.position.y, body.position.z);
      mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    }
  }

  private stepPhysics(dt: number) {
    const pusherActive = this.warmupLeft <= 0;
    if (this.warmupLeft > 0) this.warmupLeft -= dt;

    const prevFront = this.pusherFrontZ;
    if (pusherActive) this.time += dt;
    const nextFront = pusherActive ? this.targetPusherFrontZ(this.time) : PUSHER_FRONT_MIN;
    this.pusherVelZ = pusherActive ? (nextFront - prevFront) / Math.max(dt, 1e-4) : 0;

    this.syncPusher(prevFront);
    this.pusherBody.velocity.set(0, 0, this.pusherVelZ);
    if (pusherActive) this.applyPusherDrive(prevFront);

    this.world.step(PHYSICS_STEP, dt, 4);

    this.syncPusher(nextFront);
    this.settleCoins();
    for (const entry of [...this.coins]) this.handleCatch(entry);
  }

  private animate = () => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.animate);
    if (!this.ready) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.033);
    this.lastTime = now;
    this.stepPhysics(dt);
    this.updateFallingCoins(dt);
    this.syncMeshes();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    if (!this.ready) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.fitCamera(w, h);
    this.renderer.setSize(w, h);
  };

  isMaxShards() {
    return this.shardsEarned >= MAX_SHARDS;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    if (!this.ready) return;
    for (const entry of this.coins) {
      this.scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      (entry.mesh.material as THREE.Material).dispose();
      if (!entry.falling) this.world.removeBody(entry.body);
    }
    this.coins = [];
    this.pusherMesh.geometry.dispose();
    this.pusherMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

export const COIN_PUSHER_LIMITS = { MAX_SHARDS, INIT_CREDITS: 20, MAX_DROPS: 60, DROP_COST: 1 };
