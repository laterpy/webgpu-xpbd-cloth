import * as THREE from 'three/webgpu';
import { ClothSimulation } from '../cloth/ClothSimulation';
import type { ClothGrabTarget } from '../interaction/ClothGrabber';

const MAX_ITEMS = 12;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_TEXTURE_EDGE = 2048;
const MAX_SOURCE_PIXELS = 32 * 1024 * 1024;
const MAX_WORLD_WIDTH = 5.2;
const BASE_WORLD_HEIGHT = 3.2;
const PARTICLE_SPACING = 0.145;
const ITEM_GAP = 0.52;
const TOP_LINE_Y = 1.6;
const DECODE_CONCURRENCY = 1;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);

export interface HangingGalleryState {
  activeIndex: number;
  total: number;
  label: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

export interface HangingGalleryCallbacks {
  onStateChange: (state: HangingGalleryState) => void;
  onStatus: (message: string) => void;
  onError: (message: string | null) => void;
  onBeforeItemsReplace?: () => void;
}

interface LoadedPhoto {
  texture: THREE.Texture;
  naturalWidth: number;
  naturalHeight: number;
}

interface PhotoItem {
  id: string;
  fileKey: string | null;
  label: string;
  width: number;
  height: number;
  centerX: number;
  baseSolverIterations: number;
  lastSteppedAt: number | null;
  cloth: ClothSimulation;
  group: THREE.Group;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getImageDimensions(texture: THREE.Texture): { width: number; height: number } {
  const image = texture.image as (HTMLImageElement & { width: number; height: number }) | undefined;
  const width = image?.naturalWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.height || 0;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('无法读取图片尺寸');
  }
  return { width, height };
}

function downsampleTexture(
  texture: THREE.Texture,
  naturalWidth: number,
  naturalHeight: number,
): THREE.Texture {
  const longestEdge = Math.max(naturalWidth, naturalHeight);
  if (longestEdge <= MAX_TEXTURE_EDGE) return texture;

  const scale = MAX_TEXTURE_EDGE / longestEdge;
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法创建图片缩放画布');
  context.drawImage(texture.image as CanvasImageSource, 0, 0, width, height);

  texture.dispose();
  const resized = new THREE.CanvasTexture(canvas);
  resized.colorSpace = THREE.SRGBColorSpace;
  return resized;
}

async function loadTextureFromUrl(url: string): Promise<LoadedPhoto> {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  try {
    const { width, height } = getImageDimensions(texture);
    if (width * height > MAX_SOURCE_PIXELS) {
      throw new Error('图片像素超过约 3355 万，请先缩小后再添加');
    }
    return {
      texture: downsampleTexture(texture, width, height),
      naturalWidth: width,
      naturalHeight: height,
    };
  } catch (error) {
    texture.dispose();
    throw error;
  }
}

async function loadTextureFromFile(file: File): Promise<LoadedPhoto> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('仅支持 PNG、JPEG、WebP 和 AVIF');
  }
  if (file.size <= 0) throw new Error('文件为空');
  if (file.size > MAX_FILE_BYTES) throw new Error('文件超过 30 MB');

  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadTextureFromUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function calculateWorldSize(naturalWidth: number, naturalHeight: number): { width: number; height: number } {
  const aspect = naturalWidth / naturalHeight;
  const rawWidth = BASE_WORLD_HEIGHT * aspect;
  const scale = rawWidth > MAX_WORLD_WIDTH ? MAX_WORLD_WIDTH / rawWidth : 1;
  return {
    width: rawWidth * scale,
    height: BASE_WORLD_HEIGHT * scale,
  };
}

export class HangingGallery {
  readonly trackGroup = new THREE.Group();

