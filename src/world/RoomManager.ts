import * as THREE from 'three/webgpu';
import { GALLERY_ROOMS, RoomConfig } from '../gallery/GalleryManifest';
import { Room } from './Room';
import { ThematicDoor } from './ThematicDoor';
import { HangingPhoto } from '../gallery/HangingPhoto';
import { GalleryItemData } from '../gallery/GalleryItem';
import { ROOM_CHAMBER_WIDTH } from './Room';

export const CORRIDOR_STATION_Z = [-10, 6, 22, 38];
const CORRIDOR_HALF_WIDTH = 4.5;
const ROOM_OFFSET_X = CORRIDOR_HALF_WIDTH + ROOM_CHAMBER_WIDTH / 2;

export class RoomManager {
  readonly rootGroup = new THREE.Group();
  readonly rooms: Room[] = [];
  readonly doors: ThematicDoor[] = [];

  private activeRoomIndex = 0;
  private sharedClipGeom = new THREE.BoxGeometry(0.16, 0.11, 0.12);
  private sharedClipMat = new THREE.MeshPhysicalMaterial({
    color: 0xa89366,
    metalness: 0.88,
    roughness: 0.28,
    clearcoat: 0.35,
  });

  constructor(private readonly renderer: THREE.WebGPURenderer) {
    this.rootGroup.name = 'SpatialPromenadeRoot';

    for (let i = 0; i < GALLERY_ROOMS.length; i++) {
      const roomConfig = GALLERY_ROOMS[i];
      const stationIndex = Math.floor(i / 2);
      const isLeft = i % 2 === 0;

      const stationZ = CORRIDOR_STATION_Z[stationIndex] ?? 0;
      const doorX = isLeft ? -CORRIDOR_HALF_WIDTH : CORRIDOR_HALF_WIDTH;
      const doorRotY = isLeft ? Math.PI / 2 : -Math.PI / 2;

      // 1. Create Door along the corridor wall
      const door = new ThematicDoor(roomConfig, i);
      door.group.position.set(doorX, 0, stationZ);
      door.group.rotation.y = doorRotY;
      this.doors.push(door);
      this.rootGroup.add(door.group);

      // 2. Create Themed Room outside the doorway
      const room = new Room(roomConfig, renderer, this.sharedClipGeom, this.sharedClipMat);
      const roomX = isLeft ? -ROOM_OFFSET_X : ROOM_OFFSET_X;
      room.group.position.set(roomX, 0, stationZ);
      this.rooms.push(room);
      this.rootGroup.add(room.group);
    }

    this.updateLOD(true, 0);
  }

  getActiveRoomIndex(): number {
    return this.activeRoomIndex;
  }

  setActiveRoomIndex(index: number): void {
    if (index >= 0 && index < this.rooms.length) {
      this.activeRoomIndex = index;
    }
  }

  getActiveRoom(): Room {
    return this.rooms[this.activeRoomIndex];
  }

  getActivePhoto(): HangingPhoto | null {
    return this.getActiveRoom().getActivePhoto();
  }

  getDoor(index: number): ThematicDoor | null {
    return this.doors[index] ?? null;
  }

  getStationCount(): number {
    return CORRIDOR_STATION_Z.length;
  }

  getStationZ(stationIndex: number): number {
    return CORRIDOR_STATION_Z[THREE.MathUtils.clamp(stationIndex, 0, CORRIDOR_STATION_Z.length - 1)];
  }

  getRoomDoorsAtStation(stationIndex: number): { left: ThematicDoor; right: ThematicDoor } {
    const leftIdx = stationIndex * 2;
    const rightIdx = stationIndex * 2 + 1;
    return {
      left: this.doors[leftIdx],
      right: this.doors[rightIdx],
    };
  }

  setDoorOpenProgress(doorIndex: number, progress: number): void {
    const door = this.doors[doorIndex];
    if (door) {
      door.setOpenProgress(progress);
    }
  }

  resetAllDoors(): void {
    for (const door of this.doors) {
      door.setOpenProgress(0);
      door.setHovered(false);
    }
  }

  raycastDoor(raycaster: THREE.Raycaster): number | null {
    const hits: Array<{ index: number; distance: number }> = [];

    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      const box = new THREE.Box3().setFromObject(door.group);
      if (raycaster.ray.intersectsBox(box)) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        hits.push({ index: i, distance: raycaster.ray.origin.distanceTo(center) });
      }
    }

    if (hits.length > 0) {
      hits.sort((a, b) => a.distance - b.distance);
      return hits[0].index;
    }
    return null;
  }

  addCustomImage(
    data: GalleryItemData,
    texture: THREE.Texture,
  ): HangingPhoto {
    const activeRoom = this.getActiveRoom();
    const photo = activeRoom.addCustomPhoto(data, texture, this.renderer);
    this.updateLOD(false, this.activeRoomIndex);
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

  updateLOD(isInCorridor: boolean, currentRoomIndex: number): void {
    for (let r = 0; r < this.rooms.length; r++) {
      const isCurrent = !isInCorridor && r === currentRoomIndex;
      const isCorridorStationRoom = isInCorridor
        && Math.floor(r / 2) === Math.floor(currentRoomIndex / 2);
      const room = this.rooms[r];
      room.group.visible = isCurrent || isCorridorStationRoom;
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
    for (const door of this.doors) {
      door.dispose();
    }
    this.rooms.length = 0;
    this.doors.length = 0;
    this.rootGroup.removeFromParent();
    this.sharedClipGeom.dispose();
    this.sharedClipMat.dispose();
  }
}
