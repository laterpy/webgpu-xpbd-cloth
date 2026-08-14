import * as THREE from 'three/webgpu';
import { RoomConfig } from '../gallery/GalleryManifest';
import { HangingPhoto } from '../gallery/HangingPhoto';
import { GalleryItemData } from '../gallery/GalleryItem';
import { buildRoomDecor } from './RoomDecor';
import { createGalleryMaterial, getRoomResourceContract } from './RoomAssetCatalog';

const TOP_LINE_Y = 1.4;
export const ROOM_CHAMBER_WIDTH = 14.5;
const ROOM_CHAMBER_HEIGHT = 8.5;
const ROOM_CHAMBER_DEPTH = 28.0;

export interface RoomCameraDistanceBounds {
  min: number;
  max: number;
  initial: number;
}

const ROOM_CAMERA_DISTANCE_BOUNDS: RoomCameraDistanceBounds = {
  min: 5.8,
  max: 13.5,
  initial: 8.5,
};

export class Room {
  readonly group = new THREE.Group();
  readonly config: RoomConfig;
  readonly photos: HangingPhoto[] = [];

  readonly frameMesh: THREE.LineSegments;
  readonly floorMesh: THREE.Mesh;
  readonly backMesh: THREE.Mesh;
  private readonly spotLight: THREE.SpotLight;
  private readonly roomAmbientLight: THREE.HemisphereLight;
  private readonly layoutGroup = new THREE.Group();
  private readonly decorGroup: THREE.Group;
  private overheadRail: THREE.Object3D;
  private activeIndex = 0;
  private disposed = false;

