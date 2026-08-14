import * as THREE from 'three/webgpu';
import { HangingPhoto } from '../gallery/HangingPhoto';
import { ClothSimulation } from '../cloth/ClothSimulation';

export interface ClothGrabTarget {
  cloth: ClothSimulation;
  transform: THREE.Object3D;
}

export class ClothGrabber {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly localPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly worldPlane = new THREE.Plane();
  private readonly worldPoint = new THREE.Vector3();
  private readonly localPoint = new THREE.Vector3();
  private readonly inverseWorldMatrix = new THREE.Matrix4();
  private activePointer: number | null = null;
  private activeTarget: HangingPhoto | null = null;

  constructor(
    private readonly element: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly getTarget: () => HangingPhoto | null,
  ) {}

  private updateRay(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  intersectTarget(event: PointerEvent, target: HangingPhoto): THREE.Vector3 | null {
    this.updateRay(event);
    target.group.updateWorldMatrix(true, false);
    this.worldPlane.copy(this.localPlane).applyMatrix4(target.group.matrixWorld);
    if (!this.raycaster.ray.intersectPlane(this.worldPlane, this.worldPoint)) return null;
    this.inverseWorldMatrix.copy(target.group.matrixWorld).invert();
    return this.localPoint.copy(this.worldPoint).applyMatrix4(this.inverseWorldMatrix);
  }

  startGrab(event: PointerEvent, target: HangingPhoto, point: THREE.Vector3): boolean {
    const index = target.cloth.vertexIndexFromLocal(point.x, point.y);
    if (index === null) return false;
    if (!target.cloth.beginGrab(index, point)) return false;

    this.activePointer = event.pointerId;
    this.activeTarget = target;
    this.element.setPointerCapture(event.pointerId);
    this.element.classList.add('is-grabbing');
    return true;
  }

  moveGrab(event: PointerEvent): void {
    if (this.activePointer !== event.pointerId || !this.activeTarget) return;
    const point = this.intersectTarget(event, this.activeTarget);
    if (!point) return;
    this.activeTarget.cloth.moveGrab(point);
  }

  endGrab(event: PointerEvent): void {
    if (this.activePointer !== event.pointerId) return;
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
    this.cancelGrab();
  }

  get isGrabbing(): boolean {
    return this.activePointer !== null;
  }

  cancelGrab(): void {
    this.activeTarget?.cloth.releaseGrab();
    this.activePointer = null;
    this.activeTarget = null;
    this.element.classList.remove('is-grabbing');
  }

  dispose(): void {
    this.cancelGrab();
  }
}
