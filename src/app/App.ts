import * as THREE from 'three/webgpu';
import { GalleryRenderer } from '../core/renderer/Renderer';
import { World } from '../world/World';
import { RoomManager } from '../world/RoomManager';
import { CameraController } from '../core/camera/CameraController';
import { GameLoop } from '../core/loop/GameLoop';
import { InputManager } from '../interaction/InputManager';
import { HUD } from '../ui/HUD';
import { FocusOverlay } from '../ui/FocusOverlay';
import { EntranceOverlay } from '../ui/EntranceOverlay';
import { GALLERY_ROOMS } from '../gallery/GalleryManifest';
import { HangingPhoto } from '../gallery/HangingPhoto';
import { GalleryItemData } from '../gallery/GalleryItem';

export type AppSpatialMode =
  | 'entrance'
  | 'corridor'
  | 'doorTransition'
  | 'inRoom'
  | 'focus'
  | 'exitTransition';

export class App {
  private readonly container: HTMLElement;
  private renderer!: GalleryRenderer;
  private world!: World;
  private roomManager!: RoomManager;
  private cameraController!: CameraController;
  private inputManager!: InputManager;
  private gameLoop!: GameLoop;
  private hud!: HUD;
  private focusOverlay!: FocusOverlay;
  private entranceOverlay!: EntranceOverlay;

  private spatialMode: AppSpatialMode = 'entrance';
  private currentStationIndex = 0;
  private entranceProgress = 0;
  private isOpeningEntrance = false;
  private doorTransitionProgress = 0;
  private activeTransitionDoorIndex: number | null = null;
  private disposed = false;

  constructor(containerId = '#app') {
    this.container = document.querySelector(containerId) || document.body;
  }

