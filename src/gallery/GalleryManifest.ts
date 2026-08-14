import * as THREE from 'three/webgpu';
import { GalleryItemData } from './GalleryItem';

export type RoomLayoutType =
  | 'circular'
  | 'semicircle'
  | 'angled-vista'
  | 'staggered'
  | 'linear'
  | 'central-sculpture'
  | 'studio-grid'
  | 'archive-matrix';

export interface RoomConfig {
  id: string;
  name: string;
  enName: string;
  quote: string;
  description: string;
  layoutType: RoomLayoutType;
  gridRow: number; // 0 = upper floor, 1 = lower floor
  gridCol: number; // 0, 1, 2, 3
  ambientLightColor: number;
  ambientIntensity: number;
  spotlightColor: number;
  spotlightIntensity: number;
  wallColor: number;
  windStrength: number;
  gravityStrength: number;
  items: GalleryItemData[];
}

// Generate procedural museum-grade art textures with film grain, atmospheric gradients, and lighting
export function createArtworkTexture(item: GalleryItemData): THREE.Texture {
  const width = 1600;
  const height = Math.round(width / (item.aspectRatio > 0 ? item.aspectRatio : 1.5));
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
    // 1. Travel Room
    case 'golden-peak': {
      grad.addColorStop(0, '#101726');
      grad.addColorStop(0.35, '#28364d');
      grad.addColorStop(0.65, '#e09853');
      grad.addColorStop(0.85, '#e8b87d');
      grad.addColorStop(1, '#664c38');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.55, 50, w * 0.5, h * 0.55, w * 0.6);
      glow.addColorStop(0, 'rgba(255, 220, 150, 0.45)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

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
      break;
    }

    case 'solitude-mist': {
      grad.addColorStop(0, '#0c151c');
      grad.addColorStop(0.4, '#1b2d38');
      grad.addColorStop(0.7, '#425866');
      grad.addColorStop(1, '#1e2b33');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const waterGrad = ctx.createLinearGradient(0, h * 0.65, 0, h);
      waterGrad.addColorStop(0, '#2d3e47');
      waterGrad.addColorStop(1, '#080d12');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, h * 0.65, w, h * 0.35);

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
      break;
    }

    case 'dawn-monolith': {
      grad.addColorStop(0, '#0b0c14');
      grad.addColorStop(0.3, '#1c1b2b');
      grad.addColorStop(0.65, '#bd634e');
      grad.addColorStop(0.8, '#d49b6a');
      grad.addColorStop(1, '#141417');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#0a0a0f';
      ctx.beginPath();
      ctx.moveTo(w * 0.55, h * 0.72);
      ctx.lineTo(w * 0.58, h * 0.48);
      ctx.lineTo(w * 0.62, h * 0.46);
      ctx.lineTo(w * 0.66, h * 0.72);
      ctx.fill();
      break;
    }

    // 2. Portrait Room
    case 'portrait-elder': {
      grad.addColorStop(0, '#0d0d10');
      grad.addColorStop(0.6, '#1a181e');
      grad.addColorStop(1, '#120f14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const light = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.4, w * 0.45);
      light.addColorStop(0, 'rgba(255, 230, 200, 0.85)');
      light.addColorStop(0.3, 'rgba(180, 130, 100, 0.4)');
      light.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#1e1c22';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.45, w * 0.18, h * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'portrait-child': {
      grad.addColorStop(0, '#12141a');
      grad.addColorStop(0.5, '#1e2330');
      grad.addColorStop(1, '#141720');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const light = ctx.createRadialGradient(w * 0.48, h * 0.42, 20, w * 0.48, h * 0.42, w * 0.4);
      light.addColorStop(0, 'rgba(255, 240, 220, 0.9)');
      light.addColorStop(0.35, 'rgba(120, 160, 200, 0.3)');
      light.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'portrait-gaze': {
      grad.addColorStop(0, '#0a0a0c');
      grad.addColorStop(0.7, '#1f1c22');
      grad.addColorStop(1, '#0e0d10');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const light = ctx.createLinearGradient(0, 0, w, h);
      light.addColorStop(0, 'rgba(255, 210, 160, 0.6)');
      light.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    // 3. Memory Room
    case 'memory-relic': {
      grad.addColorStop(0, '#1a1410');
      grad.addColorStop(0.5, '#3d2b1c');
      grad.addColorStop(0.8, '#8c5d33');
      grad.addColorStop(1, '#1a120c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const halo = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.45);
      halo.addColorStop(0, 'rgba(255, 215, 120, 0.85)');
      halo.addColorStop(0.5, 'rgba(200, 130, 60, 0.3)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'memory-hourglass': {
      grad.addColorStop(0, '#100e14');
      grad.addColorStop(0.5, '#29202f');
      grad.addColorStop(0.8, '#69435b');
      grad.addColorStop(1, '#151119');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    // 4. Nature Room
    case 'amazon-canopy': {
      grad.addColorStop(0, '#0a1710');
      grad.addColorStop(0.4, '#142e20');
      grad.addColorStop(0.7, '#234a34');
      grad.addColorStop(1, '#0e1c14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

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
      break;
    }

    case 'misty-pine': {
      grad.addColorStop(0, '#101c18');
      grad.addColorStop(0.5, '#223830');
      grad.addColorStop(0.75, '#4a6b5e');
      grad.addColorStop(1, '#1b2923');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    // 5. Urban Room
    case 'urban-skyline': {
      grad.addColorStop(0, '#080c16');
      grad.addColorStop(0.5, '#121f33');
      grad.addColorStop(0.8, '#3d304a');
      grad.addColorStop(1, '#0c0e14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Distant city lights
      ctx.fillStyle = '#060a12';
      for (let i = 0; i < 12; i++) {
        const bh = h * (0.3 + (i % 5) * 0.1);
        ctx.fillRect(w * (i * 0.08 + 0.02), h - bh, w * 0.07, bh);
      }
      break;
    }

    case 'urban-transit': {
      grad.addColorStop(0, '#0a0a0f');
      grad.addColorStop(0.5, '#1e1424');
      grad.addColorStop(0.85, '#a6543b');
      grad.addColorStop(1, '#120d14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    // 6. Abstract Room
    case 'abstract-flow': {
      grad.addColorStop(0, '#120d1c');
      grad.addColorStop(0.3, '#351842');
      grad.addColorStop(0.6, '#753b68');
      grad.addColorStop(0.85, '#d48a74');
      grad.addColorStop(1, '#1a101f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const swirl = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, w * 0.4);
      swirl.addColorStop(0, 'rgba(255, 210, 160, 0.9)');
      swirl.addColorStop(0.4, 'rgba(180, 80, 140, 0.4)');
      swirl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = swirl;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    // 7. Creation Lab
    case 'creation-blueprint': {
      grad.addColorStop(0, '#0c1524');
      grad.addColorStop(0.5, '#14253d');
      grad.addColorStop(1, '#0e1828');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      break;
    }

    // 8. Archive Room
    case 'archive-scroll': {
      grad.addColorStop(0, '#181410');
      grad.addColorStop(0.5, '#2e241c');
      grad.addColorStop(1, '#1a1512');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const parchment = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, h);
      parchment.addColorStop(0, 'rgba(235, 210, 170, 0.4)');
      parchment.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = parchment;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    default: {
      grad.addColorStop(0, '#1c1b26');
      grad.addColorStop(0.5, '#2b2938');
      grad.addColorStop(1, '#14131c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
}

function addPhotoAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.42, w * 0.5, h * 0.5, Math.max(w, h) * 0.76);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);
}

export const GALLERY_ROOMS: RoomConfig[] = [
  // Upper Floor (gridRow: 0)
  {
    id: 'travel',
    name: '旅行记忆室',
    enName: 'Travel Room',
    quote: '远方的风景，记忆的坐标。每一次旅行，都是生命的拓展。',
    description: '双层错落透视长廊，雪山、峡谷与海岸，随微风飘拂。',
    layoutType: 'angled-vista',
    gridRow: 0,
    gridCol: 0,
    ambientLightColor: 0x1a1820,
    ambientIntensity: 0.9,
    spotlightColor: 0xffeed6,
    spotlightIntensity: 3.4,
    wallColor: 0x141419,
    windStrength: 0.22,
    gravityStrength: 7.6,
    items: [
      {
        id: 'golden-peak',
        roomId: 'travel',
        title: 'The Golden Peak',
        year: '2026',
        location: 'Matterhorn, Switzerland',
        cameraInfo: 'Hasselblad H6D-100c · 100mm f/4 · 1/250s',
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
        roomId: 'travel',
        title: 'Solitude in Mist',
        year: '2025',
        location: 'Geiranger Fjord, Norway',
        cameraInfo: 'Leica SL2 · 50mm f/1.4 · 1/60s',
        preset: 'fineArtCanvas',
        aspectRatio: 1.45,
        story: {
          subtitle: '幽蓝峡湾与凝固的晨雾，孤独是最高贵的自省',
          paragraph1: '盖朗厄尔峡湾的清晨被一层浓密而轻柔的水汽笼罩，深黛色的悬崖倒映在如镜水面上，分不清哪里是天空，哪里是深渊。',
          paragraph2: '艺术油画布质感使微弱水汽与冷灰蓝调呈现出如古典油画般的深邃质感与沉稳呼吸。',
          quote: '“在无声的静止中，我们听见世界最原始的律动。”',
        },
      },
      {
        id: 'dawn-monolith',
        roomId: 'travel',
        title: 'Dawn of the Monolith',
        year: '2024',
        location: 'Reynisfjara, Iceland',
        cameraInfo: 'Sony A7R V · 24-70mm f/2.8 · 1/125s',
        preset: 'agedPaper',
        aspectRatio: 1.4,
        story: {
          subtitle: '黑沙滩上海浪与玄武岩巨石的亘古对峙',
          paragraph1: '大西洋狂烈的巨浪日夜拍击着雷尼斯黑沙滩，火山岩风化成的纯黑沙粒在破晓的暗红天光下泛着金属般的冷光。',
          quote: '“浪潮退去，唯有岩石记录着永恒。”',
        },
      },
    ],
  },

  {
    id: 'portrait',
    name: '人物记忆室',
    enName: 'Portrait Room',
    quote: '面孔，情感，关系与陪伴。构成了我们记忆中最温暖的拼图。',
    description: '360° 环形光柱悬挂布局，人物特写在中央光芒中环绕注视。',
    layoutType: 'circular',
    gridRow: 0,
    gridCol: 1,
    ambientLightColor: 0x1c171a,
    ambientIntensity: 0.95,
    spotlightColor: 0xffdfc4,
    spotlightIntensity: 3.8,
    wallColor: 0x161215,
    windStrength: 0.12,
    gravityStrength: 8.0,
    items: [
      {
        id: 'portrait-elder',
        roomId: 'portrait',
        title: 'Wisdom of Centuries',
        year: '2026',
        location: 'Kyoto, Japan',
        cameraInfo: 'Fujifilm GFX 100 II · 110mm f/2 · 1/125s',
        preset: 'agedPaper',
        aspectRatio: 1.35,
        story: {
          subtitle: '岁月刻画的皱纹里，流淌着沉静如水的故事',
          paragraph1: '百岁老茶师在和室暗光下静坐，深邃的眼神凝视着茶汤的微澜。光线勾勒出面庞每一道沧桑的肌理。',
          quote: '“容颜会老去，但眼中的清澈可越千山。”',
        },
      },
      {
        id: 'portrait-child',
        roomId: 'portrait',
        title: 'Wonder in the Eyes',
        year: '2025',
        location: 'Reykjavik, Iceland',
        cameraInfo: 'Canon EOS R5 · 85mm f/1.2L · 1/320s',
        preset: 'photoPaper',
        aspectRatio: 1.38,
        story: {
          subtitle: '纯真眼眸中倒映的初雪与世界',
          paragraph1: '孩子抬头望向天空中纷飞的第一场初雪，清澈见底的瞳孔里写满了对未知世界最原始的惊叹与喜悦。',
          quote: '“好奇心，是灵魂最明亮的光芒。”',
        },
      },
      {
        id: 'portrait-gaze',
        roomId: 'portrait',
        title: 'The Silent Gaze',
        year: '2024',
        location: 'Paris, France',
        cameraInfo: 'Leica M11 · 50mm f/1.4 · 1/160s',
        preset: 'silkFabric',
        aspectRatio: 1.4,
        story: {
          subtitle: '塞纳河畔黄昏微光下的凝视',
          paragraph1: '剧院散场后的长椅上，年轻演员独自伫立，夕阳给侧脸镀上一层柔和的金辉。',
          quote: '“每一次静默的对视，都是心灵无声的相逢。”',
        },
      },
    ],
  },

  {
    id: 'memory',
    name: '记忆核心馆',
    enName: 'Memory Sanctuary',
    quote: '记忆的碎片，空间的重构。在这里，时间变得可触摸。',
    description: '半环形殿堂神坛布局，金色光晕圆台烘托出庄严殿堂氛围。',
    layoutType: 'semicircle',
    gridRow: 0,
    gridCol: 2,
    ambientLightColor: 0x1f1a14,
    ambientIntensity: 1.0,
    spotlightColor: 0xffe6a8,
    spotlightIntensity: 4.2,
    wallColor: 0x17130e,
    windStrength: 0.15,
    gravityStrength: 7.5,
    items: [
      {
        id: 'memory-relic',
        roomId: 'memory',
        title: 'The Timeless Relic',
        year: '2026',
        location: 'Sanctuary Core',
        cameraInfo: 'Master Archive · Quantum Film · ISO 50',
        preset: 'agedPaper',
        aspectRatio: 1.45,
        story: {
          subtitle: '穿透时光尘埃的文明遗迹，永恒的回声',
          paragraph1: '悬浮在神殿中央的核心遗存，凝聚了千百年来人类记忆与思索的结晶，在金色光晕中散发神圣微光。',
          quote: '“时间带走一切，却将记忆铸成了不朽。”',
        },
      },
      {
        id: 'memory-hourglass',
        roomId: 'memory',
        title: 'Flow of Time',
        year: '2025',
        location: 'Sanctuary Chamber',
        cameraInfo: 'Hasselblad 907X · 45mm · 1/500s',
        preset: 'fineArtCanvas',
        aspectRatio: 1.42,
        story: {
          subtitle: '沙漏落下的每一粒沙，都是宇宙呼吸的一瞬',
          paragraph1: '光与暗交替流转，如同时间的河流奔涌不息。在此处，所有纷扰归于平静。',
          quote: '“活在当下，当下即是永恒。”',
        },
      },
    ],
  },

  {
    id: 'nature',
    name: '自然之境',
    enName: 'Nature Realm',
    quote: '回归自然，聆听大地的声音。记忆与自然共生共鸣。',
    description: '林间有机错落分布，晨曦丁达尔光束穿透冠层。',
    layoutType: 'staggered',
    gridRow: 0,
    gridCol: 3,
    ambientLightColor: 0x121a14,
    ambientIntensity: 0.9,
    spotlightColor: 0xebffea,
    spotlightIntensity: 3.5,
    wallColor: 0x0f1612,
    windStrength: 0.32,
    gravityStrength: 7.0,
    items: [
      {
        id: 'amazon-canopy',
        roomId: 'nature',
        title: 'Amazonian Canopy',
        year: '2026',
        location: 'Amazon, Brazil',
        cameraInfo: 'Sony A1 · 16-35mm f/2.8 · 1/160s',
        preset: 'silkFabric',
        aspectRatio: 1.45,
        story: {
          subtitle: '晨光穿透百米雨林冠层，金色光柱倾泻而下',
          paragraph1: '热带雨林湿润的水汽在晨曦穿透时化作神圣的光柱，数百万种生命在绿意中同时苏醒。',
          quote: '“森林的呼吸，是地球最古老而顽强的心跳。”',
        },
      },
      {
        id: 'misty-pine',
        roomId: 'nature',
        title: 'Misty Pine Forest',
        year: '2025',
        location: 'Cascade Range, Oregon',
        cameraInfo: 'Fujifilm GFX 100S · 32-64mm f/4 · 1/80s',
        preset: 'fineArtCanvas',
        aspectRatio: 1.4,
        story: {
          subtitle: '太平洋西北部古老冷杉峡谷间的流动云雾',
          paragraph1: '高耸入云的冷杉林静立于幽深山谷之中，海风吹来的水汽在针叶之间缓缓流淌。',
          quote: '“每一株古树，都是大地写给天空的长篇史诗。”',
        },
      },
    ],
  },

  // Lower Floor (gridRow: 1)
  {
    id: 'urban',
    name: '城市印象馆',
    enName: 'Urban Echo',
    quote: '城市是记忆的容器。每一条街道，都藏着故事的回声。',
    description: '深邃天际线画廊布局，钢铁导轨与霓虹光影交相辉映。',
    layoutType: 'linear',
    gridRow: 1,
    gridCol: 0,
    ambientLightColor: 0x121622,
    ambientIntensity: 0.85,
    spotlightColor: 0xd8e8ff,
    spotlightIntensity: 3.6,
    wallColor: 0x0f131a,
    windStrength: 0.16,
    gravityStrength: 8.2,
    items: [
      {
        id: 'urban-skyline',
        roomId: 'urban',
        title: 'Metropolis at Midnight',
        year: '2026',
        location: 'Tokyo, Japan',
        cameraInfo: 'Nikon Z9 · 50mm f/1.2 · 1/60s',
        preset: 'photoPaper',
        aspectRatio: 1.5,
        story: {
          subtitle: '数百万盏灯火织就的钢铁巨兽之夜',
          paragraph1: '站在摩天大楼顶端俯瞰，纵横交错的高速路如同奔流的金色血管，城市在喧嚣与孤独中不眠。',
          quote: '“城市吞噬了星光，却自己点亮了银河。”',
        },
      },
      {
        id: 'urban-transit',
        roomId: 'urban',
        title: 'Speed of Light',
        year: '2025',
        location: 'New York, USA',
        cameraInfo: 'Sony A7R V · 24mm f/1.4 · 2s · ISO 100',
        preset: 'photoPaper',
        aspectRatio: 1.48,
        story: {
          subtitle: '长曝光下流动的地铁光轨与穿行的人潮',
          paragraph1: '地铁列车呼啸而过，留下炫目的橙红光轨，静止的乘客与飞驰的光线构成鲜明的存在对照。',
          quote: '“我们奔赴前程，却在轨迹中留下了时间的痕迹。”',
        },
      },
    ],
  },

  {
    id: 'abstract',
    name: '抽象表达馆',
    enName: 'Abstract Expression',
    quote: '超越具象，进入情感的深层。抽象是记忆最自由的形态。',
    description: '悬浮丝绸雕塑环抱布局，色彩与光晕自由流淌。',
    layoutType: 'central-sculpture',
    gridRow: 1,
    gridCol: 1,
    ambientLightColor: 0x1a121e,
    ambientIntensity: 0.9,
    spotlightColor: 0xf5d4ff,
    spotlightIntensity: 3.8,
    wallColor: 0x150f19,
    windStrength: 0.35,
    gravityStrength: 6.8,
    items: [
      {
        id: 'abstract-flow',
        roomId: 'abstract',
        title: 'Resonance of Soul',
        year: '2026',
        location: 'Inner Dimension',
        cameraInfo: 'Pure Consciousness · Spectral Light',
        preset: 'silkFabric',
        aspectRatio: 1.45,
        story: {
          subtitle: '色彩波动的狂欢，直击内心深处最纯粹的震颤',
          paragraph1: '摒弃了一切具象形态，紫红与金光的交织如同情感在夜空中的绚烂绽放，带来无拘无束的心灵共鸣。',
          quote: '“色彩是直接触摸灵魂的琴弓。”',
        },
      },
    ],
  },

  {
    id: 'creation',
    name: '创作工坊',
    enName: 'Creation Lab',
    quote: '记录，整理，创作，让记忆成为新的作品。',
    description: '工作台与策展看板布局，实时导入与排版您的独家记忆。',
    layoutType: 'studio-grid',
    gridRow: 1,
    gridCol: 2,
    ambientLightColor: 0x141a22,
    ambientIntensity: 0.92,
    spotlightColor: 0xfff0da,
    spotlightIntensity: 3.6,
    wallColor: 0x10151c,
    windStrength: 0.1,
    gravityStrength: 8.0,
    items: [
      {
        id: 'creation-blueprint',
        roomId: 'creation',
        title: 'Architect of Memories',
        year: '2026',
        location: 'Creative Studio',
        cameraInfo: 'Studio Workshop · Blueprint Grid',
        preset: 'fineArtCanvas',
        aspectRatio: 1.4,
        story: {
          subtitle: '构想、草图与成品的诞生之地',
          paragraph1: '在这里，灵感被精准捕捉并转化为空间的实体，每一位创作者都在书写属于自己的记忆篇章。',
          quote: '“创作，就是给流逝的时间赋予新的生命。”',
        },
      },
    ],
  },

  {
    id: 'archive',
    name: '记忆存档馆',
    enName: 'Memory Archive',
    quote: '所有记忆的归处。安全存储，随时回溯。',
    description: '展柜式网格矩阵布局，典藏每一刻珍贵时光。',
    layoutType: 'archive-matrix',
    gridRow: 1,
    gridCol: 3,
    ambientLightColor: 0x181512,
    ambientIntensity: 0.88,
    spotlightColor: 0xffeed6,
    spotlightIntensity: 3.5,
    wallColor: 0x14110e,
    windStrength: 0.08,
    gravityStrength: 8.5,
    items: [
      {
        id: 'archive-scroll',
        roomId: 'archive',
        title: 'The Great Chronicle',
        year: '2026',
        location: 'Central Vault',
        cameraInfo: 'Permanent Collection · Vault 01',
        preset: 'agedPaper',
        aspectRatio: 1.45,
        story: {
          subtitle: '封存百年光阴的记忆长卷，静候翻阅',
          paragraph1: '无论时光如何飞逝，被珍藏的记忆在此处永不磨灭，随时等待与未来的你再次重逢。',
          quote: '“被记住的时光，从未真正离去。”',
        },
      },
    ],
  },
];
