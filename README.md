# WebGPU XPBD Hanging Photo Cloth

一个可运行的 Vite + TypeScript + Three.js WebGPU 布料照片 Demo：

- `three/webgpu` / `WebGPURenderer`
- TSL Compute（WebGPU 后端生成 WGSL Compute Pipeline）
- 真 XPBD distance constraints
  - structural
  - shear
  - second-neighbor bend approximation
- GPU edge-color Gauss-Seidel，避免同一 dispatch 内多个约束并发写同一粒子
- GPU spatial hash 自碰撞
- GPU 动态法线重建
- `MeshPhysicalMaterial` PBR
- HDR (`RGBE`) environment lighting
- 两角固定，重力自然下垂
- 鼠标 / 触摸抓取局部粒子、拖拽、释放回摆
- 一次上传多张本地图片，按原宽高比横向挂起
- 按钮、方向键和触控板横向滚动切换图片

## 环境

Vite 8 需要 Node.js 20.19+ 或 22.12+。推荐 Node 22 LTS / 当前稳定版本。

## 运行

```bash
npm install
npm run dev
```

然后打开 Vite 输出的本地地址。

页面首次显示示例图。点击“添加图片”可一次选择多张 `PNG / JPEG / WebP / AVIF` 图片；首批本地图会替换示例图，之后继续追加，最多挂 12 张。单张文件不超过 30 MB、源图不超过约 3355 万像素，最终纹理最长边会限制为 2048 像素。

交互方式：

- 点击左右按钮，或聚焦画布后使用 `← / → / Home / End` 切换。
- 在画布上水平滚动触控板，一次手势切换一张。
- 按住当前照片拖拽并释放，按 `R` 或“复位当前”恢复当前布料。
- 风力、重力滑块会同时作用于已挂起的照片。

生产构建：

```bash
npm run build
npm run preview
```

不要直接双击 `index.html`，因为项目使用 ES modules、Vite 资源路径以及 HDR 文件加载。

## 文件结构

```text
src/
  main.ts
  cloth/
    ClothSimulation.ts
    constraints.ts
  interaction/
    ClothGrabber.ts
  gallery/
    HangingGallery.ts
  environment/
    loadStudioEnvironment.ts
public/
  photo.svg
  studio.hdr
```

## XPBD 实现说明

每个 fixed step：

1. Predict：速度加入重力/风力，预测粒子位置。
2. Constraint solve：按 edge color 顺序做 Gauss-Seidel XPBD。
3. Self collision：构建空间哈希并修正同层粒子穿透。
4. Pins / grab：重新固定两个挂点和当前抓取点。
5. Velocity update：由 `(x_new - x_old) / dt` 回算速度。
6. Normal rebuild：由四邻域切线叉乘重建法线。
7. MeshPhysicalMaterial + HDR/PBR 渲染。

核心 XPBD 约束为：

```text
alphaTilde = compliance / dt^2
C          = |xb - xa| - restLength
deltaLambda = (-C - alphaTilde * lambda) /
              (wA + wB + alphaTilde)
```

## 为什么使用 constraint edge coloring

一个普通 GPU compute dispatch 中，如果两个线程同时写同一个粒子位置，会发生 data race。此项目在 CPU 启动阶段对 distance constraints 做 greedy edge coloring：同一颜色的约束没有共享端点，因此可以安全并行写入；颜色之间顺序 dispatch，形成 GPU 版 Gauss-Seidel solver。

## “弯曲”精度

本项目的 bend 使用第二邻居 distance constraint，这是实时 Web 里非常实用的 XPBD bending approximation。它已经能得到自然布/薄相纸的弯曲与回摆。

如果追求影视级/工程级布料，可继续升级：

- dihedral-angle XPBD bending
- triangle-area constraints
- continuous collision detection
- cloth-object SDF collision
- anisotropic warp/weft compliance
- aerodynamic triangle forces
- WebGPU timestamp query + adaptive solver iterations

## 调参入口

`src/cloth/ClothSimulation.ts`：

```ts
structural: 2e-7,
shear: 1.5e-6,
bend: 4.5e-4,
solverIterations: 6,
```

更小 compliance = 更硬；更大 compliance = 更软。

画廊只让当前图片保持 60 Hz / 6 次求解，相邻图片以 30 Hz / 3 次求解运行，其余图片暂停模拟，以控制多图场景的 GPU 开销。
