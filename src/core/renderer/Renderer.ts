import * as THREE from 'three/webgpu';

export interface RendererOptions {
  onDeviceLost?: (info: { message?: string; reason?: string | null }) => void;
  onError?: (error: unknown) => void;
}

export class GalleryRenderer {
  readonly renderer: THREE.WebGPURenderer;
  readonly domElement: HTMLCanvasElement;
  private disposed = false;

  constructor(options: RendererOptions = {}) {
    if (!window.isSecureContext) {
      throw new Error('WebGPU 需要安全上下文。请使用 localhost 或 HTTPS 打开本页面。');
    }
    if (!('gpu' in navigator)) {
      throw new Error('当前浏览器或系统未支持 WebGPU，请检查浏览器版本与硬件加速设置。');
    }

    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.domElement = this.renderer.domElement as HTMLCanvasElement;
    this.domElement.tabIndex = 0;
    this.domElement.setAttribute('role', 'region');
    this.domElement.setAttribute('aria-label', 'Spatial Memory Gallery 3D Viewport');

    if (options.onDeviceLost) {
      const originalDeviceLost = this.renderer.onDeviceLost;
      this.renderer.onDeviceLost = (info) => {
        originalDeviceLost?.call(this.renderer, info);
        options.onDeviceLost?.(info);
      };
    }

    if (options.onError) {
      const originalError = this.renderer.onError;
      this.renderer.onError = ((info: unknown) => {
        (originalError as unknown as (val: unknown) => void)?.call(this.renderer, info);
        options.onError?.(info);
      }) as typeof this.renderer.onError;
    }
  }

  async init(): Promise<void> {
    await this.renderer.init();
    if ((this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend !== true) {
      throw new Error('WebGPU 初始化失败，已拒绝切换到不支持 Compute 的旧版 WebGL2 后端。');
    }
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.disposed) return;
    this.renderer.render(scene, camera);
  }

  handleResize(): void {
    if (this.disposed) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.domElement.remove();
    this.renderer.dispose();
  }
}
