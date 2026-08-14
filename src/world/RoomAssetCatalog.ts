import * as THREE from 'three/webgpu';
import type { RoomLayoutType } from '../gallery/GalleryManifest';

export type GalleryMaterialId =
  | 'blackStone'
  | 'mineralPlaster'
  | 'blackenedBronze'
  | 'smokedGlass'
  | 'darkTimber'
  | 'brushedSteel'
  | 'mossRock'
  | 'warmIvory';

export interface SharedMaterialSpec {
  id: GalleryMaterialId;
  color: number;
  roughness: number;
  metalness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  texturePath?: string;
}

export interface RoomAssetSpec {
  id: string;
  kind: 'procedural' | 'model' | 'texture';
  intendedUse: string;
  path?: string;
  fallback: 'procedural' | 'hidden';
}

export interface RoomResourceContract {
  roomId: string;
  layoutType: RoomLayoutType;
  materials: GalleryMaterialId[];
  assets: RoomAssetSpec[];
  photoResourceIds: string[];
}

export const SHARED_MATERIALS: Record<GalleryMaterialId, SharedMaterialSpec> = {
  blackStone: {
    id: 'blackStone',
    color: 0x0b0b10,
    roughness: 0.38,
    metalness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    texturePath: '/assets/gallery/shared/materials/black-stone.webp',
  },
  mineralPlaster: {
    id: 'mineralPlaster',
    color: 0x111117,
    roughness: 0.9,
    metalness: 0.06,
    texturePath: '/assets/gallery/shared/materials/mineral-plaster.webp',
  },
  blackenedBronze: {
    id: 'blackenedBronze',
    color: 0x3b3025,
    roughness: 0.28,
    metalness: 0.86,
    clearcoat: 0.22,
    clearcoatRoughness: 0.35,
    texturePath: '/assets/gallery/shared/materials/blackened-bronze.webp',
  },
  smokedGlass: {
    id: 'smokedGlass',
    color: 0x3b3030,
    roughness: 0.08,
    metalness: 0.12,
    clearcoat: 0.75,
    clearcoatRoughness: 0.08,
    texturePath: '/assets/gallery/shared/materials/smoked-glass.webp',
  },
  darkTimber: {
    id: 'darkTimber',
    color: 0x241a14,
    roughness: 0.62,
    metalness: 0.05,
    texturePath: '/assets/gallery/shared/materials/dark-timber.webp',
  },
  brushedSteel: {
    id: 'brushedSteel',
    color: 0x444951,
    roughness: 0.24,
    metalness: 0.92,
    texturePath: '/assets/gallery/shared/materials/brushed-steel.webp',
  },
  mossRock: {
    id: 'mossRock',
    color: 0x26382a,
    roughness: 0.96,
    metalness: 0.02,
    texturePath: '/assets/gallery/shared/materials/moss-rock.webp',
  },
  warmIvory: {
    id: 'warmIvory',
    color: 0xe6d6bd,
    roughness: 0.74,
    metalness: 0.0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.78,
    texturePath: '/assets/gallery/shared/materials/warm-ivory.webp',
  },
};

const PHOTO_ROOT = '/assets/gallery/photos';

