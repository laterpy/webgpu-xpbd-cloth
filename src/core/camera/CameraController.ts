import * as THREE from 'three/webgpu';
import { HangingPhoto } from '../../gallery/HangingPhoto';
import { Room } from '../../world/Room';

export type CameraMode =
  | 'entrance'
  | 'corridor'
  | 'doorTransition'
  | 'inRoom'
  | 'focus'
  | 'exitTransition';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  private mode: CameraMode = 'entrance';
  private targetPosition = new THREE.Vector3(0, 0, -28);
  private targetLookAt = new THREE.Vector3(0, 0, -22);
  private currentLookAt = new THREE.Vector3(0, 0, -22);

  // Corridor progress & station
  private corridorZ = -10;
  private targetCorridorZ = -10;
  private corridorYaw = 0;
  private targetCorridorYaw = 0;

  // In-room free orbit offset
  private orbitYaw = 0;
  private orbitPitch = 0;
  private targetOrbitYaw = 0;
  private targetOrbitPitch = 0;
  private targetRoomDistance = 8.5;

  private viewportTopInset = 70;
  private viewportBottomInset = 75;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 160);
    this.camera.position.set(0, 0, -28);
    this.camera.lookAt(0, 0, -22);
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'corridor' || mode === 'entrance') {
      this.targetOrbitYaw = 0;
      this.targetOrbitPitch = 0;
    }
  }

  getMode(): CameraMode {
    return this.mode;
  }

  setInsets(top: number, bottom: number): void {
    this.viewportTopInset = Math.max(0, top);
    this.viewportBottomInset = Math.max(0, bottom);
  }

  setCorridorTargetZ(targetZ: number, yawOffset = 0): void {
    this.targetCorridorZ = targetZ;
    this.targetCorridorYaw = yawOffset;
  }

  addOrbitOffset(deltaX: number, deltaY: number): void {
    if (this.mode === 'inRoom') {
      this.targetOrbitYaw += deltaX * 0.004;
      this.targetOrbitPitch = THREE.MathUtils.clamp(
        this.targetOrbitPitch - deltaY * 0.003,
        -0.45,
        0.45,
      );
    }
  }

  addRoomWalkOffset(distanceDelta: number, activeRoom: Room | null): void {
    if (this.mode !== 'inRoom' || !activeRoom) return;
    const bounds = activeRoom.getCameraDistanceBounds();
    this.targetRoomDistance = THREE.MathUtils.clamp(
      this.targetRoomDistance + distanceDelta,
      bounds.min,
      bounds.max,
    );
  }

  resetRoomView(activeRoom: Room | null): void {
    this.targetOrbitYaw = 0;
    this.targetOrbitPitch = 0;
    this.targetRoomDistance = activeRoom?.getCameraDistanceBounds().initial ?? 8.5;
  }

  updateTarget(
    activeRoom: Room | null,
    activePhoto: HangingPhoto | null,
    entranceOpenProgress = 0,
    doorTransitionProgress = 0,
    isExiting = false,
  ): void {
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const viewportHeight = Math.max(1, window.innerHeight);
    const usableHeight = Math.max(1, viewportHeight - this.viewportTopInset - this.viewportBottomInset);
    const usableFraction = usableHeight / viewportHeight;

    if (this.mode === 'entrance') {
      const z = THREE.MathUtils.lerp(-28, -20, entranceOpenProgress);
      this.targetPosition.set(0, 0, z);
      this.targetLookAt.set(0, 0, -10);
      return;
    }

    if (this.mode === 'corridor') {
      // Gliding along the central corridor
      const lookDist = 14;
      const x = Math.sin(this.targetCorridorYaw) * 1.5;
      this.targetPosition.set(x, 0.3, this.targetCorridorZ);
      this.targetLookAt.set(
        Math.sin(this.targetCorridorYaw) * 6.0,
        0.3,
        this.targetCorridorZ + lookDist,
      );
      return;
    }

    if (!activeRoom) return;

    const roomPos = activeRoom.group.position;
    const isLeftRoom = roomPos.x < 0;
    const doorwayZ = roomPos.z;

    if (this.mode === 'doorTransition' || this.mode === 'exitTransition') {
      // Interpolate camera through doorway into/out of room
      const t = isExiting ? (1 - doorTransitionProgress) : doorTransitionProgress;
      const camX = THREE.MathUtils.lerp(0, roomPos.x, t);
      const camZ = doorwayZ;
      const camY = 0.3;

      const lookTargetX = THREE.MathUtils.lerp(isLeftRoom ? -12 : 12, roomPos.x, t);
      this.targetPosition.set(camX, camY, camZ);
      this.targetLookAt.set(lookTargetX, camY, doorwayZ);
      return;
    }

    if (this.mode === 'inRoom') {
      if (!activePhoto) {
        this.targetPosition.set(roomPos.x, roomPos.y, roomPos.z + 8.5);
        this.targetLookAt.set(roomPos.x, roomPos.y, roomPos.z);
        return;
      }

      // Inside Room facing active photo in 3D
      const { position: photoPos, forward: photoForward } = activeRoom.getPhotoWorldTransform(activeRoom.getActiveIndex());

      const horizontalPadding = this.camera.aspect >= 0.8 ? 0.9 : 0.34;
      const fitWidth = activePhoto.width + horizontalPadding;
      const fitHeight = activePhoto.height + 0.72;
      const distanceForWidth = fitWidth / Math.max(0.01, 2 * tangent * this.camera.aspect);
      const distanceForHeight = fitHeight / Math.max(0.01, 2 * tangent * usableFraction);
      const bounds = activeRoom.getCameraDistanceBounds();
      const minimumFramingDistance = Math.max(
        bounds.min,
        Math.max(distanceForWidth, distanceForHeight) * 1.08,
      );
      const desiredDistance = THREE.MathUtils.clamp(
        Math.max(this.targetRoomDistance, minimumFramingDistance),
        minimumFramingDistance,
        bounds.max,
      );
      this.targetRoomDistance = desiredDistance;

      const rotatedForward = photoForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.targetOrbitYaw);
      const eye = photoPos.clone().addScaledVector(rotatedForward, desiredDistance);
      eye.y += this.targetOrbitPitch * 3.0;

      const usableCenter = this.viewportTopInset + usableHeight / 2;
      const desiredNdcY = 1 - (usableCenter / viewportHeight) * 2;
      const lookAtY = photoPos.y - desiredNdcY * desiredDistance * tangent;

      this.targetPosition.copy(eye);
      this.targetLookAt.set(photoPos.x, lookAtY, photoPos.z);
      return;
    }

    if (this.mode === 'focus' && activePhoto) {
      // Close-up cinematic focus
      const { position: photoPos, forward: photoForward } = activeRoom.getPhotoWorldTransform(activeRoom.getActiveIndex());
      const fitWidth = activePhoto.width * 1.05;
      const fitHeight = activePhoto.height * 1.05;
      const distanceForWidth = fitWidth / Math.max(0.01, 2 * tangent * this.camera.aspect);
      const distanceForHeight = fitHeight / Math.max(0.01, 2 * tangent);
      const idealDist = Math.max(3.2, Math.max(distanceForWidth, distanceForHeight) * 1.02);

      const eye = photoPos.clone().addScaledVector(photoForward, idealDist);
      this.targetPosition.copy(eye);
      this.targetLookAt.copy(photoPos);
    }
  }

  update(dt: number): void {
    const smoothSpeed = this.mode === 'focus' ? 6.5 : (this.mode === 'corridor' ? 5.0 : 6.0);
    const alpha = 1 - Math.exp(-smoothSpeed * Math.max(0, dt));

    this.corridorZ = THREE.MathUtils.lerp(this.corridorZ, this.targetCorridorZ, alpha);
    this.corridorYaw = THREE.MathUtils.lerp(this.corridorYaw, this.targetCorridorYaw, alpha);
    this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, this.targetOrbitYaw, alpha);
    this.orbitPitch = THREE.MathUtils.lerp(this.orbitPitch, this.targetOrbitPitch, alpha);

    this.camera.position.lerp(this.targetPosition, alpha);
    this.currentLookAt.lerp(this.targetLookAt, alpha);
    this.camera.lookAt(this.currentLookAt);
  }

  handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