  constructor(
    config: RoomConfig,
    renderer: THREE.WebGPURenderer,
    sharedClipGeometry?: THREE.BoxGeometry,
    sharedClipMaterial?: THREE.Material,
  ) {
    this.config = config;
    this.group.name = `Room_${config.id}`;
    this.group.userData.resourceContract = getRoomResourceContract(config.id, config.layoutType);

    // Room architectural chamber frame (box outline in dark metallic tone)
    const boxWidth = ROOM_CHAMBER_WIDTH;
    const boxHeight = ROOM_CHAMBER_HEIGHT;
    const boxDepth = ROOM_CHAMBER_DEPTH;

    const frameGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth));
    const frameMat = new THREE.LineBasicMaterial({
      color: 0x3d3944,
      transparent: true,
      opacity: 0.55,
    });
    this.frameMesh = new THREE.LineSegments(frameGeom, frameMat);
    this.frameMesh.position.set(0, 0.6, 0);
    this.group.add(this.frameMesh);

    // Dark chamber floor
    const floorGeom = new THREE.PlaneGeometry(boxWidth, boxDepth);
    const floorMat = createGalleryMaterial('blackStone', {
      color: 0x0f0f14,
      roughness: 0.45,
      metalness: 0.3,
    });
    this.floorMesh = new THREE.Mesh(floorGeom, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.set(0, -3.6, 0);
    this.floorMesh.receiveShadow = true;
    this.group.add(this.floorMesh);

    // Chamber back wall
    const backGeom = new THREE.PlaneGeometry(boxWidth, boxHeight);
    const backMat = createGalleryMaterial('mineralPlaster', { color: config.wallColor });
    backMat.depthWrite = false;
    this.backMesh = new THREE.Mesh(backGeom, backMat);
    this.backMesh.position.set(0, 0.6, -boxDepth / 2 + 0.05);
    this.backMesh.receiveShadow = true;
    this.group.add(this.backMesh);

    this.layoutGroup.name = `RoomLayout_${config.id}`;
    this.group.add(this.layoutGroup);
    this.decorGroup = buildRoomDecor(config);
    this.group.add(this.decorGroup);

    // Overhead Spotlight & Ambient Lighting
    this.spotLight = new THREE.SpotLight(config.spotlightColor, config.spotlightIntensity, 28, Math.PI / 3.2, 0.45, 1.2);
    this.spotLight.position.set(0, 5.0, 3.5);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.bias = -0.00005;
    this.spotLight.shadow.normalBias = 0.015;
    this.group.add(this.spotLight);
    this.group.add(this.spotLight.target);

    this.roomAmbientLight = new THREE.HemisphereLight(config.ambientLightColor, 0x070709, config.ambientIntensity);
    this.group.add(this.roomAmbientLight);

    // Instantiate photos
    for (const itemData of config.items) {
      const photo = new HangingPhoto(itemData, renderer, undefined, sharedClipGeometry, sharedClipMaterial);
      this.photos.push(photo);
      this.group.add(photo.group);
    }

    this.overheadRail = new THREE.Object3D();
    this.buildLayoutAndTracks();
    this.setWind(config.windStrength);
    this.setGravity(config.gravityStrength);
  }

  private buildLayoutAndTracks(): void {
    this.clearLayoutGroup();
    const { layoutType } = this.config;
    const count = this.photos.length;

    if (layoutType === 'circular') {
      // 360° Circular Ring Layout (Portrait Room)
      const radius = 3.6;
      // Glowing circular halo rail
      const haloGeom = new THREE.TorusGeometry(radius, 0.025, 16, 48);
      const haloMat = new THREE.MeshPhysicalMaterial({
        color: 0x8a7752,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x221a0c,
      });
      const halo = new THREE.Mesh(haloGeom, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, TOP_LINE_Y + 0.95, 0);
      this.overheadRail = halo;
      this.layoutGroup.add(halo);

      // Center dais with subtle upward glow
      const daisGeom = new THREE.CylinderGeometry(1.6, 1.8, 0.2, 32);
      const daisMat = createGalleryMaterial('blackenedBronze', { emissive: 0x1f1608, emissiveIntensity: 0.45 });
      const dais = new THREE.Mesh(daisGeom, daisMat);
      dais.position.set(0, -3.5, 0);
      this.layoutGroup.add(dais);

      for (let i = 0; i < count; i++) {
        const photo = this.photos[i];
        const angle = (i / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        photo.group.position.set(x, TOP_LINE_Y - photo.height / 2, z);
        // Face toward center of the room
        photo.group.rotation.y = -angle - Math.PI / 2;
      }
    } else if (layoutType === 'semicircle') {
      // Semicircular Arc Layout (Memory Sanctuary)
      const radius = 4.2;
      const arcGeom = new THREE.TorusGeometry(radius, 0.03, 16, 48, Math.PI * 0.9);
      const arcMat = new THREE.MeshPhysicalMaterial({
        color: 0xa8925f,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0x33250f,
      });
      const arcRail = new THREE.Mesh(arcGeom, arcMat);
      arcRail.rotation.x = Math.PI / 2;
      arcRail.rotation.z = -Math.PI * 0.95;
      arcRail.position.set(0, TOP_LINE_Y + 0.95, 0.4);
      this.overheadRail = arcRail;
      this.layoutGroup.add(arcRail);

      // Central altar dais
      const daisGeom = new THREE.CylinderGeometry(2.0, 2.2, 0.25, 32);
      const daisMat = createGalleryMaterial('blackenedBronze', { emissive: 0x291807, emissiveIntensity: 0.55 });
      const dais = new THREE.Mesh(daisGeom, daisMat);
      dais.position.set(0, -3.45, 0);
      this.layoutGroup.add(dais);

      const totalAngle = Math.PI * 0.75;
      const startAngle = -totalAngle / 2;
      for (let i = 0; i < count; i++) {
        const photo = this.photos[i];
        const t = count === 1 ? 0.5 : i / (count - 1);
        const angle = startAngle + t * totalAngle;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius - radius * 0.45;
        photo.group.position.set(x, TOP_LINE_Y - photo.height / 2, z);
        photo.group.rotation.y = angle;
      }
    } else if (layoutType === 'angled-vista') {
      // Angled Depth Vista Layout (Travel Room)
      const railGeom = new THREE.CylinderGeometry(0.025, 0.025, 13, 24);
      const railMat = new THREE.MeshPhysicalMaterial({ color: 0x544c3d, metalness: 0.85, roughness: 0.3 });
      const rail = new THREE.Mesh(railGeom, railMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, TOP_LINE_Y + 0.95, 0);
      this.overheadRail = rail;
      this.layoutGroup.add(rail);

      const spacing = 4.4;
      const startX = -((count - 1) * spacing) / 2;
      for (let i = 0; i < count; i++) {
        const photo = this.photos[i];
        const x = startX + i * spacing;
        const z = (i % 2 === 0 ? 0.5 : -0.5);
        const rotY = (i % 2 === 0 ? -0.12 : 0.12);
        photo.group.position.set(x, TOP_LINE_Y - photo.height / 2, z);
        photo.group.rotation.y = rotY;
      }
    } else if (layoutType === 'staggered') {
      // Organic Staggered Layout (Nature Realm)
      const railGeom = new THREE.CylinderGeometry(0.025, 0.025, 12, 24);
      const railMat = new THREE.MeshPhysicalMaterial({ color: 0x3d4a3f, metalness: 0.8, roughness: 0.35 });
      const rail = new THREE.Mesh(railGeom, railMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, TOP_LINE_Y + 0.95, 0);
      this.overheadRail = rail;
      this.layoutGroup.add(rail);

      const spacing = 4.2;
      const startX = -((count - 1) * spacing) / 2;
      for (let i = 0; i < count; i++) {
        const photo = this.photos[i];
        const x = startX + i * spacing;
        const yOffset = (i % 2 === 0 ? 0.25 : -0.15);
        const z = (i % 2 === 0 ? 0.6 : -0.4);
        photo.group.position.set(x, TOP_LINE_Y - photo.height / 2 + yOffset, z);
        photo.group.rotation.y = (i % 2 === 0 ? -0.08 : 0.08);
      }
    } else if (layoutType === 'central-sculpture') {
      this.buildCentralSculptureLayout(count);
    } else if (layoutType === 'studio-grid') {
      this.buildStudioGridLayout(count);
    } else if (layoutType === 'archive-matrix') {
      this.buildArchiveMatrixLayout(count);
    } else {
      // Linear Perspective Gallery Layout (Urban)
      const railGeom = new THREE.CylinderGeometry(0.025, 0.025, 12.5, 24);
      const railMat = createGalleryMaterial('blackenedBronze');
      const rail = new THREE.Mesh(railGeom, railMat);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, TOP_LINE_Y + 0.95, 0);
      this.overheadRail = rail;
      this.layoutGroup.add(rail);

      const spacing = 4.5;
      const startX = -((count - 1) * spacing) / 2;
      for (let i = 0; i < count; i++) {
        const photo = this.photos[i];
        photo.group.position.set(startX + i * spacing, TOP_LINE_Y - photo.height / 2, 0);
        photo.group.rotation.y = 0;
      }
    }

    this.updateSpotlightTarget();
  }

  private buildCentralSculptureLayout(count: number): void {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.25, 0.035, 12, 64),
      createGalleryMaterial('blackenedBronze', { emissive: this.config.spotlightColor, emissiveIntensity: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, TOP_LINE_Y + 0.95, 0);
    this.overheadRail = ring;
    this.layoutGroup.add(ring);

    const spacing = 4.4;
    const startX = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const photo = this.photos[i];
      photo.group.position.set(startX + i * spacing, TOP_LINE_Y - photo.height / 2, 0.25 + (i % 2) * 0.3);
      photo.group.rotation.y = (i % 2 === 0 ? -0.12 : 0.12);
    }
  }

  private buildStudioGridLayout(count: number): void {
    const railGeom = new THREE.CylinderGeometry(0.025, 0.025, 11.5, 20);
    const rail = new THREE.Mesh(railGeom, createGalleryMaterial('brushedSteel'));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, TOP_LINE_Y + 0.95, 0.7);
    this.overheadRail = rail;
    this.layoutGroup.add(rail);

    const spacing = count <= 1 ? 0 : Math.min(4.1, 10.5 / Math.max(1, count - 1));
    const startX = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const photo = this.photos[i];
      photo.group.position.set(startX + i * spacing, TOP_LINE_Y - photo.height / 2, 0.55);
      photo.group.rotation.y = 0;
    }
  }

  private buildArchiveMatrixLayout(count: number): void {
    const railGeom = new THREE.CylinderGeometry(0.025, 0.025, 12, 20);
    const rail = new THREE.Mesh(railGeom, createGalleryMaterial('darkTimber'));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, TOP_LINE_Y + 0.95, -0.2);
    this.overheadRail = rail;
    this.layoutGroup.add(rail);

    const spacing = count <= 1 ? 0 : Math.min(3.8, 9.4 / Math.max(1, count - 1));
    const startX = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const photo = this.photos[i];
      photo.group.position.set(startX + i * spacing, TOP_LINE_Y - photo.height / 2, 0.25);
      photo.group.rotation.y = 0;
    }
  }

  private clearLayoutGroup(): void {
    for (const child of [...this.layoutGroup.children]) {
      child.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material?.dispose();
        }
      });
      child.removeFromParent();
    }
    this.overheadRail = new THREE.Object3D();
  }

  addCustomPhoto(
    data: GalleryItemData,
    texture: THREE.Texture,
    renderer: THREE.WebGPURenderer,
  ): HangingPhoto {
    const photo = new HangingPhoto(data, renderer, texture);
    this.photos.push(photo);
    this.group.add(photo.group);

    // Recompute layout
    this.buildLayoutAndTracks();
    this.activeIndex = this.photos.length - 1;
    return photo;
  }

  getActiveIndex(): number {
    return this.activeIndex;
  }

  getActivePhoto(): HangingPhoto | null {
    return this.photos[this.activeIndex] ?? null;
  }

  getCameraDistanceBounds(): RoomCameraDistanceBounds {
    return ROOM_CAMERA_DISTANCE_BOUNDS;
  }

  setActiveIndex(index: number): boolean {
    if (index < 0 || index >= this.photos.length) return false;
    this.activeIndex = index;
    this.updateSpotlightTarget();
    return true;
  }

  getPhotoWorldTransform(index: number): { position: THREE.Vector3; forward: THREE.Vector3 } {
    const photo = this.photos[index] ?? this.getActivePhoto();
    if (!photo) {
      return {
        position: this.group.position.clone(),
        forward: new THREE.Vector3(0, 0, 1),
      };
    }

    photo.group.updateWorldMatrix(true, false);
    const position = new THREE.Vector3();
    photo.group.getWorldPosition(position);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(photo.group.quaternion).normalize();
    return { position, forward };
  }

  private updateSpotlightTarget(): void {
    const active = this.getActivePhoto();
    if (active) {
      this.spotLight.target.position.set(active.group.position.x, active.group.position.y, active.group.position.z);
      this.spotLight.position.set(active.group.position.x * 0.4, 5.0, active.group.position.z + 3.5);
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
    for (const photo of this.photos) {
      photo.applyImpulse(impulse);
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
      if (i === currentPhotoIndex) {
        this.photos[i].setSimulationTier('active');
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
    this.frameMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.floorMesh.geometry.dispose();
    (this.floorMesh.material as THREE.Material).dispose();
    this.backMesh.geometry.dispose();
    (this.backMesh.material as THREE.Material).dispose();
    this.clearLayoutGroup();
    this.decorGroup.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material?.dispose();
      }
    });
    this.decorGroup.removeFromParent();
  }
}