const ROOM_CONTRACTS: Record<string, RoomResourceContract> = {
  travel: {
    roomId: 'travel',
    layoutType: 'angled-vista',
    materials: ['blackStone', 'mineralPlaster', 'blackenedBronze', 'warmIvory'],
    assets: [
      { id: 'travel-rail', kind: 'procedural', intendedUse: '错落照片吊轨', fallback: 'procedural' },
      { id: 'travel-orientation-plinth', kind: 'procedural', intendedUse: '后墙导览台', fallback: 'procedural' },
    ],
    photoResourceIds: ['golden-peak', 'solitude-mist', 'dawn-monolith'],
  },
  portrait: {
    roomId: 'portrait',
    layoutType: 'circular',
    materials: ['blackStone', 'mineralPlaster', 'blackenedBronze', 'warmIvory'],
    assets: [
      { id: 'portrait-ring', kind: 'procedural', intendedUse: '360° 环形吊轨', fallback: 'procedural' },
      { id: 'portrait-light-veil', kind: 'procedural', intendedUse: '中央半透明光幕', fallback: 'procedural' },
    ],
    photoResourceIds: ['portrait-elder', 'portrait-child', 'portrait-gaze'],
  },
  memory: {
    roomId: 'memory',
    layoutType: 'semicircle',
    materials: ['blackStone', 'mineralPlaster', 'blackenedBronze', 'smokedGlass'],
    assets: [
      { id: 'memory-half-ring', kind: 'procedural', intendedUse: '半环吊轨', fallback: 'procedural' },
      { id: 'memory-relic', kind: 'procedural', intendedUse: '中央时间遗物', fallback: 'procedural' },
    ],
    photoResourceIds: ['memory-relic', 'memory-hourglass'],
  },
  nature: {
    roomId: 'nature',
    layoutType: 'staggered',
    materials: ['blackStone', 'mineralPlaster', 'blackenedBronze', 'mossRock'],
    assets: [
      { id: 'nature-plant-clusters', kind: 'procedural', intendedUse: '实例化植物岛', fallback: 'procedural' },
      { id: 'nature-moss-rocks', kind: 'procedural', intendedUse: '苔藓岩石基座', fallback: 'procedural' },
      { id: 'nature-leaf-atlas', kind: 'texture', intendedUse: '透明叶片图集', path: `${PHOTO_ROOT}/nature-leaf-atlas.webp`, fallback: 'hidden' },
    ],
    photoResourceIds: ['amazon-canopy', 'misty-pine'],
  },
  urban: {
    roomId: 'urban',
    layoutType: 'linear',
    materials: ['blackStone', 'mineralPlaster', 'brushedSteel', 'blackenedBronze'],
    assets: [
      { id: 'urban-steel-frame', kind: 'procedural', intendedUse: '照片黑钢框架', fallback: 'procedural' },
      { id: 'urban-skyline-relief', kind: 'procedural', intendedUse: '后墙城市轮廓', fallback: 'procedural' },
    ],
    photoResourceIds: ['urban-skyline', 'urban-transit'],
  },
  abstract: {
    roomId: 'abstract',
    layoutType: 'central-sculpture',
    materials: ['blackStone', 'mineralPlaster', 'blackenedBronze', 'smokedGlass'],
    assets: [
      { id: 'abstract-ribbon-sculpture', kind: 'procedural', intendedUse: '中央半透明丝带雕塑', fallback: 'procedural' },
      { id: 'abstract-light-ring', kind: 'procedural', intendedUse: '中央环形灯', fallback: 'procedural' },
    ],
    photoResourceIds: ['abstract-flow'],
  },
  creation: {
    roomId: 'creation',
    layoutType: 'studio-grid',
    materials: ['blackStone', 'mineralPlaster', 'brushedSteel', 'darkTimber', 'warmIvory'],
    assets: [
      { id: 'creation-worktable', kind: 'procedural', intendedUse: '中央创作工作台', fallback: 'procedural' },
      { id: 'creation-grid-wall', kind: 'procedural', intendedUse: '策展网格墙', fallback: 'procedural' },
    ],
    photoResourceIds: ['creation-blueprint'],
  },
  archive: {
    roomId: 'archive',
    layoutType: 'archive-matrix',
    materials: ['blackStone', 'darkTimber', 'blackenedBronze', 'smokedGlass', 'warmIvory'],
    assets: [
      { id: 'archive-cabinet-module', kind: 'procedural', intendedUse: '墙面展柜矩阵', fallback: 'procedural' },
      { id: 'archive-table', kind: 'procedural', intendedUse: '中央玻璃档案台', fallback: 'procedural' },
    ],
    photoResourceIds: ['archive-scroll'],
  },
};

export function getRoomResourceContract(roomId: string, layoutType: RoomLayoutType): RoomResourceContract {
  return ROOM_CONTRACTS[roomId] ?? {
    roomId,
    layoutType,
    materials: ['blackStone', 'mineralPlaster', 'blackenedBronze'],
    assets: [],
    photoResourceIds: [],
  };
}

export function getPhotoResourcePath(photoId: string): string {
  return `${PHOTO_ROOT}/${photoId}.webp`;
}

export function createGalleryMaterial(
  id: GalleryMaterialId,
  overrides: Partial<Pick<THREE.MeshPhysicalMaterialParameters, 'color' | 'roughness' | 'metalness' | 'emissive' | 'emissiveIntensity'>> = {},
): THREE.MeshPhysicalMaterial {
  const spec = SHARED_MATERIALS[id];
  return new THREE.MeshPhysicalMaterial({
    color: overrides.color ?? spec.color,
    roughness: overrides.roughness ?? spec.roughness,
    metalness: overrides.metalness ?? spec.metalness,
    clearcoat: spec.clearcoat ?? 0,
    clearcoatRoughness: spec.clearcoatRoughness ?? 0.5,
    emissive: overrides.emissive ?? spec.emissive ?? 0x000000,
    emissiveIntensity: overrides.emissiveIntensity ?? spec.emissiveIntensity ?? 0,
  });
}

export function createGalleryEmissiveMaterial(color: number, intensity = 1.5): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });
  material.toneMapped = false;
  material.userData.emissiveIntensity = intensity;
  return material;
}
