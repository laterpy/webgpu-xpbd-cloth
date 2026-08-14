import * as THREE from 'three/webgpu';
import { RoomConfig } from '../gallery/GalleryManifest';
import { createGalleryEmissiveMaterial, createGalleryMaterial } from './RoomAssetCatalog';

export class ThematicDoor {
  readonly group = new THREE.Group();
  readonly config: RoomConfig;
  readonly index: number;

  private readonly leftPanel: THREE.Mesh;
  private readonly rightPanel: THREE.Mesh;
  private readonly slitGlow: THREE.Mesh;
  private readonly frameMesh: THREE.LineSegments;
  private readonly doorLight: THREE.PointLight;
  private readonly panelGeometry: THREE.BoxGeometry;
  private readonly panelMaterial: THREE.MeshPhysicalMaterial;
  private readonly additionalMeshes: THREE.Mesh[] = [];
  private openProgress = 0;
  private isHovered = false;

  constructor(config: RoomConfig, index: number) {
    this.config = config;
    this.index = index;
    this.group.name = `ThematicDoor_${config.id}`;

    const doorWidth = 3.2;
    const doorHeight = 4.8;
    const doorThickness = 0.2;

    // Doorway architectural frame outline
    const frameGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(doorWidth + 0.3, doorHeight + 0.3, doorThickness + 0.1));
    const frameMat = new THREE.LineBasicMaterial({
      color: 0x8a7752,
      transparent: true,
      opacity: 0.6,
    });
    this.frameMesh = new THREE.LineSegments(frameGeom, frameMat);
    this.frameMesh.position.set(0, 0, 0);
    this.group.add(this.frameMesh);

    // Left & Right sliding door panels
    this.panelGeometry = new THREE.BoxGeometry(doorWidth / 2 - 0.02, doorHeight, doorThickness);
    this.panelMaterial = createGalleryMaterial('blackenedBronze', {
      color: 0x141419,
      roughness: 0.35,
      metalness: 0.8,
    });

    this.leftPanel = new THREE.Mesh(this.panelGeometry, this.panelMaterial);
    this.leftPanel.position.set(-doorWidth / 4, 0, 0);
    this.group.add(this.leftPanel);

    this.rightPanel = new THREE.Mesh(this.panelGeometry, this.panelMaterial);
    this.rightPanel.position.set(doorWidth / 4, 0, 0);
    this.group.add(this.rightPanel);

    // Vertical glowing light slit between doors
    const slitGeom = new THREE.PlaneGeometry(0.06, doorHeight * 0.9);
    const slitMat = new THREE.MeshBasicMaterial({
      color: config.spotlightColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.slitGlow = new THREE.Mesh(slitGeom, slitMat);
    this.slitGlow.position.set(0, 0, doorThickness / 2 + 0.01);
    this.group.add(this.slitGlow);

    const themeAccent = this.getThemeAccent(config.id, config.spotlightColor);
    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 3.55, 0.025),
      createGalleryMaterial('blackenedBronze', {
        color: themeAccent,
        emissive: themeAccent,
        emissiveIntensity: 0.22,
      }),
    );
    inset.position.set(0, -0.15, doorThickness / 2 + 0.035);
    inset.userData.assetId = 'thematic-material-insert';
    this.additionalMeshes.push(inset);
    this.group.add(inset);

    const threshold = new THREE.Mesh(
      new THREE.PlaneGeometry(2.15, 0.035),
      createGalleryEmissiveMaterial(themeAccent, 1.4),
    );
    threshold.rotation.x = -Math.PI / 2;
    threshold.position.set(0, -doorHeight / 2 + 0.03, doorThickness / 2 + 0.03);
    this.additionalMeshes.push(threshold);
    this.group.add(threshold);

    // Top Header Plaque / Marquee
    const plaqueGeom = new THREE.PlaneGeometry(doorWidth * 0.8, 0.45);
    const plaqueMat = createGalleryMaterial('blackenedBronze', {
      color: 0x221c14,
      roughness: 0.3,
      metalness: 0.85,
      emissive: 0x1a140a,
      emissiveIntensity: 0.35,
    });
    const plaque = new THREE.Mesh(plaqueGeom, plaqueMat);
    plaque.position.set(0, doorHeight / 2 + 0.35, doorThickness / 2 + 0.02);
    plaque.userData.assetId = 'room-header-plaque';
    this.additionalMeshes.push(plaque);
    this.group.add(plaque);

    const jambMaterial = createGalleryMaterial('blackenedBronze', { color: 0x4d3e30, roughness: 0.42 });
    const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorHeight + 0.18, 0.28), jambMaterial);
    leftJamb.position.x = -(doorWidth + 0.18) / 2;
    const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorHeight + 0.18, 0.28), jambMaterial);
    rightJamb.position.x = (doorWidth + 0.18) / 2;
    const topJamb = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.5, 0.16, 0.28), jambMaterial);
    topJamb.position.y = (doorHeight + 0.18) / 2;
    this.additionalMeshes.push(leftJamb, rightJamb, topJamb);
    this.group.add(leftJamb, rightJamb, topJamb);

    // Ambient theme doorway light
    this.doorLight = new THREE.PointLight(config.spotlightColor, 1.8, 8, 1.5);
    this.doorLight.position.set(0, doorHeight / 2, 0.6);
    this.group.add(this.doorLight);
  }

  setOpenProgress(progress: number): void {
    this.openProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const doorWidth = 3.2;
    const slideOffset = (doorWidth / 2) * this.openProgress;

    this.leftPanel.position.x = -doorWidth / 4 - slideOffset;
    this.rightPanel.position.x = doorWidth / 4 + slideOffset;

    // Fade out slit glow as doors open
    (this.slitGlow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - this.openProgress * 1.5));
    this.doorLight.intensity = THREE.MathUtils.lerp(1.8, 4.2, this.openProgress);
  }

  getOpenProgress(): number {
    return this.openProgress;
  }

  private getThemeAccent(roomId: string, fallback: number): number {
    const accents: Record<string, number> = {
      travel: 0xe0a45a,
      portrait: 0xe5b2a5,
      memory: 0xffd27d,
      nature: 0x8bcf7f,
      urban: 0x9abfff,
      abstract: 0xd69aff,
      creation: 0xffe3b7,
      archive: 0xc79b68,
    };
    return accents[roomId] ?? fallback;
  }

  setHovered(hovered: boolean): void {
    if (this.isHovered === hovered) return;
    this.isHovered = hovered;
    (this.frameMesh.material as THREE.LineBasicMaterial).opacity = hovered ? 0.95 : 0.6;
    (this.frameMesh.material as THREE.LineBasicMaterial).color.setHex(hovered ? 0xffdf7a : 0x8a7752);
    this.doorLight.intensity = hovered ? 2.8 : 1.8;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.frameMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.panelGeometry.dispose();
    this.panelMaterial.dispose();
    this.slitGlow.geometry.dispose();
    (this.slitGlow.material as THREE.Material).dispose();
    for (const mesh of this.additionalMeshes) {
      mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    }
  }
}
