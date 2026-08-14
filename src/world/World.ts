import * as THREE from 'three/webgpu';
import { loadStudioEnvironment } from '../environment/loadStudioEnvironment';

export class World {
  readonly scene = new THREE.Scene();
  private readonly floor: THREE.Mesh;
  private readonly backWall: THREE.Mesh;
  private readonly ceilingBeam: THREE.Mesh;
  private readonly entranceGate: THREE.Group;
  private readonly entranceLightSlit: THREE.Mesh;
  private environmentTexture: THREE.DataTexture | null = null;
  private disposed = false;

  constructor() {
    this.scene.background = new THREE.Color(0x09090b);
    this.scene.fog = new THREE.FogExp2(0x09090b, 0.012);

    // Large polished dark concrete floor with specular reflection
    const floorGeom = new THREE.PlaneGeometry(240, 60);
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x111114,
      roughness: 0.42,
      metalness: 0.35,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
    });
    this.floor = new THREE.Mesh(floorGeom, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(60, -3.2, 5);
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Back gallery wall
    const wallGeom = new THREE.PlaneGeometry(240, 24);
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0x141418,
      roughness: 0.92,
      metalness: 0.05,
    });
    this.backWall = new THREE.Mesh(wallGeom, wallMat);
    this.backWall.position.set(60, 2.0, -0.85);
    this.backWall.receiveShadow = true;
    this.scene.add(this.backWall);

    // Architectural ceiling track beam
    const beamGeom = new THREE.BoxGeometry(240, 0.3, 1.2);
    const beamMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a1f,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.ceilingBeam = new THREE.Mesh(beamGeom, beamMat);
    this.ceilingBeam.position.set(60, 4.5, 0.5);
    this.scene.add(this.ceilingBeam);

    // Global Key Light (warm museum directional spotlight)
    const keyLight = new THREE.DirectionalLight(0xfff3e0, 2.8);
    keyLight.position.set(-8, 9, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.00005;
    keyLight.shadow.normalBias = 0.015;
    keyLight.shadow.intensity = 0.55;
    this.scene.add(keyLight);

    // Rim subtle blue light
    const rimLight = new THREE.DirectionalLight(0xa5c2ff, 0.8);
    rimLight.position.set(12, 4, 6);
    this.scene.add(rimLight);

    // Hemisphere overall ambient
    const hemiLight = new THREE.HemisphereLight(0xf2e8da, 0x09090c, 0.7);
    this.scene.add(hemiLight);

    // 3D Entrance Monolith Portal & glowing light slit
    this.entranceGate = new THREE.Group();
    this.entranceGate.position.set(0, 0, 0);

    const slitGeom = new THREE.PlaneGeometry(0.06, 6.0);
    const slitMat = new THREE.MeshBasicMaterial({
      color: 0xffe2a4,
      side: THREE.DoubleSide,
    });
    this.entranceLightSlit = new THREE.Mesh(slitGeom, slitMat);
    this.entranceLightSlit.position.set(0, 0, 0.5);
    this.entranceGate.add(this.entranceLightSlit);

    this.scene.add(this.entranceGate);
  }

  async initEnvironment(): Promise<void> {
    try {
      this.environmentTexture = await loadStudioEnvironment(this.scene);
    } catch (e) {
      console.warn('HDR Studio Environment failed to load, falling back to direct lights.', e);
    }
  }

  setEntranceSlitOpenness(progress: number): void {
    // Progress from 0 (closed slit) to 1 (fully wide open door)
    const width = THREE.MathUtils.lerp(0.06, 6.0, progress);
    this.entranceLightSlit.scale.x = width / 0.06;
    (this.entranceLightSlit.material as THREE.MeshBasicMaterial).opacity = 1 - progress * 0.9;
    (this.entranceLightSlit.material as THREE.MeshBasicMaterial).transparent = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.environmentTexture?.dispose();
    this.floor.geometry.dispose();
    (this.floor.material as THREE.Material).dispose();
    this.backWall.geometry.dispose();
    (this.backWall.material as THREE.Material).dispose();
    this.ceilingBeam.geometry.dispose();
    (this.ceilingBeam.material as THREE.Material).dispose();
    this.entranceLightSlit.geometry.dispose();
    (this.entranceLightSlit.material as THREE.Material).dispose();
  }
}
