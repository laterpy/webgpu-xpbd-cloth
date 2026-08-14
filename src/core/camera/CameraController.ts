import * as THREE from 'three/webgpu';
import { HangingPhoto } from '../../gallery/HangingPhoto';

export type CameraMode = 'entrance' | 'browse' | 'focus' | 'roomTravel';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  private mode: CameraMode = 'entrance';
  private targetPosition = new THREE.Vector3(0, 0, 14);
  private targetLookAt = new THREE.Vector3(0, 0, 0);
  private currentLookAt = new THREE.Vector3(0, 0, 0);
  private viewportTopInset = 0;
  private viewportBottomInset = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 120);
    this.camera.position.set(0, 0, 14);
    this.camera.lookAt(0, 0, 0);
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  getMode(): CameraMode {
    return this.mode;
  }

  setInsets(top: number, bottom: number): void {
    this.viewportTopInset = Math.max(0, top);
    this.viewportBottomInset = Math.max(0, bottom);
  }

  updateTarget(
    activePhoto: HangingPhoto | null,
    roomWorldX: number,
    entranceOpenProgress = 0,
  ): void {
    if (this.mode === 'entrance') {
      // Pull back in darkness, move forward as entrance opens
      const z = THREE.MathUtils.lerp(14, 8.5, entranceOpenProgress);
      this.targetPosition.set(0, 0, z);
      this.targetLookAt.set(0, 0, 0);
      return;
    }

    if (!activePhoto) return;

    const photoWorldX = roomWorldX + activePhoto.group.position.x;
    const photoWorldY = activePhoto.group.position.y;
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const viewportHeight = Math.max(1, window.innerHeight);
    const usableHeight = Math.max(1, viewportHeight - this.viewportTopInset - this.viewportBottomInset);
    const usableFraction = usableHeight / viewportHeight;

    if (this.mode === 'focus') {
      // Cinematic Dolly In closer to active photo
      const fitWidth = activePhoto.width * 1.05;
      const fitHeight = activePhoto.height * 1.05;
      const distanceForWidth = fitWidth / Math.max(0.01, 2 * tangent * this.camera.aspect);
      const distanceForHeight = fitHeight / Math.max(0.01, 2 * tangent);
      const idealZ = Math.max(3.2, Math.max(distanceForWidth, distanceForHeight) * 1.02);

      this.targetPosition.set(photoWorldX, photoWorldY, idealZ);
      this.targetLookAt.set(photoWorldX, photoWorldY, 0);
    } else {
      // Standard Browse Mode
      const horizontalPadding = this.camera.aspect >= 0.8 ? 0.9 : 0.34;
      const fitWidth = activePhoto.width + horizontalPadding;
      const fitHeight = activePhoto.height + 0.72;
      const distanceForWidth = fitWidth / Math.max(0.01, 2 * tangent * this.camera.aspect);
      const distanceForHeight = fitHeight / Math.max(0.01, 2 * tangent * usableFraction);
      const idealZ = THREE.MathUtils.clamp(Math.max(distanceForWidth, distanceForHeight) * 1.08, 5.4, 28);

      const usableCenter = this.viewportTopInset + usableHeight / 2;
      const desiredNdcY = 1 - (usableCenter / viewportHeight) * 2;
      const targetLookY = photoWorldY - desiredNdcY * idealZ * tangent;

      this.targetPosition.set(photoWorldX, photoWorldY * 0.4, idealZ);
      this.targetLookAt.set(photoWorldX, targetLookY, 0);
    }
  }

  update(dt: number): void {
    const smoothSpeed = this.mode === 'focus' ? 6.5 : (this.mode === 'entrance' ? 4.0 : 7.0);
    const alpha = 1 - Math.exp(-smoothSpeed * Math.max(0, dt));

    this.camera.position.lerp(this.targetPosition, alpha);
    this.currentLookAt.lerp(this.targetLookAt, alpha);
    this.camera.lookAt(this.currentLookAt);
  }

  handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
