import * as THREE from 'three/webgpu';
import { RoomConfig } from '../gallery/GalleryManifest';
import { createGalleryEmissiveMaterial, createGalleryMaterial } from './RoomAssetCatalog';

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3 | [number, number, number],
  rotation?: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  if (Array.isArray(position)) {
    mesh.position.set(position[0], position[1], position[2]);
  } else {
    mesh.position.copy(position);
  }
  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFloorLight(group: THREE.Group, color: number, position: [number, number, number], scale: [number, number, number]): void {
  const mesh = addMesh(
    group,
    new THREE.BoxGeometry(1, 0.018, 0.08),
    createGalleryEmissiveMaterial(color, 1.3),
    position,
  );
  mesh.scale.set(scale[0], scale[1], scale[2]);
}

function addWallLight(group: THREE.Group, color: number, position: [number, number, number], rotationY = 0): void {
  addMesh(
    group,
    new THREE.PlaneGeometry(0.04, 3.2),
    createGalleryEmissiveMaterial(color, 1.1),
    position,
    [0, rotationY, 0],
  );
}

function addTravelDecor(group: THREE.Group, accent: number): void {
  const bronze = createGalleryMaterial('blackenedBronze');
  const stone = createGalleryMaterial('blackStone');
  const plinth = addMesh(group, new THREE.BoxGeometry(2.6, 0.34, 1.1), stone, [0, -3.25, -3.65]);
  addMesh(group, new THREE.BoxGeometry(2.25, 0.035, 0.78), bronze, [0, -3.07, -3.65]);
  addFloorLight(group, accent, [-5.8, -3.36, -3.65], [1.2, 1, 1]);
  addFloorLight(group, accent, [5.8, -3.36, -3.65], [1.2, 1, 1]);
  plinth.userData.assetId = 'travel-orientation-plinth';
}

function addPortraitDecor(group: THREE.Group, accent: number): void {
  const veilMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x86665d,
    transparent: true,
    opacity: 0.08,
    roughness: 0.25,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    addMesh(
      group,
      new THREE.PlaneGeometry(0.025, 5.3),
      veilMaterial,
      [Math.cos(angle) * 2.05, -0.75, Math.sin(angle) * 2.05],
      [0, -angle, 0],
    );
  }
  addFloorLight(group, accent, [-2.8, -3.46, 0], [1.3, 1, 1]);
  addFloorLight(group, accent, [2.8, -3.46, 0], [1.3, 1, 1]);
}

function addMemoryDecor(group: THREE.Group, accent: number): void {
  const bronze = createGalleryMaterial('blackenedBronze');
  const glass = createGalleryMaterial('smokedGlass', { emissive: accent, emissiveIntensity: 0.28 });
  const relic = new THREE.Group();
  relic.name = 'MemoryRelic';
  addMesh(relic, new THREE.CylinderGeometry(0.52, 0.64, 0.12, 24), bronze, [0, 0, 0]);
  addMesh(relic, new THREE.ConeGeometry(0.42, 0.72, 24, 1, true), glass, [0, 0.48, 0]);
  addMesh(relic, new THREE.ConeGeometry(0.42, 0.72, 24, 1, true), glass, [0, -0.48, 0], [Math.PI, 0, 0]);
  addMesh(relic, new THREE.SphereGeometry(0.07, 12, 8), createGalleryEmissiveMaterial(accent, 1.6), [0, 0, 0]);
  relic.position.set(0, -2.7, -0.2);
  group.add(relic);
  addFloorLight(group, accent, [-4.5, -3.46, -1.3], [0.8, 1, 1]);
  addFloorLight(group, accent, [4.5, -3.46, -1.3], [0.8, 1, 1]);
}

