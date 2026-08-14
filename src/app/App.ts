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

  private isFocusMode = false;
  private entranceProgress = 0;
  private isOpeningEntrance = false;
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
      onRoomSelect: (roomIdx) => this.switchRoom(roomIdx),
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
      () => this.roomManager.getActivePhoto(),
      {
        onPhotoClick: (photo) => this.handlePhotoClick(photo),
        onNavigatePrevious: () => this.previousPhoto(),
        onNavigateNext: () => this.nextPhoto(),
        onResetActive: () => this.resetActivePhoto(),
        onEscape: () => {
          if (this.isFocusMode) {
            this.setFocusMode(false);
          }
        },
      },
    );

    // Setup GameLoop
    this.gameLoop = new GameLoop(this.renderer.renderer, {
      onPhysicsStep: (dt, time) => {
        this.roomManager.step(dt, time);
      },
      onRenderFrame: (frameDt) => {
        if (this.isOpeningEntrance && this.entranceProgress < 1) {
          this.entranceProgress = Math.min(1, this.entranceProgress + frameDt * 1.5);
          this.world.setEntranceSlitOpenness(this.entranceProgress);
        }

        const activeRoom = this.roomManager.getActiveRoom();
        const activePhoto = this.roomManager.getActivePhoto();
        this.cameraController.updateTarget(
          activePhoto,
          activeRoom.group.position.x,
          this.entranceProgress,
        );
        this.cameraController.update(frameDt);

        this.renderer.render(this.world.scene, this.cameraController.camera);
      },
    });

    this.setupResize();
    this.updateHUD();
  }

  start(): void {
    this.gameLoop.start();
  }

  private handleEnterGallery(): void {
    this.isOpeningEntrance = true;
    this.cameraController.setMode('browse');

    // Trigger powerful initial room air gust
    const activeRoom = this.roomManager.getActiveRoom();
    activeRoom.applyImpulse(new THREE.Vector3(0, 0.4, 1.2));

    this.hud.setStatus('已进入画廊 · 轻触照片开启故事');
  }

  private handlePhotoClick(clickedPhoto: HangingPhoto): void {
    const activePhoto = this.roomManager.getActivePhoto();
    if (!activePhoto) return;

    if (clickedPhoto === activePhoto) {
      // Toggle Focus mode
      this.setFocusMode(!this.isFocusMode);
    } else {
      // Switch active photo to clicked
      const activeRoom = this.roomManager.getActiveRoom();
      const idx = activeRoom.photos.indexOf(clickedPhoto);
      if (idx !== -1) {
        activeRoom.setActiveIndex(idx);
        this.roomManager.updateLOD();
        this.updateHUD();
      }
    }
  }

  private setFocusMode(focus: boolean): void {
    this.isFocusMode = focus;
    this.cameraController.setMode(focus ? 'focus' : 'browse');
    this.roomManager.setStabilizing(focus);
    this.hud.setFocusMode(focus);

    if (focus) {
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
      this.focusOverlay.hide();
      this.hud.setStatus('漫游模式 · 可自由切换与拖拽');
    }
  }

  switchRoom(roomIndex: number): void {
    if (this.isFocusMode) {
      this.setFocusMode(false);
    }
    const switched = this.roomManager.switchRoom(roomIndex);
    if (switched) {
      this.inputManager.cancelActiveInteractions();
      this.updateHUD();
      const currentRoom = this.roomManager.getActiveRoom();
      this.hud.setStatus(`已穿行至：${currentRoom.config.name}`);
    }
  }

  previousPhoto(): void {
    const activeRoom = this.roomManager.getActiveRoom();
    const curr = activeRoom.getActiveIndex();
    if (curr > 0) {
      this.inputManager.cancelActiveInteractions();
      activeRoom.setActiveIndex(curr - 1);
      this.roomManager.updateLOD();
      this.updateHUD();
      if (this.isFocusMode) {
        this.setFocusMode(true);
      }
    }
  }

  nextPhoto(): void {
    const activeRoom = this.roomManager.getActiveRoom();
    const curr = activeRoom.getActiveIndex();
    if (curr < activeRoom.photos.length - 1) {
      this.inputManager.cancelActiveInteractions();
      activeRoom.setActiveIndex(curr + 1);
      this.roomManager.updateLOD();
      this.updateHUD();
      if (this.isFocusMode) {
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
          location: 'Local Import · 本地收藏',
          cameraInfo: 'Custom Upload · 独家作品',
          preset: 'photoPaper',
          aspectRatio: aspect > 0 ? aspect : 1.5,
          story: {
            subtitle: '用户专属珍藏记忆',
            paragraph1: '由本地导入的独家影像，以 WebGPU XPBD 物理布料算法实时悬挂，赋予静态摄影鲜活的呼吸感。',
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
    const activeRoom = this.roomManager.getActiveRoom();
    this.hud.updateState(
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