  async init(): Promise<void> {
    this.renderer = new GalleryRenderer({
      onDeviceLost: (info) => {
        this.hud?.setError(`GPU 设备已断开：${info.message || info.reason || '未知原因'}。请刷新页面。`);
        this.hud?.setStatus('GPU 运行已停止');
      },
      onError: (err) => {
        this.hud?.setError(`GPU 报告错误：${err instanceof Error ? err.message : String(err)}`);
      },
    });

    await this.renderer.init();
    this.container.appendChild(this.renderer.domElement);

    this.world = new World();
    this.world.initEnvironment();

    this.roomManager = new RoomManager(this.renderer.renderer);
    this.world.scene.add(this.roomManager.rootGroup);

    this.cameraController = new CameraController();

    // Setup UI
    this.hud = new HUD(GALLERY_ROOMS, {
      onCorridorStep: (stationIdx) => {
        if (stationIdx === -1) {
          this.corridorBackward();
        } else if (stationIdx === -2) {
          this.corridorForward();
        } else {
          this.goToCorridorStation(stationIdx);
        }
      },
      onEnterDoor: (doorIdx) => this.enterRoomViaDoor(doorIdx),
      onReturnToCorridor: () => this.returnToCorridor(),
      onPhotoPrevious: () => this.previousPhoto(),
      onPhotoNext: () => this.nextPhoto(),
      onReset: () => this.resetActivePhoto(),
      onWindChange: (val) => this.roomManager.setWind(val),
      onGravityChange: (val) => this.roomManager.setGravity(val),
      onUploadFiles: (files) => this.handleUploadFiles(files),
    });
    this.container.appendChild(this.hud.element);

    this.focusOverlay = new FocusOverlay({
      onPrevious: () => this.previousPhoto(),
      onNext: () => this.nextPhoto(),
      onClose: () => this.setFocusMode(false),
    });
    this.container.appendChild(this.focusOverlay.element);

    this.entranceOverlay = new EntranceOverlay({
      onEnter: () => this.handleEnterGallery(),
    });
    this.container.appendChild(this.entranceOverlay.element);

    // Setup Input
    this.inputManager = new InputManager(
      this.renderer.domElement,
      this.cameraController.camera,
      this.roomManager,
      {
        onPhotoClick: (photo) => this.handlePhotoClick(photo),
        onDoorClick: (doorIndex) => this.enterRoomViaDoor(doorIndex),
        onOrbitDrag: (deltaX, deltaY) => this.cameraController.addOrbitOffset(deltaX, deltaY),
        onRoomWalk: (distanceDelta) => this.cameraController.addRoomWalkOffset(
          distanceDelta,
          this.roomManager.getActiveRoom(),
        ),
        onCorridorForward: () => this.corridorForward(),
        onCorridorBackward: () => this.corridorBackward(),
        onNavigatePrevious: () => this.previousPhoto(),
        onNavigateNext: () => this.nextPhoto(),
        onResetActive: () => this.resetActivePhoto(),
        onEscape: () => {
          if (this.spatialMode === 'focus') {
            this.setFocusMode(false);
          } else if (this.spatialMode === 'inRoom') {
            this.returnToCorridor();
          }
        },
      },
    );

    // Setup GameLoop
    this.gameLoop = new GameLoop(this.renderer.renderer, {
      onPhysicsStep: (dt, time) => {
        if (this.spatialMode === 'inRoom' || this.spatialMode === 'focus' || this.spatialMode === 'doorTransition') {
          this.roomManager.step(dt, time);
        }
      },
      onError: (error) => {
        this.hud?.setError(`场景运行错误：${error instanceof Error ? error.message : String(error)}`);
      },
      onRenderFrame: (frameDt) => {
        if (this.isOpeningEntrance && this.entranceProgress < 1) {
          this.entranceProgress = Math.min(1, this.entranceProgress + frameDt * 1.5);
          this.world.setEntranceSlitOpenness(this.entranceProgress);
        }

        // Handle Door Opening & Flight Transition into room
        if (this.spatialMode === 'doorTransition' && this.activeTransitionDoorIndex !== null) {
          this.doorTransitionProgress = Math.min(1, this.doorTransitionProgress + frameDt * 1.2);
          this.roomManager.setDoorOpenProgress(this.activeTransitionDoorIndex, this.doorTransitionProgress);

          if (this.doorTransitionProgress >= 1) {
            this.spatialMode = 'inRoom';
            this.cameraController.setMode('inRoom');
            this.inputManager.setCorridorMode(false);
            this.updateHUD();
            this.hud.setStatus('展厅漫游 · W/S 或上下滚轮前后移动 · 空白处拖拽环视 · 照片可拖拽形变');
          }
        }

        // Handle Exit Transition back to corridor
        if (this.spatialMode === 'exitTransition' && this.activeTransitionDoorIndex !== null) {
          this.doorTransitionProgress = Math.max(0, this.doorTransitionProgress - frameDt * 1.4);
          this.roomManager.setDoorOpenProgress(this.activeTransitionDoorIndex, this.doorTransitionProgress);

          if (this.doorTransitionProgress <= 0) {
            this.spatialMode = 'corridor';
            this.cameraController.setMode('corridor');
            this.inputManager.setCorridorMode(true);
            const corridorRoomIndex = this.activeTransitionDoorIndex;
            this.activeTransitionDoorIndex = null;
            this.roomManager.updateLOD(true, corridorRoomIndex ?? 0);
            this.updateHUD();
            this.hud.setStatus('中央艺术走廊 · W/S 或上下滚轮前后移动 · 走近展厅门推门进入');
          }
        }

        const activeRoom = this.roomManager.getActiveRoom();
        const activePhoto = this.roomManager.getActivePhoto();
        this.cameraController.updateTarget(
          activeRoom,
          activePhoto,
          this.entranceProgress,
          this.doorTransitionProgress,
          this.spatialMode === 'exitTransition',
        );
        this.cameraController.update(frameDt);

        this.renderer.render(this.world.scene, this.cameraController.camera);
      },
    });

    this.setupResize();
    await this.warmupRoom(this.roomManager.getActiveRoomIndex());
    this.goToCorridorStation(0);
  }

  start(): void {
    this.gameLoop.start();
  }

  private handleEnterGallery(): void {
    this.isOpeningEntrance = true;
    this.spatialMode = 'corridor';
    this.cameraController.setMode('corridor');
    this.inputManager.setCorridorMode(true);

    this.goToCorridorStation(0);
    this.hud.setStatus('已进入中央艺术走廊 · 沿长廊漫步探索两旁展厅门');
  }

