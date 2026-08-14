import * as THREE from 'three/webgpu';
import { GalleryItemData } from './GalleryItem';

export interface RoomConfig {
  id: string;
  name: string;
  enName: string;
  description: string;
  ambientLightColor: number;
  ambientIntensity: number;
  spotlightColor: number;
  spotlightIntensity: number;
  wallColor: number;
  floorRoughness: number;
  floorMetalness: number;
  windStrength: number;
  gravityStrength: number;
  items: GalleryItemData[];
}

// Generate procedural museum-grade art textures with film grain, atmospheric gradients, and lighting
export function createArtworkTexture(item: GalleryItemData): THREE.Texture {
  const width = 1600;
  const height = Math.round(width / item.aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.Texture();
  }

  // Draw procedural artwork based on ID
  drawScene(ctx, width, height, item.id);

  // Add subtle film grain & photographic vignette
  addPhotoAtmosphere(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, id: string): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);

  switch (id) {
    case 'golden-peak': {
      // Golden Peak: Morning sun hitting majestic alpine summit
      grad.addColorStop(0, '#101726');
      grad.addColorStop(0.35, '#28364d');
      grad.addColorStop(0.65, '#e09853');
      grad.addColorStop(0.85, '#e8b87d');
      grad.addColorStop(1, '#664c38');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Distant sky glow
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.55, 50, w * 0.5, h * 0.55, w * 0.6);
      glow.addColorStop(0, 'rgba(255, 220, 150, 0.45)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Back Mountain ridge
      ctx.fillStyle = '#1c2230';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.85);
      ctx.lineTo(w * 0.25, h * 0.55);
      ctx.lineTo(w * 0.45, h * 0.65);
      ctx.lineTo(w * 0.75, h * 0.45);
      ctx.lineTo(w, h * 0.75);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();

      // Main Golden Peak
      const peakGrad = ctx.createLinearGradient(w * 0.5, h * 0.28, w * 0.8, h * 0.9);
      peakGrad.addColorStop(0, '#ffdf99');
      peakGrad.addColorStop(0.3, '#de9045');
      peakGrad.addColorStop(0.7, '#4a3328');
      peakGrad.addColorStop(1, '#1b1a20');
      ctx.fillStyle = peakGrad;
      ctx.beginPath();
      ctx.moveTo(w * 0.15, h);
      ctx.lineTo(w * 0.48, h * 0.28);
      ctx.lineTo(w * 0.52, h * 0.28);
      ctx.lineTo(w * 0.88, h);
      ctx.fill();

      // Snow ridges & light highlights
      ctx.fillStyle = 'rgba(255, 245, 225, 0.75)';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.28);
      ctx.lineTo(w * 0.51, h * 0.45);
      ctx.lineTo(w * 0.42, h * 0.62);
      ctx.lineTo(w * 0.38, h * 0.8);
      ctx.lineTo(w * 0.5, h * 0.28);
      ctx.fill();
      break;
    }

    case 'solitude-mist': {
      // Nordic Fjord in mist
      grad.addColorStop(0, '#0c151c');
      grad.addColorStop(0.4, '#1b2d38');
      grad.addColorStop(0.7, '#425866');
      grad.addColorStop(1, '#1e2b33');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Fjord water reflection line
      const waterGrad = ctx.createLinearGradient(0, h * 0.65, 0, h);
      waterGrad.addColorStop(0, '#2d3e47');
      waterGrad.addColorStop(1, '#080d12');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, h * 0.65, w, h * 0.35);

      // Soft fjord mountain silhouettes
      ctx.fillStyle = '#111a21';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.4);
      ctx.lineTo(w * 0.35, h * 0.68);
      ctx.lineTo(0, h * 0.68);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(w, h * 0.35);
      ctx.lineTo(w * 0.6, h * 0.68);
      ctx.lineTo(w, h * 0.68);
      ctx.fill();

      // Atmospheric mist layer
      const mistGrad = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.75);
      mistGrad.addColorStop(0, 'rgba(180, 210, 225, 0.4)');
      mistGrad.addColorStop(0.5, 'rgba(210, 230, 240, 0.7)');
      mistGrad.addColorStop(1, 'rgba(180, 210, 225, 0)');
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, h * 0.55, w, h * 0.2);
      break;
    }

    case 'dawn-monolith': {
      // Iceland Black Sand beach with basalt stacks at dawn
      grad.addColorStop(0, '#0b0c14');
      grad.addColorStop(0.3, '#1c1b2b');
      grad.addColorStop(0.65, '#bd634e');
      grad.addColorStop(0.8, '#d49b6a');
      grad.addColorStop(1, '#141417');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Ocean & surf
      const surfGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
      surfGrad.addColorStop(0, '#363745');
      surfGrad.addColorStop(0.3, '#cfc8c2');
      surfGrad.addColorStop(1, '#0e0f12');
      ctx.fillStyle = surfGrad;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);

      // Monolith sea stacks
      ctx.fillStyle = '#0a0a0f';
      ctx.beginPath();
      ctx.moveTo(w * 0.55, h * 0.72);
      ctx.lineTo(w * 0.58, h * 0.48);
      ctx.lineTo(w * 0.62, h * 0.46);
      ctx.lineTo(w * 0.66, h * 0.72);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(w * 0.7, h * 0.72);
      ctx.lineTo(w * 0.72, h * 0.56);
      ctx.lineTo(w * 0.76, h * 0.72);
      ctx.fill();
      break;
    }

    case 'kyoto-rain': {
      // Kyoto night rain with glowing paper lanterns
      grad.addColorStop(0, '#090a10');
      grad.addColorStop(0.5, '#13141f');
      grad.addColorStop(0.8, '#262024');
      grad.addColorStop(1, '#110e14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Warm lantern radial glow
      const lantern = ctx.createRadialGradient(w * 0.35, h * 0.45, 10, w * 0.35, h * 0.45, w * 0.4);
      lantern.addColorStop(0, 'rgba(255, 160, 60, 0.9)');
      lantern.addColorStop(0.3, 'rgba(255, 120, 40, 0.4)');
      lantern.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lantern;
      ctx.fillRect(0, 0, w, h);

      // Wet cobblestone reflections
      const wetRoad = ctx.createLinearGradient(0, h * 0.68, 0, h);
      wetRoad.addColorStop(0, 'rgba(255, 160, 70, 0.35)');
      wetRoad.addColorStop(0.5, 'rgba(20, 20, 30, 0.8)');
      wetRoad.addColorStop(1, 'rgba(10, 10, 15, 0.95)');
      ctx.fillStyle = wetRoad;
      ctx.fillRect(0, h * 0.68, w, h * 0.32);

      // Traditional pagoda eaves silhouette
      ctx.fillStyle = '#06070a';
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.3);
      ctx.quadraticCurveTo(w * 0.35, h * 0.38, w * 0.6, h * 0.32);
      ctx.lineTo(w * 0.55, h * 0.42);
      ctx.lineTo(w * 0.15, h * 0.4);
      ctx.fill();
      break;
    }

    case 'sahara-whisper': {
      // Sahara wind patterns in sand
      grad.addColorStop(0, '#1c151b');
      grad.addColorStop(0.4, '#4a2824');
      grad.addColorStop(0.7, '#c96838');
      grad.addColorStop(0.85, '#e89e5a');
      grad.addColorStop(1, '#572d17');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Sand dune curves
      ctx.fillStyle = '#a64f28';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.65);
      ctx.bezierCurveTo(w * 0.3, h * 0.5, w * 0.7, h * 0.75, w, h * 0.58);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();

      ctx.fillStyle = '#612a14';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      ctx.bezierCurveTo(w * 0.4, h * 0.85, w * 0.6, h * 0.68, w, h * 0.82);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();
      break;
    }

    case 'pacific-coast': {
      // California Pacific Coast sunset
      grad.addColorStop(0, '#161426');
      grad.addColorStop(0.35, '#52294c');
      grad.addColorStop(0.6, '#b54e4a');
      grad.addColorStop(0.75, '#e89158');
      grad.addColorStop(0.85, '#f5c678');
      grad.addColorStop(1, '#1b2230');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Ocean surf reflection
      const ocean = ctx.createLinearGradient(0, h * 0.78, 0, h);
      ocean.addColorStop(0, '#f5c678');
      ocean.addColorStop(0.4, '#382e3f');
      ocean.addColorStop(1, '#0e121a');
      ctx.fillStyle = ocean;
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      break;
    }

    case 'architectural-echoes': {
      // Monochrome Minimalist brutalist concrete & sharp shadows
      grad.addColorStop(0, '#141416');
      grad.addColorStop(0.5, '#2e2e33');
      grad.addColorStop(1, '#18181a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Diagonal concrete beam shadow
      ctx.fillStyle = '#08080a';
      ctx.beginPath();
      ctx.moveTo(w * 0.1, 0);
      ctx.lineTo(w * 0.9, h);
      ctx.lineTo(0, h);
      ctx.lineTo(0, 0);
      ctx.fill();

      // Light beam
      const beam = ctx.createLinearGradient(w * 0.4, 0, w * 0.8, h);
      beam.addColorStop(0, 'rgba(240, 240, 245, 0.85)');
      beam.addColorStop(0.6, 'rgba(180, 180, 190, 0.4)');
      beam.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, 0);
      ctx.lineTo(w * 0.6, 0);
      ctx.lineTo(w * 0.95, h * 0.8);
      ctx.lineTo(w * 0.7, h * 0.8);
      ctx.fill();
      break;
    }

    case 'violinist-hands': {
      // Monochrome Hands of the Violinist in theater darkness
      grad.addColorStop(0, '#0a0a0c');
      grad.addColorStop(0.6, '#18181c');
      grad.addColorStop(1, '#0d0d10');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Focused spotlight on center
      const spot = ctx.createRadialGradient(w * 0.5, h * 0.5, 30, w * 0.5, h * 0.5, w * 0.4);
      spot.addColorStop(0, 'rgba(230, 230, 235, 0.75)');
      spot.addColorStop(0.4, 'rgba(120, 120, 130, 0.25)');
      spot.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, h);

      // Violin wood curves
      ctx.fillStyle = '#222226';
      ctx.beginPath();
      ctx.ellipse(w * 0.52, h * 0.55, w * 0.25, h * 0.18, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'winter-branches': {
      // Hokkaido solitary tree in vast snowfield
      grad.addColorStop(0, '#b8bcc4');
      grad.addColorStop(0.5, '#d6dae0');
      grad.addColorStop(0.75, '#edf0f5');
      grad.addColorStop(1, '#f2f4f8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Minimalist tree trunk & branches
      ctx.strokeStyle = '#18191c';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.78);
      ctx.lineTo(w * 0.5, h * 0.48);
      ctx.stroke();

      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.58);
      ctx.lineTo(w * 0.42, h * 0.42);
      ctx.moveTo(w * 0.5, h * 0.54);
      ctx.lineTo(w * 0.58, h * 0.38);
      ctx.moveTo(w * 0.42, h * 0.42);
      ctx.lineTo(w * 0.36, h * 0.35);
      ctx.moveTo(w * 0.58, h * 0.38);
      ctx.lineTo(w * 0.64, h * 0.32);
      ctx.stroke();
      break;
    }

    case 'amazon-canopy': {
      // Amazon Rainforest with golden Tyndall sunbeams
      grad.addColorStop(0, '#0a1710');
      grad.addColorStop(0.4, '#142e20');
      grad.addColorStop(0.7, '#234a34');
      grad.addColorStop(1, '#0e1c14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Golden Tyndall light rays
      const rays = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, h);
      rays.addColorStop(0, 'rgba(255, 235, 150, 0.6)');
      rays.addColorStop(0.5, 'rgba(180, 230, 160, 0.25)');
      rays.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rays;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0);
      ctx.lineTo(w * 0.45, 0);
      ctx.lineTo(w * 0.85, h);
      ctx.lineTo(w * 0.6, h);
      ctx.fill();

      // Lush foliage silhouette
      ctx.fillStyle = '#060f0a';
      ctx.beginPath();
      ctx.arc(w * 0.15, h * 0.3, w * 0.2, 0, Math.PI * 2);
      ctx.arc(w * 0.85, h * 0.25, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'misty-pine': {
      // Pacific Northwest Misty Pine Forest
      grad.addColorStop(0, '#101c18');
      grad.addColorStop(0.5, '#223830');
      grad.addColorStop(0.75, '#4a6b5e');
      grad.addColorStop(1, '#1b2923');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Pine tree silhouettes layered in mist
      ctx.fillStyle = '#080d0b';
      for (let i = 0; i < 7; i++) {
        const x = w * (0.1 + i * 0.14);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.82);
        ctx.lineTo(x - w * 0.05, h * 0.82);
        ctx.lineTo(x, h * (0.35 + (i % 3) * 0.08));
        ctx.lineTo(x + w * 0.05, h * 0.82);
        ctx.fill();
      }

      // Forest fog band
      const fog = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.75);
      fog.addColorStop(0, 'rgba(200, 220, 215, 0.45)');
      fog.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * 0.5, w, h * 0.25);
      break;
    }

    case 'emerald-rapids': {
      // Canadian Rocky Mountain emerald glacial rapids
      grad.addColorStop(0, '#0c1619');
      grad.addColorStop(0.4, '#1b3238');
      grad.addColorStop(0.7, '#2a6369');
      grad.addColorStop(0.85, '#56b8b8');
      grad.addColorStop(1, '#0e2428');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Rapids foam waves
      ctx.fillStyle = 'rgba(235, 250, 250, 0.75)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.85);
      ctx.bezierCurveTo(w * 0.3, h * 0.8, w * 0.6, h * 0.9, w, h * 0.82);
      ctx.lineTo(w, h * 0.92);
      ctx.bezierCurveTo(w * 0.7, h * 0.98, w * 0.2, h * 0.88, 0, h * 0.95);
      ctx.fill();
      break;
    }

    default: {
      grad.addColorStop(0, '#1a1a24');
      grad.addColorStop(1, '#0c0c10');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
}

function addPhotoAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Vignette
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.45, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Subtle photo border line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);
}

export const GALLERY_ROOMS: RoomConfig[] = [
  {
    id: 'sanctuary',
    name: '主展厅 · 典藏神庙',
    enName: 'The Masterpiece Sanctuary',
    description: '大尺度极简展厅，金色微光聚光灯下，代表作如纸张悬垂，静听时光流转。',
    ambientLightColor: 0x18181c,
    ambientIntensity: 0.85,
    spotlightColor: 0xffeed6,
    spotlightIntensity: 3.5,
    wallColor: 0x121215,
    floorRoughness: 0.45,
    floorMetalness: 0.35,
    windStrength: 0.12,
    gravityStrength: 7.8,
    items: [
      {
        id: 'golden-peak',
        roomId: 'sanctuary',
        title: 'The Golden Peak',
        year: '2026',
        location: 'Matterhorn, Switzerland',
        cameraInfo: 'Hasselblad H6D-100c · 100mm f/4 · 1/250s · ISO 64',
        preset: 'photoPaper',
        aspectRatio: 1.5,
        story: {
          subtitle: '晨光穿透流云的瞬间，时间仿佛在此刻静止',
          paragraph1: '那天清晨五点，气温跌破零下十五度。在阿尔卑斯山脊漫长等待两小时后，第一缕金色晨光穿透厚重云层，精准点亮了马特洪峰凛冽的岩壁边缘。',
          paragraph2: '山峦如金铸巨塔般从苍茫大地拔地而起，冷暖色调在光影交错中达到了极致的和谐与庄严。按下快门的一瞬，旷野中只剩下心跳与风的低鸣。',
          quote: '“光不仅照亮了山峰，更赋予了沉默以形体。”',
        },
      },
      {
        id: 'solitude-mist',
        roomId: 'sanctuary',
        title: 'Solitude in Mist',
        year: '2025',
        location: 'Geiranger Fjord, Norway',
        cameraInfo: 'Leica SL2 · 50mm f/1.4 Summilux · 1/60s · ISO 100',
        preset: 'fineArtCanvas',
        aspectRatio: 1.45,
        story: {
          subtitle: '幽蓝峡湾与凝固的晨雾，孤独是最高贵的自省',
          paragraph1: '盖朗厄尔峡湾的清晨被一层浓密而轻柔的水汽笼罩，静谧得如同世界的尽头。深黛色的悬崖倒映在如镜水面上，分不清哪里是天空，哪里是深渊。',
          paragraph2: '使用艺术油画布质感展示这幅作品，使微弱水汽与冷灰蓝调呈现出如古典油画般的深邃质感与沉稳呼吸。',
          quote: '“在无声的静止中，我们听见世界最原始的律动。”',
        },
      },
      {
        id: 'dawn-monolith',
        roomId: 'sanctuary',
        title: 'Dawn of the Monolith',
        year: '2024',
        location: 'Reynisfjara, Iceland',
        cameraInfo: 'Sony A7R V · 24-70mm f/2.8 GM II · 1/125s · ISO 80',
        preset: 'agedPaper',
        aspectRatio: 1.4,
        story: {
          subtitle: '黑沙滩上海浪与玄武岩巨石的亘古对峙',
          paragraph1: '大西洋狂烈的巨浪日夜拍击着雷尼斯黑沙滩，火山岩风化成的纯黑沙粒在破晓的暗红天光下泛着金属般的冷光。',
          paragraph2: '玄武岩海蚀柱如巨人般傲然伫立于白浪之中。复古手工纸张的微卷边缘与温润纤维，为冰岛极北之地的苍凉注入了一抹岁月温度。',
          quote: '“浪潮退去，唯有岩石记录着永恒。”',
        },
      },
    ],
  },

  {
    id: 'wanderlust',
    name: '旅行记忆室 · 行者无疆',
    enName: 'Journey & Wanderlust',
    description: '跨越洲际的旅途足迹，雨夜、沙漠与海岸，随微风飘扬的记忆碎片。',
    ambientLightColor: 0x1a1618,
    ambientIntensity: 0.9,
    spotlightColor: 0xffdfc4,
    spotlightIntensity: 3.2,
    wallColor: 0x161315,
    floorRoughness: 0.52,
    floorMetalness: 0.25,
    windStrength: 0.28,
    gravityStrength: 7.2,
    items: [
      {
        id: 'kyoto-rain',
        roomId: 'wanderlust',
        title: 'Kyoto Rain',
        year: '2026',
        location: 'Gion, Kyoto, Japan',
        cameraInfo: 'Fujifilm GFX 100 II · 45mm f/2.8 · 1/45s · ISO 800',
        preset: 'silkFabric',
        aspectRatio: 1.35,
        story: {
          subtitle: '细雨润湿的石板路，橙黄纸灯笼摇曳的幽玄时光',
          paragraph1: '初春京都的黄昏突降细雨，祇园花见小路上的游人散去。雨水将黑色的花岗岩石板洗刷得如镜面般光洁，街巷两侧暖橙色的和纸灯笼在湿润空气中晕开温柔的光晕。',
          paragraph2: '选用轻盈柔软的真丝织物作为呈现载体，布面随气流泛起轻盈涟漪，如同那夜微风吹拂屋檐风铃的轻响。',
          quote: '“雨落无声，古都的长夜便在幽微中醒来。”',
        },
      },
      {
        id: 'sahara-whisper',
        roomId: 'wanderlust',
        title: 'Sahara Whisper',
        year: '2025',
        location: 'Erg Chebbi, Morocco',
        cameraInfo: 'Canon EOS R5 · 70-200mm f/2.8L · 1/800s · ISO 100',
        preset: 'agedPaper',
        aspectRatio: 1.5,
        story: {
          subtitle: '千百年风沙雕琢的几何棱线与炽热光阴',
          paragraph1: '撒哈拉深处的切比沙丘在夕阳斜射下呈现出梦幻般的双色对比：迎光面是灿烂的赤金，背光面则是深邃的紫红。',
          paragraph2: '风在沙丘表面留下一道道如同水波般的优雅细纹，那是风走过的脚印。',
          quote: '“沙漠从不言语，却向每一位行者诉说着时间的浩瀚。”',
        },
      },
      {
        id: 'pacific-coast',
        roomId: 'wanderlust',
        title: 'Pacific Coastline',
        year: '2024',
        location: 'Big Sur, California, USA',
        cameraInfo: 'Nikon Z8 · 24-120mm f/4 S · 1/320s · ISO 64',
        preset: 'photoPaper',
        aspectRatio: 1.48,
        story: {
          subtitle: '加州一号公路悬崖之上，太平洋落日熔金的浪漫',
          paragraph1: '沿着一号公路蜿蜒驶过大苏尔，悬崖之下碧蓝海水卷起层层雪白浪花。海平线处夕阳将整片天空染成由金黄渐变至粉紫的绝美幕布。',
          paragraph2: '空气中弥漫着海盐与鼠尾草的香气，相纸在展厅微风中轻微起伏，如同重温那场无尽公路之旅。',
          quote: '“驶向落日的方向，远方就是唯一的归宿。”',
        },
      },
    ],
  },

  {
    id: 'monochrome',
    name: '黑白时光室 · 纯粹光影',
    enName: 'Monochrome & Form',
    description: '摒弃色彩喧嚣，回归结构、明暗与线条的纯粹力量。',
    ambientLightColor: 0x141416,
    ambientIntensity: 0.8,
    spotlightColor: 0xffffff,
    spotlightIntensity: 3.8,
    wallColor: 0x0e0e10,
    floorRoughness: 0.38,
    floorMetalness: 0.45,
    windStrength: 0.05,
    gravityStrength: 8.5,
    items: [
      {
        id: 'architectural-echoes',
        roomId: 'monochrome',
        title: 'Architectural Echoes',
        year: '2025',
        location: 'Berlin, Germany',
        cameraInfo: 'Leica M11 Monochrom · 35mm f/2 APO · 1/500s · ISO 125',
        preset: 'photoPaper',
        aspectRatio: 1.4,
        story: {
          subtitle: '混凝土几何与斜射强光的交响，秩序的力量',
          paragraph1: '包豪斯与粗野主义建筑在柏林交汇，午后强烈的直射阳光切过几何立面，创造出极具戏剧性的明暗对比。',
          paragraph2: '黑白摄影剥离了色彩的干扰，让视觉焦点完全回归到几何构成、材质颗粒与光线的空间张力之中。',
          quote: '“光创造了阴影，而阴影赋予了空间真实的存在。”',
        },
      },
      {
        id: 'violinist-hands',
        roomId: 'monochrome',
        title: 'The Violinist’s Hands',
        year: '2023',
        location: 'Musikverein, Vienna, Austria',
        cameraInfo: 'Canon EOS R3 · 85mm f/1.2L · 1/200s · ISO 1600',
        preset: 'fineArtCanvas',
        aspectRatio: 1.38,
        story: {
          subtitle: '金色大厅后台暗处，五十载琴弦摩挲出的岁月刻痕',
          paragraph1: '维也纳爱乐乐团演出前夕，首席小提琴家在微弱的后台暖光下调试琴弦。苍老而有力的指关节布满老茧，木质琴身在暗影中流淌出微弱光泽。',
          paragraph2: '画布的哑光颗粒感与特写的黑白反差相得益彰，每一道纹理都在述说着对艺术一生的倾注与执着。',
          quote: '“音符会消散于空气，但双手的温度永不褪色。”',
        },
      },
      {
        id: 'winter-branches',
        roomId: 'monochrome',
        title: 'Winter Branches',
        year: '2026',
        location: 'Biei, Hokkaido, Japan',
        cameraInfo: 'Hasselblad 907X · 45mm f/4 · 1/640s · ISO 100',
        preset: 'agedPaper',
        aspectRatio: 1.5,
        story: {
          subtitle: '茫茫雪原之上，孤独冬木勾勒出的东方水墨意境',
          paragraph1: '美瑛丘陵在暴风雪后化作一片无垠的留白。一株落光叶子的橡树独立于雪坡之上，枯枝在银白世界中如同墨笔在宣纸上的遒劲勾勒。',
          paragraph2: '极简的构图与大面积纯净留白，带来无与伦比的宁静感，抚平所有世俗的喧嚣。',
          quote: '“在极简之中，万物找回了它最本质的灵魂。”',
        },
      },
    ],
  },

  {
    id: 'nature',
    name: '自然之境 · 绿意生机',
    enName: 'Nature’s Breath',
    description: '深入荒野雨林、冷杉峡谷与冰川激流，感受大自然的呼吸与脉动。',
    ambientLightColor: 0x121a16,
    ambientIntensity: 0.9,
    spotlightColor: 0xebffea,
    spotlightIntensity: 3.4,
    wallColor: 0x101512,
    floorRoughness: 0.48,
    floorMetalness: 0.3,
    windStrength: 0.35,
    gravityStrength: 7.0,
    items: [
      {
        id: 'amazon-canopy',
        roomId: 'nature',
        title: 'Amazonian Canopy',
        year: '2026',
        location: 'Amazon Rainforest, Brazil',
        cameraInfo: 'Sony A1 · 16-35mm f/2.8 GM · 1/160s · ISO 400',
        preset: 'silkFabric',
        aspectRatio: 1.45,
        story: {
          subtitle: '晨光穿透百米雨林冠层，丁达尔金色光柱倾泻而下',
          paragraph1: '深入亚马逊原始流域清晨，密林上方升腾的湿热水汽在晨曦穿透时化作无数道神圣的金色光柱。数百万种生命在绿意中同时苏醒。',
          paragraph2: '真丝素绉缎轻盈的质地随展厅微风柔顺起伏，仿佛将整个热带雨林的潮湿微风带到了展厅。',
          quote: '“森林的呼吸，是地球最古老而顽强的心跳。”',
        },
      },
      {
        id: 'misty-pine',
        roomId: 'nature',
        title: 'Misty Pine Forest',
        year: '2025',
        location: 'Cascade Range, Oregon, USA',
        cameraInfo: 'Fujifilm GFX 100S · 32-64mm f/4 · 1/80s · ISO 200',
        preset: 'fineArtCanvas',
        aspectRatio: 1.4,
        story: {
          subtitle: '太平洋西北部古老红杉与冷杉峡谷间的流动云雾',
          paragraph1: '高耸入云的冷杉林静立于幽深山谷之中，太平洋吹来的水汽化为缭绕云雾，在针叶之间缓缓流淌。',
          paragraph2: '深邃的森林暗绿与油画布的粗粝质感完美契合，带来深沉厚重的庇护感。',
          quote: '“每一株古树，都是大地写给天空的长篇史诗。”',
        },
      },
      {
        id: 'emerald-rapids',
        roomId: 'nature',
        title: 'Emerald Rapids',
        year: '2024',
        location: 'Banff National Park, Alberta, Canada',
        cameraInfo: 'Nikon Z9 · 70-200mm f/2.8 VR S · 1/2000s · ISO 125',
        preset: 'photoPaper',
        aspectRatio: 1.5,
        story: {
          subtitle: '冰川融水化作翡翠色狂流，奔腾激越的生命力量',
          paragraph1: '班夫落基山脉冰川融化带来的矿物质使峡谷激流呈现出醉人的翡翠碧绿色。高速快门定格了激流撞击岩石时飞溅的晶莹水珠。',
          paragraph2: '高光相纸的微反光泽精准再现了水波的通透与水花的剔透质感，极具视觉冲击力。',
          quote: '“水奔流不息，以至柔克至刚，雕刻出大地的骨骼。”',
        },
      },
    ],
  },
];
