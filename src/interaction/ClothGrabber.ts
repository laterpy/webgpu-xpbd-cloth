import * as THREE from 'three/webgpu';
import type { ClothSimulation } from '../cloth/ClothSimulation';

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
  private activeTarget: ClothGrabTarget | null = null;

  constructor(
    private readonly element: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly getTarget: () => ClothGrabTarget | null,
  ) {
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('lostpointercapture', this.onLostPointerCapture);
  }

  private updateRay(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private intersectTarget(event: PointerEvent, target: ClothGrabTarget): THREE.Vector3 | null {
    this.updateRay(event);
    target.transform.updateWorldMatrix(true, false);
    this.worldPlane.copy(this.localPlane).applyMatrix4(target.transform.matrixWorld);
    if (!this.raycaster.ray.intersectPlane(this.worldPlane, this.worldPoint)) return null;
    this.inverseWorldMatrix.copy(target.transform.matrixWorld).invert();
    return this.localPoint.copy(this.worldPoint).applyMatrix4(this.inverseWorldMatrix);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const target = this.getTarget();
    if (!target) return;
    const point = this.intersectTarget(event, target);
    if (!point) return;

    const index = target.cloth.vertexIndexFromLocal(point.x, point.y);
    if (index === null) return;
    if (!target.cloth.beginGrab(index, point)) return;

    this.activePointer = event.pointerId;
    this.activeTarget = target;
    this.element.setPointerCapture(event.pointerId);
    this.element.classList.add('is-grabbing');

    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.activePointer !== event.pointerId || !this.activeTarget) return;
    const point = this.intersectTarget(event, this.activeTarget);
    if (!point) return;
    this.activeTarget.cloth.moveGrab(point);
    event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.activePointer !== event.pointerId) return;
    if (this.element.hasPointerCapture(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
    this.cancelGrab();
  };

  private onLostPointerCapture = (event: PointerEvent): void => {
    if (this.activePointer === event.pointerId) this.cancelGrab();
  };

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
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('lostpointercapture', this.onLostPointerCapture);
  }
}