  private goToCorridorStation(stationIndex: number): void {
    this.currentStationIndex = THREE.MathUtils.clamp(stationIndex, 0, this.roomManager.getStationCount() - 1);
    const targetZ = this.roomManager.getStationZ(this.currentStationIndex);
    this.cameraController.setCorridorTargetZ(targetZ);

    this.roomManager.resetAllDoors();
    this.roomManager.updateLOD(true, this.currentStationIndex * 2);
    this.updateHUD();
  }

  private async warmupRoom(roomIndex: number): Promise<void> {
    const room = this.roomManager.rooms[roomIndex];
    if (!room) return;

    const camera = this.cameraController.camera;
    const previousPosition = camera.position.clone();
    const previousQuaternion = camera.quaternion.clone();
    const wasVisible = room.group.visible;

    room.group.visible = true;
    camera.position.set(room.group.position.x, 0.3, room.group.position.z + 8.5);
    camera.lookAt(room.group.position.x, 0.3, room.group.position.z);
    camera.updateMatrixWorld(true);

    try {
      await this.renderer.renderer.compileAsync(room.group, camera, this.world.scene);
    } catch (error) {
      console.warn('Room shader warmup skipped:', error);
    } finally {
      room.group.visible = wasVisible;
      camera.position.copy(previousPosition);
      camera.quaternion.copy(previousQuaternion);
      camera.updateMatrixWorld(true);
    }
  }

  private corridorForward(): void {
    if (this.currentStationIndex < this.roomManager.getStationCount() - 1) {
      this.goToCorridorStation(this.currentStationIndex + 1);
    }
  }

  private corridorBackward(): void {
    if (this.currentStationIndex > 0) {
      this.goToCorridorStation(this.currentStationIndex - 1);
    }
  }

  private enterRoomViaDoor(doorIndex: number): void {
    if (this.spatialMode !== 'corridor') return;

    this.spatialMode = 'doorTransition';
    this.cameraController.setMode('doorTransition');
    this.activeTransitionDoorIndex = doorIndex;
    this.doorTransitionProgress = 0;

    this.roomManager.setActiveRoomIndex(doorIndex);
    const activeRoom = this.roomManager.getActiveRoom();
    this.cameraController.resetRoomView(activeRoom);
    this.roomManager.updateLOD(false, doorIndex);

    // Trigger powerful air gust as door pushes open
    activeRoom.applyImpulse(new THREE.Vector3(0, 0.4, 1.2));

    this.hud.setStatus(`正在推门进入：${activeRoom.config.name}…`);
  }

  private returnToCorridor(): void {
    if (this.spatialMode === 'focus') {
      this.setFocusMode(false);
    }

    if (this.spatialMode === 'inRoom') {
      this.spatialMode = 'exitTransition';
      this.cameraController.setMode('exitTransition');
      this.activeTransitionDoorIndex = this.roomManager.getActiveRoomIndex();
      this.doorTransitionProgress = 1;
      this.hud.setStatus('正在返回中央走廊…');
    }
  }

  private handlePhotoClick(clickedPhoto: HangingPhoto): void {
    if (this.spatialMode !== 'inRoom' && this.spatialMode !== 'focus') return;

    const activePhoto = this.roomManager.getActivePhoto();
    if (!activePhoto) return;

    if (clickedPhoto === activePhoto) {
      // Toggle Focus mode
      this.setFocusMode(this.spatialMode !== 'focus');
    } else {
      // Switch active photo in room
      const activeRoom = this.roomManager.getActiveRoom();
      const idx = activeRoom.photos.indexOf(clickedPhoto);
      if (idx !== -1) {
        activeRoom.setActiveIndex(idx);
        this.roomManager.updateLOD(false, this.roomManager.getActiveRoomIndex());
        this.updateHUD();
      }
    }
  }

  private setFocusMode(focus: boolean): void {
    if (focus) {
      this.spatialMode = 'focus';
      this.cameraController.setMode('focus');
      this.roomManager.setStabilizing(true);
      this.hud.setFocusMode(true);

      const activePhoto = this.roomManager.getActivePhoto();
      const activeRoom = this.roomManager.getActiveRoom();
      if (activePhoto) {
        this.focusOverlay.show(
          activePhoto.data,
          activeRoom.getActiveIndex(),
          activeRoom.photos.length,
        );
        this.hud.setStatus(`正在品读：《${activePhoto.data.title}》`);
      }
    } else {
      this.spatialMode = 'inRoom';
      this.cameraController.setMode('inRoom');
      this.roomManager.setStabilizing(false);
      this.hud.setFocusMode(false);
      this.focusOverlay.hide();
      this.hud.setStatus('展厅漫游 · 空白处拖拽环视 · 照片可拖拽形变');
    }
  }

