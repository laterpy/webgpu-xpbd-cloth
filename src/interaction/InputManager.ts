import * as THREE from 'three/webgpu';
import { ClothGrabber } from './ClothGrabber';
import { HoverPhysics } from './HoverPhysics';
import { HangingPhoto } from '../gallery/HangingPhoto';
import { RoomManager } from '../world/RoomManager';

export interface InputCallbacks {
  onPhotoClick: (photo: HangingPhoto) => void;
  onDoorClick: (doorIndex: number) => void;
  onOrbitDrag: (deltaX: number, deltaY: number) => void;
  onRoomWalk: (distanceDelta: number) => void;
  onCorridorForward: () => void;
  onCorridorBackward: () => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onResetActive: () => void;
  onEscape: () => void;
}

export class InputManager {
  private readonly grabber: ClothGrabber;
  private readonly hoverPhysics: HoverPhysics;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private isCorridorMode = false;
  private hoveredDoorIndex: number | null = null;

  private pointerDownState: {
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    candidatePhoto: HangingPhoto | null;
    candidatePoint: THREE.Vector3 | null;
    isPhotoDragging: boolean;
    isOrbitDragging: boolean;
  } | null = null;

  private wheelAccumulator = 0;
  private wheelResetTimer = 0;
  private wheelLocked = false;

  constructor(
    private readonly element: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly roomManager: RoomManager,
    private readonly callbacks: InputCallbacks,
  ) {
    this.grabber = new ClothGrabber(element, camera, () => this.roomManager.getActivePhoto());
    this.hoverPhysics = new HoverPhysics(element, camera, () => this.roomManager.getActivePhoto());

    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('keydown', this.onKeyDown);
  }

  setCorridorMode(isCorridor: boolean): void {
    this.isCorridorMode = isCorridor;
    this.element.focus({ preventScroll: true });
    this.cancelActiveInteractions();
    if (!isCorridor && this.hoveredDoorIndex !== null) {
      const door = this.roomManager.getDoor(this.hoveredDoorIndex);
      door?.setHovered(false);
      this.hoveredDoorIndex = null;
    }
  }

  private updateRay(clientX: number, clientY: number): void {
    const rect = this.element.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    this.element.focus({ preventScroll: true });
    this.updateRay(event.clientX, event.clientY);

    if (this.isCorridorMode) {
      this.pointerDownState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startTime: performance.now(),
        candidatePhoto: null,
        candidatePoint: null,
        isPhotoDragging: false,
        isOrbitDragging: false,
      };
      return;
    }

    const activePhoto = this.roomManager.getActivePhoto();
    let localPoint: THREE.Vector3 | null = null;

    if (activePhoto) {
      localPoint = this.grabber.intersectTarget(event, activePhoto);
    }

    this.pointerDownState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startTime: performance.now(),
      candidatePhoto: localPoint ? activePhoto : null,
      candidatePoint: localPoint ? localPoint.clone() : null,
      isPhotoDragging: false,
      isOrbitDragging: false,
    };
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.pointerDownState && this.pointerDownState.pointerId === event.pointerId) {
      const state = this.pointerDownState;
      const deltaX = event.clientX - state.lastX;
      const deltaY = event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;

      const totalDistSq = (event.clientX - state.startX) ** 2 + (event.clientY - state.startY) ** 2;

      if (!state.isPhotoDragging && !state.isOrbitDragging && totalDistSq > 36) {
        if (state.candidatePhoto && state.candidatePoint) {
          const started = this.grabber.startGrab(event, state.candidatePhoto, state.candidatePoint);
          if (started) {
            state.isPhotoDragging = true;
          } else {
            state.isOrbitDragging = true;
          }
        } else {
          state.isOrbitDragging = true;
        }
      }

      if (state.isPhotoDragging) {
        this.grabber.moveGrab(event);
      } else if (state.isOrbitDragging && !this.isCorridorMode) {
        this.callbacks.onOrbitDrag(deltaX, deltaY);
      }
      return;
    }

    if (this.isCorridorMode) {
      // Hover detection on corridor doors
      this.updateRay(event.clientX, event.clientY);
      const hitDoor = this.roomManager.raycastDoor(this.raycaster);
      if (hitDoor !== this.hoveredDoorIndex) {
        if (this.hoveredDoorIndex !== null) {
          this.roomManager.getDoor(this.hoveredDoorIndex)?.setHovered(false);
        }
        this.hoveredDoorIndex = hitDoor;
        if (hitDoor !== null) {
          this.roomManager.getDoor(hitDoor)?.setHovered(true);
        }
      }
    } else {
      // In-room hover air disturbance
      this.hoverPhysics.updatePointer(event.clientX, event.clientY);
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDownState || this.pointerDownState.pointerId !== event.pointerId) return;

    const state = this.pointerDownState;
    this.pointerDownState = null;

    if (state.isPhotoDragging) {
      this.grabber.endGrab(event);
      return;
    }

    if (state.isOrbitDragging) {
      return;
    }

    const duration = performance.now() - state.startTime;
    const distSq = (event.clientX - state.startX) ** 2 + (event.clientY - state.startY) ** 2;

    if (duration < 350 && distSq <= 36) {
      this.updateRay(event.clientX, event.clientY);

      if (this.isCorridorMode) {
        // Raycast and open clicked door
        const hitDoor = this.roomManager.raycastDoor(this.raycaster);
        if (hitDoor !== null) {
          this.callbacks.onDoorClick(hitDoor);
        }
        return;
      }

      if (state.candidatePhoto) {
        this.callbacks.onPhotoClick(state.candidatePhoto);
      }
    }
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();

    window.clearTimeout(this.wheelResetTimer);
    this.wheelResetTimer = window.setTimeout(() => {
      this.wheelLocked = false;
      this.wheelAccumulator = 0;
    }, 220);

    if (this.wheelLocked) return;
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    this.wheelAccumulator += delta;
    if (Math.abs(this.wheelAccumulator) < 45) return;

    if (this.isCorridorMode) {
      if (this.wheelAccumulator > 0) {
        this.callbacks.onCorridorForward();
      } else {
        this.callbacks.onCorridorBackward();
      }
    } else {
      const isVerticalGesture = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
      if (isVerticalGesture) {
        this.callbacks.onRoomWalk(this.wheelAccumulator * 0.012);
      } else if (this.wheelAccumulator > 0) {
        this.callbacks.onNavigateNext();
      } else {
        this.callbacks.onNavigatePrevious();
      }
    }
    this.wheelAccumulator = 0;
    this.wheelLocked = true;
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    let handled = true;

    if (this.isCorridorMode) {
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        this.callbacks.onCorridorForward();
      } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        this.callbacks.onCorridorBackward();
      } else if (event.key === 'Enter') {
        // Enter default focused door at current station
        if (this.hoveredDoorIndex !== null) {
          this.callbacks.onDoorClick(this.hoveredDoorIndex);
        }
      } else {
        handled = false;
      }
    } else {
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') this.callbacks.onRoomWalk(-0.75);
      else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') this.callbacks.onRoomWalk(0.75);
      else if (event.key === 'ArrowLeft') this.callbacks.onNavigatePrevious();
      else if (event.key === 'ArrowRight') this.callbacks.onNavigateNext();
      else if (event.key.toLowerCase() === 'r') this.callbacks.onResetActive();
      else if (event.key === 'Escape' || event.key === 'Backspace') this.callbacks.onEscape();
      else handled = false;
    }

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
