import * as THREE from 'three/webgpu';
import { ClothGrabber } from './ClothGrabber';
import { HoverPhysics } from './HoverPhysics';
import { HangingPhoto } from '../gallery/HangingPhoto';

export interface InputCallbacks {
  onPhotoClick: (photo: HangingPhoto) => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onResetActive: () => void;
  onEscape: () => void;
}

export class InputManager {
  private readonly grabber: ClothGrabber;
  private readonly hoverPhysics: HoverPhysics;
  private pointerDownState: {
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    candidatePhoto: HangingPhoto | null;
    candidatePoint: THREE.Vector3 | null;
    isDragging: boolean;
  } | null = null;

  private wheelAccumulator = 0;
  private wheelResetTimer = 0;
  private wheelLocked = false;

  constructor(
    private readonly element: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly getActivePhoto: () => HangingPhoto | null,
    private readonly callbacks: InputCallbacks,
  ) {
    this.grabber = new ClothGrabber(element, camera, getActivePhoto);
    this.hoverPhysics = new HoverPhysics(element, camera, getActivePhoto);

    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('keydown', this.onKeyDown);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const target = this.getActivePhoto();
    if (!target) return;

    const localPoint = this.grabber.intersectTarget(event, target);
    if (!localPoint) return;

    this.pointerDownState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      candidatePhoto: target,
      candidatePoint: localPoint.clone(),
      isDragging: false,
    };
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.pointerDownState && this.pointerDownState.pointerId === event.pointerId) {
      const state = this.pointerDownState;
      const distSq = (event.clientX - state.startX) ** 2 + (event.clientY - state.startY) ** 2;

      if (!state.isDragging && distSq > 36) { // > 6px movement
        if (state.candidatePhoto && state.candidatePoint) {
          const started = this.grabber.startGrab(event, state.candidatePhoto, state.candidatePoint);
          if (started) {
            state.isDragging = true;
          }
        }
      }

      if (state.isDragging) {
        this.grabber.moveGrab(event);
      }
      return;
    }

    // Hover air perturbation
    this.hoverPhysics.updatePointer(event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDownState || this.pointerDownState.pointerId !== event.pointerId) return;

    const state = this.pointerDownState;
    this.pointerDownState = null;

    if (state.isDragging) {
      this.grabber.endGrab(event);
      return;
    }

    const duration = performance.now() - state.startTime;
    const distSq = (event.clientX - state.startX) ** 2 + (event.clientY - state.startY) ** 2;

    // Pure click detection
    if (duration < 350 && distSq <= 36 && state.candidatePhoto) {
      this.callbacks.onPhotoClick(state.candidatePhoto);
    }
  };

  private onWheel = (event: WheelEvent): void => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();

    window.clearTimeout(this.wheelResetTimer);
    this.wheelResetTimer = window.setTimeout(() => {
      this.wheelLocked = false;
      this.wheelAccumulator = 0;
    }, 220);

    if (this.wheelLocked) return;
    this.wheelAccumulator += event.deltaX;
    if (Math.abs(this.wheelAccumulator) < 45) return;

    if (this.wheelAccumulator > 0) {
      this.callbacks.onNavigateNext();
    } else {
      this.callbacks.onNavigatePrevious();
    }
    this.wheelAccumulator = 0;
    this.wheelLocked = true;
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    let handled = true;
    if (event.key === 'ArrowLeft') this.callbacks.onNavigatePrevious();
    else if (event.key === 'ArrowRight') this.callbacks.onNavigateNext();
    else if (event.key.toLowerCase() === 'r') this.callbacks.onResetActive();
    else if (event.key === 'Escape') this.callbacks.onEscape();
    else handled = false;

    if (handled) event.preventDefault();
  };

  cancelActiveInteractions(): void {
    this.pointerDownState = null;
    this.grabber.cancelGrab();
    this.hoverPhysics.clearHover();
  }

  dispose(): void {
    this.cancelActiveInteractions();
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('keydown', this.onKeyDown);
    this.grabber.dispose();
    this.hoverPhysics.dispose();
  }
}
