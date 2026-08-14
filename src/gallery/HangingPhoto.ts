import * as THREE from 'three/webgpu';
import { ClothSimulation, SimulationTier } from '../cloth/ClothSimulation';
import { GalleryItemData } from './GalleryItem';
import { createArtworkTexture } from './GalleryManifest';

const BASE_WORLD_HEIGHT = 3.2;
const MAX_WORLD_WIDTH = 5.2;
const PARTICLE_SPACING = 0.145;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class HangingPhoto {
  readonly group = new THREE.Group();
  readonly data: GalleryItemData;
  readonly width: number;
  readonly height: number;
  readonly cloth: ClothSimulation;
  readonly texture: THREE.Texture;

  private readonly leftClip: THREE.Mesh;
  private readonly rightClip: THREE.Mesh;
  private readonly leftCable: THREE.Mesh;
  private readonly rightCable: THREE.Mesh;
  private disposed = false;

  constructor(
    data: GalleryItemData,
    renderer: THREE.WebGPURenderer,
    customTexture?: THREE.Texture,
    clipGeometry?: THREE.BoxGeometry,
    clipMaterial?: THREE.Material,
  ) {
    this.data = data;
    this.texture = customTexture ?? createArtworkTexture(data);

    // Calculate world size based on aspect ratio
    const aspect = data.aspectRatio > 0 ? data.aspectRatio : 1.5;
    const rawWidth = BASE_WORLD_HEIGHT * aspect;
    const scale = rawWidth > MAX_WORLD_WIDTH ? MAX_WORLD_WIDTH / rawWidth : 1;
    this.width = rawWidth * scale;
    this.height = BASE_WORLD_HEIGHT * scale;

    const segmentsX = clamp(Math.round(this.width / PARTICLE_SPACING), 4, 38);
    const segmentsY = clamp(Math.round(this.height / PARTICLE_SPACING), 4, 26);

    this.cloth = new ClothSimulation(this.texture, {
      width: this.width,
      height: this.height,
      segmentsX,
      segmentsY,
      solverIterations: 6,
      preset: data.preset,
    });

    this.group.name = `HangingPhoto_${data.id}`;
    this.group.add(this.cloth.mesh);

    // Dual brass/steel clips
    const geom = clipGeometry ?? new THREE.BoxGeometry(0.16, 0.11, 0.12);
    const mat = clipMaterial ?? new THREE.MeshPhysicalMaterial({
      color: 0xa89366,
      metalness: 0.88,
      roughness: 0.28,
      clearcoat: 0.35,
    });

    this.leftClip = new THREE.Mesh(geom, mat);
    this.leftClip.position.set(-this.width / 2 + this.cloth.pinInset, this.height / 2 + 0.02, 0.06);
    this.leftClip.castShadow = true;
    this.group.add(this.leftClip);

    this.rightClip = new THREE.Mesh(geom, mat);
    this.rightClip.position.set(this.width / 2 - this.cloth.pinInset, this.height / 2 + 0.02, 0.06);
    this.rightClip.castShadow = true;
    this.group.add(this.rightClip);

    // Vertical thin steel hanging cables up to rail
    const cableGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.9, 8);
    const cableMat = new THREE.MeshPhysicalMaterial({
      color: 0x666666,
      metalness: 0.95,
      roughness: 0.2,
    });
    this.leftCable = new THREE.Mesh(cableGeom, cableMat);
    this.leftCable.position.set(-this.width / 2 + this.cloth.pinInset, this.height / 2 + 0.47, 0.02);
    this.group.add(this.leftCable);

    this.rightCable = new THREE.Mesh(cableGeom, cableMat);
    this.rightCable.position.set(this.width / 2 - this.cloth.pinInset, this.height / 2 + 0.47, 0.02);
    this.group.add(this.rightCable);

    // Initial reset compute
    this.cloth.reset(renderer);
  }

  setHover(active: boolean, localX = 0, localY = 0, strength = 0.6): void {
    this.cloth.setHover(active, localX, localY, strength);
  }

  applyImpulse(impulse: THREE.Vector3): void {
    this.cloth.applyImpulse(impulse);
  }

  setStabilizing(stabilizing: boolean): void {
    this.cloth.setStabilizing(stabilizing);
  }

  setSimulationTier(tier: SimulationTier): void {
    this.cloth.setSimulationTier(tier);
  }

  setWind(strength: number): void {
    this.cloth.setWind(strength);
  }

  setGravity(magnitude: number): void {
    this.cloth.setGravity(magnitude);
  }

  reset(renderer: THREE.WebGPURenderer): void {
    this.cloth.reset(renderer);
  }

  step(renderer: THREE.WebGPURenderer, dt: number, time: number): void {
    this.cloth.step(renderer, dt, time);
  }

  dispose(renderer?: THREE.WebGPURenderer): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cloth.dispose(renderer);
    this.group.removeFromParent();
    this.leftCable.geometry.dispose();
    (this.leftCable.material as THREE.Material).dispose();
    this.rightCable.geometry.dispose();
    (this.rightCable.material as THREE.Material).dispose();
  }
}
