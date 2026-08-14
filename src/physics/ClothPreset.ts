import * as THREE from 'three/webgpu';

export interface ClothPresetConfig {
  id: string;
  name: string;
  description: string;
  // XPBD compliance values (smaller = stiffer, larger = softer)
  structuralCompliance: number;
  shearCompliance: number;
  bendCompliance: number;
  compressionBarrierRatio: number;
  compressionBarrierCompliance: number;
  // Simulation dynamics
  mass: number;
  airDrag: number;
  velocityDamping: number;
  windMultiplier: number;
  // PBR rendering properties
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenColor: THREE.Color;
  sheenRoughness: number;
  ior: number;
  envMapIntensity: number;
}

export const CLOTH_PRESETS: Record<string, ClothPresetConfig> = {
  photoPaper: {
    id: 'photoPaper',
    name: '高级相纸 (Photo Paper)',
    description: '表面光滑挺括，具有微光泽与适度抗弯刚度，展现照片细腻质感。',
    structuralCompliance: 1.5e-7,
    shearCompliance: 1.2e-6,
    bendCompliance: 3.5e-4,
    compressionBarrierRatio: 0.70,
    compressionBarrierCompliance: 8e-8,
    mass: 1.0,
    airDrag: 0.997,
    velocityDamping: 0.99,
    windMultiplier: 1.0,
    roughness: 0.65,
    metalness: 0.0,
    clearcoat: 0.15,
    clearcoatRoughness: 0.60,
    sheen: 0.12,
    sheenColor: new THREE.Color(0xfff5ea),
    sheenRoughness: 0.85,
    ior: 1.48,
    envMapIntensity: 0.95,
  },

  fineArtCanvas: {
    id: 'fineArtCanvas',
    name: '艺术油画布 (Fine Art Canvas)',
    description: '织物质感厚重，阻尼较高，哑光质感，摆动平稳内敛。',
    structuralCompliance: 3e-7,
    shearCompliance: 2e-6,
    bendCompliance: 2e-4,
    compressionBarrierRatio: 0.75,
    compressionBarrierCompliance: 5e-8,
    mass: 1.4,
    airDrag: 0.994,
    velocityDamping: 0.985,
    windMultiplier: 0.85,
    roughness: 0.88,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.9,
    sheen: 0.28,
    sheenColor: new THREE.Color(0xf2e8dc),
    sheenRoughness: 0.92,
    ior: 1.42,
    envMapIntensity: 0.75,
  },

  silkFabric: {
    id: 'silkFabric',
    name: '真丝素绉缎 (Silk Fabric)',
    description: '极度轻柔飘逸，低抗弯刚度，对微小气流与呼吸极其敏感。',
    structuralCompliance: 5e-7,
    shearCompliance: 3e-6,
    bendCompliance: 9e-4,
    compressionBarrierRatio: 0.55,
    compressionBarrierCompliance: 2e-7,
    mass: 0.7,
    airDrag: 0.998,
    velocityDamping: 0.992,
    windMultiplier: 1.4,
    roughness: 0.45,
    metalness: 0.05,
    clearcoat: 0.22,
    clearcoatRoughness: 0.40,
    sheen: 0.45,
    sheenColor: new THREE.Color(0xffeed6),
    sheenRoughness: 0.70,
    ior: 1.52,
    envMapIntensity: 1.15,
  },

  agedPaper: {
    id: 'agedPaper',
    name: '复古手工棉纸 (Aged Cotton Paper)',
    description: '岁月质感，边缘微卷，表面具有自然纤维微糙感与温暖漫反射。',
    structuralCompliance: 2.5e-7,
    shearCompliance: 1.8e-6,
    bendCompliance: 5e-4,
    compressionBarrierRatio: 0.65,
    compressionBarrierCompliance: 1e-7,
    mass: 0.9,
    airDrag: 0.996,
    velocityDamping: 0.988,
    windMultiplier: 1.1,
    roughness: 0.82,
    metalness: 0.0,
    clearcoat: 0.04,
    clearcoatRoughness: 0.85,
    sheen: 0.18,
    sheenColor: new THREE.Color(0xf6ebd9),
    sheenRoughness: 0.90,
    ior: 1.44,
    envMapIntensity: 0.85,
  },
};

export function getClothPreset(presetId?: string): ClothPresetConfig {
  if (presetId && CLOTH_PRESETS[presetId]) {
    return CLOTH_PRESETS[presetId];
  }
  return CLOTH_PRESETS.photoPaper;
}
