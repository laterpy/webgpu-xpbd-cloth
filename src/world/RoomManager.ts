import * as THREE from 'three/webgpu';
import { GALLERY_ROOMS } from '../gallery/GalleryManifest';
import { Room } from './Room';
import { HangingPhoto } from '../gallery/HangingPhoto';
import { GalleryItemData } from '../gallery/GalleryItem';

const ROOM_DISTANCE = 40; // Spatial offset between rooms in 3D world

export class RoomManager {
  readonly rootGroup = new THREE.Group();
  readonly rooms: Room[] = [];

  private activeRoomIndex = 0;
  private sharedClipGeom = new THREE.BoxGeometry(0.16, 0.11, 0.12);
  private sharedClipMat = new THREE.MeshPhysicalMaterial({
    color: 0xa89366,
    metalness: 0.88,
    roughness: 0.28,
    clearcoat: 0.35,
  });

  constructor(private readonly renderer: THREE.WebGPURenderer) {
    this.rootGroup.name = 'SpatialRoomsRoot';

    // Instantiate all curated rooms in spatial arrangement
    for (let i = 0; i < GALLERY_ROOMS.length; i++) {
      const roomConfig = GALLERY_ROOMS[i];
      const room = new Room(roomConfig, renderer, this.sharedClipGeom, this.sharedClipMat);
      room.group.position.x = i * ROOM_DISTANCE;
      this.rooms.push(room);
      this.rootGroup.add(room.group);
    }

    this.updateLOD();
  }

  getActiveRoomIndex(): number {
    return this.activeRoomIndex;
  }

  getActiveRoom(): Room {
    return this.rooms[this.activeRoomIndex];
  }

  getActivePhoto(): HangingPhoto | null {
    return this.getActiveRoom().getActivePhoto();
  }

  getRoomCount(): number {
    return this.rooms.length;
  }

  switchRoom(targetIndex: number): boolean {
    if (targetIndex < 0 || targetIndex >= this.rooms.length || targetIndex === this.activeRoomIndex) {
      return false;
    }

    const direction = targetIndex > this.activeRoomIndex ? 1 : -1;
    this.activeRoomIndex = targetIndex;
    const currentRoom = this.getActiveRoom();

    // Trigger directional air wave impulse across the new room's photos
    const airImpulse = new THREE.Vector3(direction * 0.8, 0.2, 0.6);
    currentRoom.applyImpulse(airImpulse);

    this.updateLOD();
    return true;
  }

  addCustomImage(
    data: GalleryItemData,
    texture: THREE.Texture,
  ): HangingPhoto {
    const activeRoom = this.getActiveRoom();
    const photo = activeRoom.addCustomPhoto(data, texture, this.renderer);
    this.updateLOD();
    return photo;
  }

  setWind(strength: number): void {
    for (const room of this.rooms) {
      room.setWind(strength);
    }
  }

  setGravity(magnitude: number): void {
    for (const room of this.rooms) {
      room.setGravity(magnitude);
    }
  }

  setStabilizing(stabilizing: boolean): void {
    this.getActiveRoom().setStabilizing(stabilizing);
  }

  updateLOD(): void {
    for (let r = 0; r < this.rooms.length; r++) {
      const isCurrent = r === this.activeRoomIndex;
      const room = this.rooms[r];
      room.updateLOD(isCurrent, room.getActiveIndex());
    }
  }

  step(dt: number, time: number): void {
    const currentRoom = this.getActiveRoom();
    currentRoom.step(this.renderer, dt, time);
  }

  resetCurrentPhoto(): void {
    const activePhoto = this.getActivePhoto();
    if (activePhoto) {
      activePhoto.reset(this.renderer);
    }
  }

  dispose(): void {
    for (const room of this.rooms) {
      room.dispose(this.renderer);
    }
    this.rooms.length = 0;
    this.rootGroup.removeFromParent();
    this.sharedClipGeom.dispose();
    this.sharedClipMat.dispose();
  }
}