function addNatureDecor(group: THREE.Group, accent: number): void {
  const rockMaterial = createGalleryMaterial('mossRock');
  const leafMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x496b44,
    roughness: 0.76,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const rockGeometry = new THREE.IcosahedronGeometry(0.55, 1);
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 5);
  const dummy = new THREE.Object3D();
  const islandPositions: Array<[number, number, number]> = [
    [-5.0, -3.15, -2.4],
    [-2.0, -3.25, -3.6],
    [1.9, -3.25, -3.2],
    [4.9, -3.18, -2.2],
    [0.2, -3.3, -0.5],
  ];
  islandPositions.forEach(([x, y, z], index) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(1.1 + index * 0.04, 0.45 + (index % 2) * 0.12, 0.85);
    dummy.rotation.set(0.2 * index, index * 0.8, 0.1 * index);
    dummy.updateMatrix();
    rocks.setMatrixAt(index, dummy.matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  for (let i = 0; i < 7; i++) {
    const x = -5.2 + (i % 4) * 3.3;
    const z = -2.9 + Math.floor(i / 4) * 1.8;
    const leaf = addMesh(group, new THREE.ConeGeometry(0.18, 1.2 + (i % 3) * 0.25, 6), leafMaterial, [x, -2.45, z]);
    leaf.scale.x = 0.6;
    leaf.scale.z = 0.8;
  }
  addFloorLight(group, accent, [-5.8, -3.42, 0.2], [1.2, 1, 1]);
}

function addUrbanDecor(group: THREE.Group, accent: number): void {
  const steel = createGalleryMaterial('brushedSteel');
  const skyline = new THREE.Group();
  skyline.name = 'UrbanSkylineRelief';
  const heights = [1.2, 2.2, 1.6, 3.1, 2.0, 2.8, 1.4, 2.5, 1.8];
  heights.forEach((height, index) => {
    addMesh(skyline, new THREE.BoxGeometry(0.62, height, 0.18), steel, [-3.1 + index * 0.78, height / 2 - 3.48, -4.35]);
  });
  group.add(skyline);
  addMesh(group, new THREE.BoxGeometry(3.6, 0.28, 0.72), createGalleryMaterial('darkTimber'), [0, -2.95, 2.25]);
  addMesh(group, new THREE.BoxGeometry(3.3, 0.18, 0.58), steel, [0, -2.75, 2.25]);
  addFloorLight(group, accent, [-4.7, -3.45, 1.4], [1.5, 1, 1]);
  addFloorLight(group, accent, [4.7, -3.45, 1.4], [1.5, 1, 1]);
}

function addAbstractDecor(group: THREE.Group, accent: number): void {
  const bronze = createGalleryMaterial('blackenedBronze');
  const glass = createGalleryMaterial('smokedGlass', { emissive: accent, emissiveIntensity: 0.45 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.9, -3.05, 0),
    new THREE.Vector3(-1.2, -1.7, 0.2),
    new THREE.Vector3(0.9, -0.5, -0.2),
    new THREE.Vector3(1.1, 0.7, 0.1),
    new THREE.Vector3(-0.4, 1.9, 0),
  ]);
  const ribbon = addMesh(group, new THREE.TubeGeometry(curve, 48, 0.16, 10, false), glass, [0, 0, 0]);
  ribbon.scale.set(1.15, 1.0, 0.65);
  addMesh(group, new THREE.TorusGeometry(2.25, 0.035, 12, 64), bronze, [0, 1.95, 0], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.CylinderGeometry(1.55, 1.7, 0.2, 32), bronze, [0, -3.48, 0]);
  addFloorLight(group, accent, [0, -3.36, 0], [2.1, 1, 1]);
}

function addCreationDecor(group: THREE.Group, accent: number): void {
  const timber = createGalleryMaterial('darkTimber');
  const steel = createGalleryMaterial('brushedSteel');
  const ivory = createGalleryMaterial('warmIvory');
  addMesh(group, new THREE.BoxGeometry(5.2, 0.28, 2.1), timber, [0, -2.9, 1.1]);
  for (const x of [-2.2, 2.2]) {
    for (const z of [0.3, 1.9]) {
      addMesh(group, new THREE.BoxGeometry(0.15, 1.7, 0.15), steel, [x, -3.75, z]);
    }
  }
  for (const x of [-2.9, 2.9]) {
    addMesh(group, new THREE.CylinderGeometry(0.3, 0.34, 0.08, 16), timber, [x, -3.22, 1.1]);
    addMesh(group, new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), steel, [x, -3.78, 1.1]);
  }
  const board = addMesh(group, new THREE.BoxGeometry(5.5, 2.7, 0.12), steel, [0, 0.0, -4.38]);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      addMesh(group, new THREE.BoxGeometry(0.54, 0.38, 0.035), ivory, [-2.15 + col * 0.86, 0.72 - row * 0.72, -4.28]);
    }
  }
  board.userData.assetId = 'creation-grid-wall';
  addFloorLight(group, accent, [0, -3.38, -0.4], [2.5, 1, 1]);
}

function addArchiveDecor(group: THREE.Group, accent: number): void {
  const timber = createGalleryMaterial('darkTimber');
  const bronze = createGalleryMaterial('blackenedBronze');
  const ivory = createGalleryMaterial('warmIvory');
  const cabinetGeometry = new THREE.BoxGeometry(0.9, 0.62, 0.24);
  const cabinetMaterial = timber;
  const cabinets = new THREE.InstancedMesh(cabinetGeometry, cabinetMaterial, 36);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 3; col++) {
        dummy.position.set(side * (4.55 + col * 1.0), -2.7 + row * 0.85, -3.95);
        dummy.updateMatrix();
        cabinets.setMatrixAt(index++, dummy.matrix);
      }
    }
  }
  cabinets.instanceMatrix.needsUpdate = true;
  cabinets.castShadow = true;
  cabinets.receiveShadow = true;
  group.add(cabinets);

  addMesh(group, new THREE.BoxGeometry(3.5, 0.32, 1.8), timber, [0, -3.0, 0.6]);
  addMesh(group, new THREE.BoxGeometry(3.35, 0.04, 1.64), ivory, [0, -2.79, 0.6]);
  addMesh(group, new THREE.BoxGeometry(3.7, 0.08, 1.96), bronze, [0, -2.72, 0.6]);
  addFloorLight(group, accent, [0, -3.36, 0.6], [1.6, 1, 1]);
}

export function buildRoomDecor(config: RoomConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = `RoomDecor_${config.id}`;

  switch (config.id) {
    case 'travel':
      addTravelDecor(group, config.spotlightColor);
      break;
    case 'portrait':
      addPortraitDecor(group, config.spotlightColor);
      break;
    case 'memory':
      addMemoryDecor(group, config.spotlightColor);
      break;
    case 'nature':
      addNatureDecor(group, config.spotlightColor);
      break;
    case 'urban':
      addUrbanDecor(group, config.spotlightColor);
      break;
    case 'abstract':
      addAbstractDecor(group, config.spotlightColor);
      break;
    case 'creation':
      addCreationDecor(group, config.spotlightColor);
      break;
    case 'archive':
      addArchiveDecor(group, config.spotlightColor);
      break;
  }

  return group;
}
