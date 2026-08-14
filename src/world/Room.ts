import * as THREE from 'three/webgpu';
import { RoomConfig } from '../gallery/GalleryManifest';
import { HangingPhoto } from '../gallery/HangingPhoto';
import { GalleryItemData } from '../gallery/GalleryItem';

const TOP_LINE_Y = 1.6;
const ITEM_GAP = 0.65;

export class Room {
  readonly group = new THREE.Group();
  readonly config: RoomConfig;
  readonly photos: HangingPhoto[] = [];

  private readonly rail: THREE.Mesh;
  private readonly spotLight: THREE.SpotLight;
  private readonly roomAmbientLight: THREE.HemisphereLight;
  private activeIndex = 0;
  private totalWidth = 0;
  private disposed = false;

  constructor(
    config: RoomConfig,
    renderer: THREE.WebGPURenderer,
    sharedClipGeometry?: THREE.BoxGeometry,
    sharedClipMaterial?: THREE.Material,
  ) {
    this.config = config;
    this.group.name = `Room_${config.id}`;

    // Hanging brass/steel track rail
    const railGeom = new THREE.CylinderGeometry(0.025, 0.025, 24, 24);
    const railMat = new THREE.MeshPhysicalMaterial({
      color: 0x484236,
      metalness: 0.85,
      roughness: 0.3,
    });
    this.rail = new THREE.Mesh(railGeom, railMat);
    this.rail.rotation.z = Math.PI / 2;
    this.rail.position.set(0, TOP_LINE_Y + 0.92, -0.01);
    this.rail.castShadow = true;
    this.group.add(this.rail);

    // Warm museum spotlight focused on active exhibition area
    this.spotLight = new THREE.SpotLight(config.spotlightColor, config.spotlightIntensity, 25, Math.PI / 3.5, 0.45, 1.2);
    this.spotLight.position.set(0, 5.5, 4.2);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.bias = -0.00005;
    this.spotLight.shadow.normalBias = 0.015;
    this.group.add(this.spotLight);
    this.group.add(this.spotLight.target);

    // Room subtle ambient mood light
    this.roomAmbientLight = new THREE.HemisphereLight(config.ambientLightColor, 0x08080a, config.ambientIntensity);
    this.group.add(this.roomAmbientLight);

    // Instantiate photos
    for (const itemData of config.items) {
      const photo = new HangingPhoto(itemData, renderer, undefined, sharedClipGeometry, sharedClipMaterial);
      this.photos.push(photo);
      this.group.add(photo.group);
    }

    this.layout();
    this.setWind(config.windStrength);
    this.setGravity(config.gravityStrength);
  }

  addCustomPhoto(
    data: GalleryItemData,
    texture: THREE.Texture,
    renderer: THREE.WebGPURenderer,
  ): HangingPhoto {
    const photo = new HangingPhoto(data, renderer, texture);
    this.photos.push(photo);
    this.group.add(photo.group);
    this.layout();
    this.activeIndex = this.photos.length - 1;
    return photo;
  }

  layout(): void {
    let cursor = 0;
    for (let i = 0; i < this.photos.length; i++) {
      const photo = this.photos[i];
      const centerX = cursor + photo.width / 2;
      photo.group.position.set(centerX, TOP_LINE_Y - photo.height / 2, 0);
      cursor += photo.width + ITEM_GAP;
    }
    this.totalWidth = cursor;

    // Center entire room gallery around origin
    const offset = this.totalWidth / 2;
    for (const photo of this.photos) {
      photo.group.position.x -= offset;
    }

    this.updateSpotlightTarget();
  }

  getActiveIndex(): number {
    return this.activeIndex;
  }

  getActivePhoto(): HangingPhoto | null {
    return this.photos[this.activeIndex] ?? null;
  }

  setActiveIndex(index: number): boolean {
    if (index < 0 || index >= this.photos.length) return false;
    this.activeIndex = index;
    this.updateSpotlightTarget();
    return true;
  }

  private updateSpotlightTarget(): void {
    const active = this.getActivePhoto();
    if (active) {
      this.spotLight.target.position.set(active.group.position.x, active.group.position.y, 0);
      this.spotLight.position.x = active.group.position.x * 0.4;
    }
  }

  setWind(strength: number): void {
    for (const photo of this.photos) {
      photo.setWind(strength);
    }
  }

  setGravity(magnitude: number): void {
    for (const photo of this.photos) {
      photo.setGravity(magnitude);
    }
  }

  applyImpulse(impulse: THREE.Vector3): void {
    for (let i = 0; i < this.photos.length; i++) {
      // Cascade impulse with small delay effect based on distance
      this.photos[i].applyImpulse(impulse);
    }
  }

  setStabilizing(stabilizing: boolean): void {
    for (const photo of this.photos) {
      photo.setStabilizing(stabilizing);
    }
  }

  updateLOD(isCurrentRoom: boolean, currentPhotoIndex: number): void {
    if (!isCurrentRoom) {
      for (const photo of this.photos) {
        photo.setSimulationTier('frozen');
      }
      return;
    }

    for (let i = 0; i < this.photos.length; i++) {
      const distance = Math.abs(i - currentPhotoIndex);
      if (distance === 0) {
        this.photos[i].setSimulationTier('active');
      } else if (distance <= 1) {
        this.photos[i].setSimulationTier('reduced');
      } else {
        this.photos[i].setSimulationTier('frozen');
      }
    }
  }

  step(renderer: THREE.WebGPURenderer, dt: number, time: number): void {
    for (const photo of this.photos) {
      photo.step(renderer, dt, time);
    }
  }

  resetAll(renderer: THREE.WebGPURenderer): void {
    for (const photo of this.photos) {
      photo.reset(renderer);
    }
  }

  dispose(renderer?: THREE.WebGPURenderer): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const photo of this.photos) {
      photo.dispose(renderer);
    }
    this.photos.length = 0;
    this.group.removeFromParent();
    this.rail.geometry.dispose();
    (this.rail.material as THREE.Material).dispose();
  }
}
