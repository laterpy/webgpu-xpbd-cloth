import * as THREE from 'three/webgpu';
import { HangingPhoto } from '../gallery/HangingPhoto';

export class HoverPhysics {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly localPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly worldPlane = new THREE.Plane();
  private readonly worldPoint = new THREE.Vector3();
  private readonly localPoint = new THREE.Vector3();
  private readonly inverseWorldMatrix = new THREE.Matrix4();
  private lastHoveredPhoto: HangingPhoto | null = null;

  constructor(
    private readonly domElement: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly getTarget: () => HangingPhoto | null,
  ) {}

  updatePointer(clientX: number, clientY: number): void {
    const target = this.getTarget();
    if (!target) {
      this.clearHover();
      return;
    }

    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    target.group.updateWorldMatrix(true, false);
    this.worldPlane.copy(this.localPlane).applyMatrix4(target.group.matrixWorld);

    if (!this.raycaster.ray.intersectPlane(this.worldPlane, this.worldPoint)) {
      this.clearHover();
      return;
    }

    this.inverseWorldMatrix.copy(target.group.matrixWorld).invert();
    this.localPoint.copy(this.worldPoint).applyMatrix4(this.inverseWorldMatrix);

    // Check if pointer is within cloth bounds or proximity margin
    const margin = 0.4;
    const isInside = Math.abs(this.localPoint.x) <= target.width / 2 + margin
      && Math.abs(this.localPoint.y) <= target.height / 2 + margin;

    if (isInside) {
      target.setHover(true, this.localPoint.x, this.localPoint.y, 0.75);
      this.lastHoveredPhoto = target;
    } else {
      this.clearHover();
    }
  }

  clearHover(): void {
    if (this.lastHoveredPhoto) {
      this.lastHoveredPhoto.setHover(false);
      this.lastHoveredPhoto = null;
    }
  }

  dispose(): void {
    this.clearHover();
  }
}
