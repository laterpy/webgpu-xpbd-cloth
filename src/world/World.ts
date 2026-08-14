import * as THREE from 'three/webgpu';
import { loadStudioEnvironment } from '../environment/loadStudioEnvironment';
import { createGalleryEmissiveMaterial, createGalleryMaterial } from './RoomAssetCatalog';

export class World {
  readonly scene = new THREE.Scene();
  private readonly corridorFloor: THREE.Mesh;
  private readonly leftWall: THREE.Mesh;
  private readonly rightWall: THREE.Mesh;
  private readonly ceilingBeam: THREE.Mesh;
  private readonly ceilingRibs: THREE.InstancedMesh;
  private readonly wallRevealLights: THREE.InstancedMesh;
  private readonly entranceGate: THREE.Group;
  private readonly entranceLightSlit: THREE.Mesh;
  private readonly runwayLights: THREE.InstancedMesh;
  private environmentTexture: THREE.DataTexture | null = null;
  private disposed = false;

  constructor() {
    this.scene.background = new THREE.Color(0x060608);
    this.scene.fog = new THREE.FogExp2(0x060608, 0.015);

    // Central Corridor Floor: Long polished dark stone with specular reflection
    const floorWidth = 9.0;
    const floorLength = 85.0;
    const floorGeom = new THREE.PlaneGeometry(floorWidth, floorLength);
    const floorMat = createGalleryMaterial('blackStone', {
      color: 0x0a0a0e,
      roughness: 0.38,
      metalness: 0.42,
    });
    this.corridorFloor = new THREE.Mesh(floorGeom, floorMat);
    this.corridorFloor.rotation.x = -Math.PI / 2;
    this.corridorFloor.position.set(0, -2.4, 14.0);
    this.corridorFloor.receiveShadow = true;
    this.scene.add(this.corridorFloor);

    // Corridor Left & Right Walls
    const wallGeom = new THREE.PlaneGeometry(floorLength, 8.0);
    const wallMat = createGalleryMaterial('mineralPlaster', { color: 0x0e0e13, metalness: 0.08 });

    this.leftWall = new THREE.Mesh(wallGeom, wallMat);
    this.leftWall.rotation.y = Math.PI / 2;
    this.leftWall.position.set(-floorWidth / 2 - 0.05, 1.6, 14.0);
    this.scene.add(this.leftWall);

    this.rightWall = new THREE.Mesh(wallGeom, wallMat);
    this.rightWall.rotation.y = -Math.PI / 2;
    this.rightWall.position.set(floorWidth / 2 + 0.05, 1.6, 14.0);
    this.scene.add(this.rightWall);

    // Overhead Ceiling architectural beam
    const beamGeom = new THREE.BoxGeometry(floorWidth, 0.5, floorLength);
    const beamMat = createGalleryMaterial('blackenedBronze', { color: 0x16161c, roughness: 0.7, metalness: 0.3 });
    this.ceilingBeam = new THREE.Mesh(beamGeom, beamMat);
    this.ceilingBeam.position.set(0, 5.4, 14.0);
    this.scene.add(this.ceilingBeam);

    const ribCount = 28;
    const ribGeom = new THREE.BoxGeometry(floorWidth * 0.98, 0.16, 0.22);
    const ribMat = createGalleryMaterial('blackenedBronze', { color: 0x262127, roughness: 0.46, metalness: 0.6 });
    this.ceilingRibs = new THREE.InstancedMesh(ribGeom, ribMat, ribCount);
    const ribDummy = new THREE.Object3D();
    for (let i = 0; i < ribCount; i++) {
      ribDummy.position.set(0, 5.12, -20 + i * 2.5);
      ribDummy.updateMatrix();
      this.ceilingRibs.setMatrixAt(i, ribDummy.matrix);
    }
    this.ceilingRibs.instanceMatrix.needsUpdate = true;
    this.scene.add(this.ceilingRibs);

    // Embedded Runway Guide Lights along floor edges
    const runwayLightCount = 36;
    const lightGeom = new THREE.BoxGeometry(0.12, 0.02, 0.4);
    const lightMat = createGalleryEmissiveMaterial(0xe5be56, 1.7);
    this.runwayLights = new THREE.InstancedMesh(lightGeom, lightMat, runwayLightCount * 2);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < runwayLightCount; i++) {
      const z = -20 + i * 2.2;
      // Left edge light
      dummy.position.set(-floorWidth / 2 + 0.4, -2.38, z);
      dummy.updateMatrix();
      this.runwayLights.setMatrixAt(i * 2, dummy.matrix);

      // Right edge light
      dummy.position.set(floorWidth / 2 - 0.4, -2.38, z);
      dummy.updateMatrix();
      this.runwayLights.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    this.runwayLights.instanceMatrix.needsUpdate = true;
    this.scene.add(this.runwayLights);

    const wallRevealGeom = new THREE.BoxGeometry(0.035, 1.6, 0.07);
    const wallRevealMat = createGalleryMaterial('blackenedBronze', {
      color: 0x8a7752,
      emissive: 0x6e491b,
      emissiveIntensity: 0.7,
    });
    this.wallRevealLights = new THREE.InstancedMesh(wallRevealGeom, wallRevealMat, 16);
    const wallDummy = new THREE.Object3D();
    for (let i = 0; i < 8; i++) {
      const z = -16 + i * 8;
      wallDummy.position.set(-floorWidth / 2 - 0.01, 0.55, z);
      wallDummy.updateMatrix();
      this.wallRevealLights.setMatrixAt(i * 2, wallDummy.matrix);
      wallDummy.position.set(floorWidth / 2 + 0.01, 0.55, z);
      wallDummy.updateMatrix();
      this.wallRevealLights.setMatrixAt(i * 2 + 1, wallDummy.matrix);
    }
    this.wallRevealLights.instanceMatrix.needsUpdate = true;
    this.scene.add(this.wallRevealLights);

    // Entrance Monolith Door at Z = -22
    this.entranceGate = new THREE.Group();
    this.entranceGate.position.set(0, 0, -22);

    const slitGeom = new THREE.PlaneGeometry(0.08, 6.5);
    const slitMat = new THREE.MeshBasicMaterial({
      color: 0xffe6aa,
      side: THREE.DoubleSide,
    });
    this.entranceLightSlit = new THREE.Mesh(slitGeom, slitMat);
    this.entranceLightSlit.position.set(0, 0.6, 0.2);
    this.entranceGate.add(this.entranceLightSlit);
    const entranceFrameMat = createGalleryMaterial('blackenedBronze', { color: 0x5b4731 });
    const leftEntrancePost = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.8, 0.36), entranceFrameMat);
    leftEntrancePost.position.x = -7.0;
    this.entranceGate.add(leftEntrancePost);
    const rightEntrancePost = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.8, 0.36), entranceFrameMat);
    rightEntrancePost.position.x = 7.0;
    this.entranceGate.add(rightEntrancePost);
    const entranceHeader = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.22, 0.36), entranceFrameMat);
    entranceHeader.position.y = 3.9;
    this.entranceGate.add(entranceHeader);
    this.scene.add(this.entranceGate);

    // Corridor Longitudinal Lighting
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(-6, 12, -10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.00005;
    keyLight.shadow.normalBias = 0.015;
    this.scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xf5eedc, 0x060608, 0.65);
    this.scene.add(hemiLight);
  }

  async initEnvironment(): Promise<void> {
    try {
      this.environmentTexture = await loadStudioEnvironment(this.scene);
    } catch (e) {
      console.warn('HDR Studio Environment failed to load, falling back to direct lights.', e);
    }
  }

  setEntranceSlitOpenness(progress: number): void {
    const width = THREE.MathUtils.lerp(0.08, 7.0, progress);
    this.entranceLightSlit.scale.x = width / 0.08;
    (this.entranceLightSlit.material as THREE.MeshBasicMaterial).opacity = 1 - progress * 0.95;
    (this.entranceLightSlit.material as THREE.MeshBasicMaterial).transparent = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.environmentTexture?.dispose();
    this.corridorFloor.geometry.dispose();
    (this.corridorFloor.material as THREE.Material).dispose();
    this.leftWall.geometry.dispose();
    (this.leftWall.material as THREE.Material).dispose();
    this.rightWall.geometry.dispose();
    (this.rightWall.material as THREE.Material).dispose();
    this.ceilingBeam.geometry.dispose();
    (this.ceilingBeam.material as THREE.Material).dispose();
    this.runwayLights.geometry.dispose();
    (this.runwayLights.material as THREE.Material).dispose();
    this.ceilingRibs.geometry.dispose();
    (this.ceilingRibs.material as THREE.Material).dispose();
    this.wallRevealLights.geometry.dispose();
    (this.wallRevealLights.material as THREE.Material).dispose();
    this.entranceLightSlit.geometry.dispose();
    (this.entranceLightSlit.material as THREE.Material).dispose();
    this.entranceGate.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh === this.entranceLightSlit) return;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material?.dispose();
      }
    });
  }
}
