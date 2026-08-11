import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export async function loadStudioEnvironment(scene: THREE.Scene): Promise<THREE.DataTexture> {
  const hdr = await new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}studio.hdr`);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  scene.environmentIntensity = 0.9;
  return hdr;
}