  previousPhoto(): void {
    if (this.spatialMode !== 'inRoom' && this.spatialMode !== 'focus') return;
    const activeRoom = this.roomManager.getActiveRoom();
    const curr = activeRoom.getActiveIndex();
    if (curr > 0) {
      this.inputManager.cancelActiveInteractions();
      activeRoom.setActiveIndex(curr - 1);
      this.roomManager.updateLOD(false, this.roomManager.getActiveRoomIndex());
      this.updateHUD();
      if (this.spatialMode === 'focus') {
        this.setFocusMode(true);
      }
    }
  }

  nextPhoto(): void {
    if (this.spatialMode !== 'inRoom' && this.spatialMode !== 'focus') return;
    const activeRoom = this.roomManager.getActiveRoom();
    const curr = activeRoom.getActiveIndex();
    if (curr < activeRoom.photos.length - 1) {
      this.inputManager.cancelActiveInteractions();
      activeRoom.setActiveIndex(curr + 1);
      this.roomManager.updateLOD(false, this.roomManager.getActiveRoomIndex());
      this.updateHUD();
      if (this.spatialMode === 'focus') {
        this.setFocusMode(true);
      }
    }
  }

  resetActivePhoto(): void {
    this.inputManager.cancelActiveInteractions();
    this.roomManager.resetCurrentPhoto();
    this.hud.setStatus('已复位当前照片物理形变');
  }

  private async handleUploadFiles(files: File[]): Promise<void> {
    this.hud.setStatus(`正在导入 ${files.length} 张作品…`);
    for (const file of files) {
      try {
        const objectUrl = URL.createObjectURL(file);
        const texture = await new THREE.TextureLoader().loadAsync(objectUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        URL.revokeObjectURL(objectUrl);

        const img = texture.image as HTMLImageElement;
        const aspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);

        const customItem: GalleryItemData = {
          id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          roomId: this.roomManager.getActiveRoom().config.id,
          title: file.name.replace(/\.[^/.]+$/, ''),
          year: new Date().getFullYear().toString(),
          location: 'Custom Creation · 个人典藏',
          cameraInfo: 'Master Studio · 独家作品',
          preset: 'photoPaper',
          aspectRatio: aspect > 0 ? aspect : 1.5,
          story: {
            subtitle: '用户专属创作记忆',
            paragraph1: '由创作工坊实时导入的独家影像，以 WebGPU XPBD 物理布料算法悬挂在空间之中，随光影与气流呼吸。',
            quote: '“每一张定格的照片，都是凝固的时间切片。”',
          },
          isCustom: true,
        };

        this.roomManager.addCustomImage(customItem, texture);
      } catch (err) {
        console.error('Failed to import user file:', err);
        this.hud.setError(`部分图片导入失败：${file.name}`);
      }
    }

    this.updateHUD();
    this.hud.setStatus(`成功导入作品，当前展厅共 ${this.roomManager.getActiveRoom().photos.length} 张`);
  }

  private updateHUD(): void {
    const isCorridor = this.spatialMode === 'corridor' || this.spatialMode === 'entrance';
    const activeRoom = this.roomManager.getActiveRoom();
    this.hud.updateState(
      isCorridor,
      this.currentStationIndex,
      this.roomManager.getActiveRoomIndex(),
      activeRoom.getActiveIndex(),
      activeRoom.photos.length,
      activeRoom.config,
    );
  }

  private setupResize(): void {
    const onResize = () => {
      this.renderer.handleResize();
      this.cameraController.handleResize();
      this.cameraController.setInsets(70, 75);
    };
    window.addEventListener('resize', onResize);
    onResize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gameLoop.dispose();
    this.inputManager.dispose();
    this.roomManager.dispose();
    this.world.dispose();
    this.hud.dispose();
    this.focusOverlay.dispose();
    this.entranceOverlay.dispose();
    this.renderer.dispose();
  }
}