  private readonly items: PhotoItem[] = [];
  private readonly fileKeys = new Set<string>();
  private readonly clipGeometry = new THREE.BoxGeometry(0.16, 0.11, 0.12);
  private readonly clipMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8d7a54,
    metalness: 0.88,
    roughness: 0.25,
    clearcoat: 0.25,
  });
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private uploadQueue: Promise<void> = Promise.resolve();
  private activeIndex = 0;
  private targetTrackX = 0;
  private targetCameraZ: number;
  private targetLookY = -0.25;
  private currentLookY = -0.25;
  private viewportTopInset = 0;
  private viewportBottomInset = 0;
  private wind = 0;
  private gravity = 7.8;
  private physicsStep = 0;
  private nextId = 1;
  private hasUserItems = false;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGPURenderer,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly callbacks: HangingGalleryCallbacks,
  ) {
    this.targetCameraZ = camera.position.z;
    this.scene.add(this.trackGroup);
  }

  async loadDefault(url: string): Promise<void> {
    const loaded = await loadTextureFromUrl(url);
    if (this.disposed) {
      loaded.texture.dispose();
      return;
    }
    this.items.push(this.createItem(loaded, '示例照片', null));
    this.layout(true);
    this.callbacks.onStatus('已挂起示例照片，可一次添加多张本地图片');
  }

  addFiles(files: readonly File[]): Promise<void> {
    const snapshot = Array.from(files);
    const run = () => this.processFiles(snapshot);
    this.uploadQueue = this.uploadQueue.then(run, run);
    return this.uploadQueue;
  }

  private async processFiles(files: File[]): Promise<void> {
    if (this.disposed || files.length === 0) return;
    this.callbacks.onError(null);

    const remaining = MAX_ITEMS - (this.hasUserItems ? this.items.length : 0);
    const uniqueFiles: File[] = [];
    const pendingKeys = new Set<string>();
    for (const file of files) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (this.fileKeys.has(key) || pendingKeys.has(key)) continue;
      pendingKeys.add(key);
      uniqueFiles.push(file);
    }

    const selected = uniqueFiles.slice(0, Math.max(0, remaining));
    if (selected.length === 0) {
      const message = remaining <= 0 ? `最多可挂起 ${MAX_ITEMS} 张图片` : '所选图片已存在';
      this.callbacks.onError(message);
      this.callbacks.onStatus(remaining <= 0 ? `已达到 ${MAX_ITEMS} 张上限` : '未添加：所选图片已存在');
      return;
    }

    type LoadResult = { file: File; loaded?: LoadedPhoto; error?: string };
    const results = new Array<LoadResult>(selected.length);
    let cursor = 0;
    let completed = 0;
    const worker = async () => {
      while (cursor < selected.length) {
        const index = cursor++;
        const file = selected[index];
        try {
          results[index] = { file, loaded: await loadTextureFromFile(file) };
        } catch (error) {
          results[index] = {
            file,
            error: error instanceof Error ? error.message : String(error),
          };
        } finally {
          completed++;
          if (!this.disposed) this.callbacks.onStatus(`正在处理图片 ${completed} / ${selected.length}…`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(DECODE_CONCURRENCY, selected.length) }, () => worker()));
    if (this.disposed) {
      for (const result of results) result.loaded?.texture.dispose();
      return;
    }

    const successful = results.filter((result) => result.loaded);
    const replacingDefault = successful.length > 0 && !this.hasUserItems;
    const firstNewIndex = replacingDefault ? 0 : this.items.length;
    const creationErrors: LoadResult[] = [];
    const createdItems: PhotoItem[] = [];
    for (const result of successful) {
      const loaded = result.loaded!;
      const key = `${result.file.name}:${result.file.size}:${result.file.lastModified}`;
      try {
        createdItems.push(this.createItem(loaded, result.file.name, key));
      } catch (error) {
        creationErrors.push({
          file: result.file,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (createdItems.length > 0) {
      if (replacingDefault) {
        try {
          this.callbacks.onBeforeItemsReplace?.();
        } catch (error) {
          for (const item of createdItems) {
            item.group.removeFromParent();
            item.cloth.dispose(this.renderer);
          }
          throw error;
        }
        this.disposeItems();
        this.hasUserItems = true;
      }
      for (const item of createdItems) {
        this.items.push(item);
        if (item.fileKey) this.fileKeys.add(item.fileKey);
      }
      this.activeIndex = firstNewIndex;
    }
    this.layout(false);

    const failed = [...results.filter((result) => result.error), ...creationErrors];
    const ignoredCount = files.length - selected.length;
    if (failed.length > 0 || ignoredCount > 0) {
      const details = failed.slice(0, 3).map((result) => `${result.file.name}：${result.error}`).join('\n');
      const more = failed.length > 3 ? `\n另有 ${failed.length - 3} 张失败` : '';
      const ignored = ignoredCount > 0 ? `\n另有 ${ignoredCount} 张重复或超过数量上限` : '';
      this.callbacks.onError(`${details}${more}${ignored}`.trim());
    }

    this.callbacks.onStatus(
      createdItems.length > 0
        ? `已添加 ${createdItems.length} 张图片，共 ${this.items.length} 张`
        : '本次没有可用图片，已保留原有内容',
    );
  }

  private createItem(loaded: LoadedPhoto, label: string, fileKey: string | null): PhotoItem {
    const { width, height } = calculateWorldSize(loaded.naturalWidth, loaded.naturalHeight);
    const segmentsX = clamp(Math.round(width / PARTICLE_SPACING), 2, 40);
    const segmentsY = clamp(Math.round(height / PARTICLE_SPACING), 2, 28);
    let cloth: ClothSimulation | null = null;
    let group: THREE.Group | null = null;
    try {
      cloth = new ClothSimulation(loaded.texture, {
        width,
        height,
        segmentsX,
        segmentsY,
        solverIterations: 6,
        gravity: this.gravity,
        wind: this.wind,
      });
      group = new THREE.Group();
      group.name = `Hanging Photo ${this.nextId}`;
      group.position.y = TOP_LINE_Y - height / 2;
      group.add(cloth.mesh);

      const leftClip = new THREE.Mesh(this.clipGeometry, this.clipMaterial);
      leftClip.position.set(-width / 2 + cloth.pinInset, height / 2 + 0.02, 0.06);
      leftClip.castShadow = true;
      group.add(leftClip);
      const rightClip = new THREE.Mesh(this.clipGeometry, this.clipMaterial);
      rightClip.position.set(width / 2 - cloth.pinInset, height / 2 + 0.02, 0.06);
      rightClip.castShadow = true;
      group.add(rightClip);

      this.trackGroup.add(group);
      cloth.reset(this.renderer);
      return {
        id: `photo-${this.nextId++}`,
        fileKey,
        label,
        width,
        height,
        centerX: 0,
        baseSolverIterations: cloth.solverIterations,
        lastSteppedAt: null,
        cloth,
        group,
      };
    } catch (error) {
      group?.removeFromParent();
      if (cloth) cloth.dispose(this.renderer);
      else loaded.texture.dispose();
      throw error;
    }
  }

  private layout(instant: boolean): void {
    let cursor = 0;
    for (const item of this.items) {
      item.centerX = cursor + item.width / 2;
      item.group.position.x = item.centerX;
      cursor += item.width + ITEM_GAP;
    }

    this.activeIndex = clamp(this.activeIndex, 0, Math.max(0, this.items.length - 1));
    this.targetTrackX = this.items.length > 0 ? -this.items[this.activeIndex].centerX : 0;
    if (instant || this.reducedMotion.matches) this.trackGroup.position.x = this.targetTrackX;
    this.updateVisibility();
    this.updateCameraTarget();
    this.emitState();
  }

  private updateVisibility(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].group.visible = Math.abs(i - this.activeIndex) <= 2;
    }
  }

  private updateCameraTarget(): void {
    const item = this.items[this.activeIndex];
    if (!item) return;
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const horizontalPadding = this.camera.aspect >= 0.8 ? 0.9 : 0.34;
    const fitWidth = item.width + horizontalPadding;
    const fitHeight = item.height + 0.72;
    const viewportHeight = Math.max(1, window.innerHeight);
    const usableHeight = Math.max(1, viewportHeight - this.viewportTopInset - this.viewportBottomInset);
    const usableFraction = usableHeight / viewportHeight;
    const distanceForWidth = fitWidth / Math.max(0.01, 2 * tangent * this.camera.aspect);
    const distanceForHeight = fitHeight / Math.max(0.01, 2 * tangent * usableFraction);
    this.targetCameraZ = clamp(Math.max(distanceForWidth, distanceForHeight) * 1.08, 5.4, 32);
    const usableCenter = this.viewportTopInset + usableHeight / 2;
    const desiredNdcY = 1 - (usableCenter / viewportHeight) * 2;
    const itemCenterY = TOP_LINE_Y - item.height / 2;
    this.targetLookY = itemCenterY - desiredNdcY * this.targetCameraZ * tangent;
  }

  updatePresentation(frameDt: number): void {
    const alpha = this.reducedMotion.matches ? 1 : 1 - Math.exp(-8 * Math.max(0, frameDt));
    this.trackGroup.position.x += (this.targetTrackX - this.trackGroup.position.x) * alpha;
    this.camera.position.z += (this.targetCameraZ - this.camera.position.z) * alpha;
    this.currentLookY += (this.targetLookY - this.currentLookY) * alpha;
    this.camera.lookAt(0, this.currentLookY, 0);
  }

  step(fixedDt: number, simulationTime: number): void {
    if (this.items.length === 0) return;
    this.physicsStep++;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const distance = Math.abs(i - this.activeIndex);
      if (distance > 1) {
        item.lastSteppedAt = simulationTime;
        continue;
      }
      if (item.lastSteppedAt === null) item.lastSteppedAt = simulationTime - fixedDt;

      const shouldStep = distance === 0 || this.physicsStep % 2 === 0;
      if (!shouldStep) continue;
      const elapsed = clamp(simulationTime - item.lastSteppedAt, fixedDt, fixedDt * 2);
      item.cloth.solverIterations = distance === 0
        ? item.baseSolverIterations
        : Math.min(3, item.baseSolverIterations);
      item.cloth.step(this.renderer, elapsed, simulationTime);
      item.lastSteppedAt = simulationTime;
    }
  }

  goTo(index: number): boolean {
    if (index < 0 || index >= this.items.length || index === this.activeIndex) return false;
    const previousIndex = this.activeIndex;
    this.activeIndex = index;
    this.targetTrackX = -this.items[index].centerX;
    if (this.reducedMotion.matches || Math.abs(previousIndex - index) > 1) {
      this.trackGroup.position.x = this.targetTrackX;
    }
    this.updateVisibility();
    this.updateCameraTarget();
    this.emitState();
    this.callbacks.onStatus(`正在查看第 ${index + 1} 张：${this.items[index].label}`);
    return true;
  }

  previous(): boolean {
    return this.goTo(this.activeIndex - 1);
  }

  next(): boolean {
    return this.goTo(this.activeIndex + 1);
  }

  first(): boolean {
    return this.goTo(0);
  }

  last(): boolean {
    return this.goTo(this.items.length - 1);
  }

  resetActive(): void {
    const item = this.items[this.activeIndex];
    if (!item) return;
    item.cloth.reset(this.renderer);
    this.callbacks.onStatus(`已复位：${item.label}`);
  }

  setWind(strength: number): void {
    this.wind = Math.max(0, strength);
    for (const item of this.items) item.cloth.setWind(this.wind);
  }

  setGravity(magnitude: number): void {
    this.gravity = Math.max(0, magnitude);
    for (const item of this.items) item.cloth.setGravity(this.gravity);
  }

  handleResize(insets: { top: number; bottom: number } = { top: 0, bottom: 0 }): void {
    this.viewportTopInset = Math.max(0, insets.top);
    this.viewportBottomInset = Math.max(0, insets.bottom);
    this.updateCameraTarget();
  }

  getActiveTarget(): ClothGrabTarget | null {
    const item = this.items[this.activeIndex];
    return item ? { cloth: item.cloth, transform: item.group } : null;
  }

  private emitState(): void {
    const item = this.items[this.activeIndex];
    this.callbacks.onStateChange({
      activeIndex: item ? this.activeIndex : 0,
      total: this.items.length,
      label: item?.label ?? '',
      canGoPrevious: this.activeIndex > 0,
      canGoNext: this.activeIndex < this.items.length - 1,
    });
  }

  private disposeItems(): void {
    for (const item of this.items) {
      this.trackGroup.remove(item.group);
      item.cloth.dispose(this.renderer);
    }
    this.items.length = 0;
    this.fileKeys.clear();
    this.activeIndex = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeItems();
    this.trackGroup.removeFromParent();
    this.clipGeometry.dispose();
    this.clipMaterial.dispose();
  }
}
