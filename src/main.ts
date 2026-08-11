import * as THREE from 'three/webgpu';
import { HangingGallery } from './gallery/HangingGallery';
import { ClothGrabber } from './interaction/ClothGrabber';
import { loadStudioEnvironment } from './environment/loadStudioEnvironment';
import './style.css';

const status = document.querySelector<HTMLDivElement>('#status')!;
const errorBox = document.querySelector<HTMLDivElement>('#error')!;
const imageInput = document.querySelector<HTMLInputElement>('#imageInput')!;
const resetButton = document.querySelector<HTMLButtonElement>('#resetButton')!;
const previousButton = document.querySelector<HTMLButtonElement>('#previousButton')!;
const nextButton = document.querySelector<HTMLButtonElement>('#nextButton')!;
const galleryCounter = document.querySelector<HTMLOutputElement>('#galleryCounter')!;
const windInput = document.querySelector<HTMLInputElement>('#windInput')!;
const gravityInput = document.querySelector<HTMLInputElement>('#gravityInput')!;
const windValue = document.querySelector<HTMLOutputElement>('#windValue')!;
const gravityValue = document.querySelector<HTMLOutputElement>('#gravityValue')!;
const controls = document.querySelector<HTMLDivElement>('.controls')!;
const fileButton = imageInput.closest<HTMLLabelElement>('.file-button')!;
const brand = document.querySelector<HTMLDivElement>('.brand')!;
const hint = document.querySelector<HTMLDivElement>('.hint')!;
let disposeApplication: (() => void) | null = null;
let applicationCancelled = false;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    applicationCancelled = true;
    disposeApplication?.();
  });
}

function setError(message: string | null): void {
  errorBox.hidden = !message;
  errorBox.textContent = message ?? '';
}

function setUploadBusy(busy: boolean): void {
  imageInput.disabled = busy;
  fileButton.classList.toggle('is-disabled', busy);
  fileButton.setAttribute('aria-disabled', String(busy));
  controls.setAttribute('aria-busy', String(busy));
}

setUploadBusy(true);
resetButton.disabled = true;
windInput.disabled = true;
gravityInput.disabled = true;

async function start(): Promise<void> {
  // The solver uses arbitrary storage-buffer reads and writes; the WebGL
  // fallback renderer cannot execute these compute passes correctly.
  if (!window.isSecureContext) {
    throw new Error('WebGPU 需要安全上下文。请使用 localhost 或 HTTPS 地址打开本页面。');
  }
  if (!('gpu' in navigator)) {
    throw new Error('当前浏览器、系统或 GPU 未提供 WebGPU。请检查浏览器版本与硬件加速设置。');
  }

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  // Physics already dominates on integrated GPUs; 1.5 keeps the photo crisp
  // while avoiding a 4× retina render target on high-DPR displays.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'region');
  renderer.domElement.setAttribute('aria-label', '可交互的悬挂照片画廊，使用左右方向键切换图片');
  renderer.domElement.setAttribute('aria-describedby', 'interactionHint');
  document.querySelector('#app')!.appendChild(renderer.domElement);

  let startupCancelled = false;
  let rendererInitialized = false;
  let rendererDisposeRequested = false;
  let rendererDisposed = false;
  const completeRendererDispose = () => {
    if (rendererDisposed || !rendererInitialized) return;
    rendererDisposed = true;
    renderer.dispose();
  };
  const disposeRenderer = () => {
    rendererDisposeRequested = true;
    renderer.domElement.remove();
    completeRendererDispose();
  };
  disposeApplication = () => {
    applicationCancelled = true;
    startupCancelled = true;
    disposeRenderer();
  };

  let stopRuntimeAfterStartup: ((message: string) => void) | null = null;
  const defaultDeviceLost = renderer.onDeviceLost;
  renderer.onDeviceLost = (info) => {
    defaultDeviceLost.call(renderer, info);
    if (applicationCancelled) return;
    const message = `GPU 设备已断开：${info.message || info.reason || '未知原因'}。请刷新页面重新初始化。`;
    if (stopRuntimeAfterStartup) {
      stopRuntimeAfterStartup(message);
      return;
    }
    startupCancelled = true;
    status.textContent = 'GPU 运行已停止';
    setError(message);
    disposeApplication?.();
  };
  const defaultBackendError = renderer.onError;
  renderer.onError = ((info: unknown) => {
    (defaultBackendError as unknown as (value: unknown) => void).call(renderer, info);
    if (applicationCancelled) return;
    const details = typeof info === 'string'
      ? info
      : (info as { message?: string } | null)?.message ?? '未知 GPU 错误';
    setError(`GPU 报告错误：${details}`);
  }) as typeof renderer.onError;

  await renderer.init();
  rendererInitialized = true;
  if (startupCancelled || rendererDisposeRequested) {
    completeRendererDispose();
    return;
  }
  if ((renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend !== true) {
    throw new Error('WebGPU 初始化失败，已拒绝切换到不兼容的 WebGL2 后端。');
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0c);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 50);
  camera.position.set(0, -0.08, 7.35);
  camera.lookAt(0, -0.25, 0);

  let environment: THREE.DataTexture | null = null;
  try {
    environment = await loadStudioEnvironment(scene);
  } catch (error) {
    console.warn('HDR environment failed; continuing with direct lights.', error);
  }
  if (startupCancelled) {
    environment?.dispose();
    return;
  }

  const hemi = new THREE.HemisphereLight(0xf6eee1, 0x17181b, 0.9);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1dc, 3.35);
  key.position.set(-3.5, 5.0, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.00005;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  key.shadow.intensity = 0.42;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9cb7ff, 0.9);
  rim.position.set(4, 1.5, 2.5);
  scene.add(rim);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 9),
    new THREE.MeshPhysicalMaterial({
      color: 0x171719,
      roughness: 0.93,
      metalness: 0,
    }),
  );
  wall.position.z = -0.78;
  wall.receiveShadow = true;
  scene.add(wall);

  // A fixed rail makes the photo clips feel as if they slide along one shared
  // gallery track while each simulated mesh stays in its own local space.
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 12.4, 28),
    new THREE.MeshPhysicalMaterial({ color: 0x4b453b, metalness: 0.75, roughness: 0.32 }),
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 1.72, -0.01);
  rail.castShadow = true;
  scene.add(rail);

  let cancelCurrentGrab = () => {};
  let runtimeStopped = false;
  const gallery = new HangingGallery(scene, renderer, camera, {
    onStateChange: (state) => {
      if (startupCancelled || runtimeStopped) return;
      galleryCounter.value = state.total > 0 ? `${state.activeIndex + 1} / ${state.total}` : '0 / 0';
      galleryCounter.textContent = galleryCounter.value;
      previousButton.disabled = !state.canGoPrevious;
      nextButton.disabled = !state.canGoNext;
      resetButton.disabled = state.total === 0;
      renderer.domElement.setAttribute(
        'aria-label',
        state.total > 0
          ? `悬挂照片画廊，当前为第 ${state.activeIndex + 1} 张，共 ${state.total} 张，${state.label}`
          : '悬挂照片画廊',
      );
    },
    onStatus: (message) => {
      if (startupCancelled || runtimeStopped) return;
      status.textContent = message;
    },
    onError: (message) => {
      if (startupCancelled || runtimeStopped) return;
      setError(message);
    },
    onBeforeItemsReplace: () => cancelCurrentGrab(),
  });

  let sceneResourcesDisposed = false;
  const disposeSceneResources = () => {
    if (sceneResourcesDisposed) return;
    sceneResourcesDisposed = true;
    gallery.dispose();
    environment?.dispose();
    wall.geometry.dispose();
    wall.material.dispose();
    rail.geometry.dispose();
    rail.material.dispose();
  };
  disposeApplication = () => {
    applicationCancelled = true;
    startupCancelled = true;
    disposeSceneResources();
    disposeRenderer();
  };

  gallery.setWind(Number(windInput.value));
  gallery.setGravity(Number(gravityInput.value));
  try {
    await gallery.loadDefault(`${import.meta.env.BASE_URL}photo.svg`);
  } catch (error) {
    if (startupCancelled) return;
    console.warn('Default photo failed to load; continuing with an empty gallery.', error);
    galleryCounter.value = '0 / 0';
    galleryCounter.textContent = galleryCounter.value;
    resetButton.disabled = true;
    setError('示例图片加载失败，但仍可添加本地图片');
    status.textContent = '画廊已就绪，请添加本地图片';
  }
  if (startupCancelled) return;

  const grabber = new ClothGrabber(renderer.domElement, camera, () => gallery.getActiveTarget());
  cancelCurrentGrab = () => grabber.cancelGrab();
  const navigate = (action: () => boolean) => {
    if (startupCancelled || runtimeStopped) return;
    grabber.cancelGrab();
    action();
  };

  const onPrevious = () => navigate(() => gallery.previous());
  const onNext = () => navigate(() => gallery.next());
  const onReset = () => {
    if (startupCancelled || runtimeStopped) return;
    grabber.cancelGrab();
    gallery.resetActive();
  };
  const onWind = () => {
    if (startupCancelled || runtimeStopped) return;
    const value = Number(windInput.value);
    windValue.value = value.toFixed(2);
    windValue.textContent = windValue.value;
    gallery.setWind(value);
  };
  const onGravity = () => {
    if (startupCancelled || runtimeStopped) return;
    const value = Number(gravityInput.value);
    gravityValue.value = value.toFixed(1);
    gravityValue.textContent = gravityValue.value;
    gallery.setGravity(value);
  };
  const onImagesSelected = async () => {
    if (startupCancelled || runtimeStopped) return;
    const files = Array.from(imageInput.files ?? []);
    imageInput.value = '';
    if (files.length === 0) return;
    const restoreUploadFocus = document.activeElement === imageInput;
    setUploadBusy(true);
    status.textContent = `正在处理图片 0 / ${files.length}…`;
    try {
      grabber.cancelGrab();
      await gallery.addFiles(files);
    } catch (error) {
      if (!startupCancelled && !runtimeStopped) {
        console.error(error);
        setError(`添加图片失败：${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      if (!startupCancelled && !runtimeStopped) {
        setUploadBusy(false);
        const focusIsUnclaimed = document.activeElement === document.body
          || document.activeElement === document.documentElement;
        if (restoreUploadFocus && focusIsUnclaimed) imageInput.focus();
      }
    }
  };
  const onCanvasKeyDown = (event: KeyboardEvent) => {
    if (startupCancelled || runtimeStopped) return;
    let handled = true;
    if (event.key === 'ArrowLeft') onPrevious();
    else if (event.key === 'ArrowRight') onNext();
    else if (event.key === 'Home') navigate(() => gallery.first());
    else if (event.key === 'End') navigate(() => gallery.last());
    else if (event.key.toLowerCase() === 'r') onReset();
    else handled = false;
    if (handled) event.preventDefault();
  };

  let wheelAccumulator = 0;
  let wheelResetTimer = 0;
  let wheelLocked = false;
  const onCanvasWheel = (event: WheelEvent) => {
    if (startupCancelled || runtimeStopped) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => {
      wheelLocked = false;
      wheelAccumulator = 0;
    }, 220);
    if (wheelLocked) return;
    wheelAccumulator += event.deltaX;
    if (Math.abs(wheelAccumulator) < 48) return;
    if (wheelAccumulator > 0) onNext();
    else onPrevious();
    wheelAccumulator = 0;
    wheelLocked = true;
  };

  previousButton.addEventListener('click', onPrevious);
  nextButton.addEventListener('click', onNext);
  resetButton.addEventListener('click', onReset);
  windInput.addEventListener('input', onWind);
  gravityInput.addEventListener('input', onGravity);
  imageInput.addEventListener('change', onImagesSelected);
  renderer.domElement.addEventListener('keydown', onCanvasKeyDown);
  renderer.domElement.addEventListener('wheel', onCanvasWheel, { passive: false });

  setUploadBusy(false);
  windInput.disabled = false;
  gravityInput.disabled = false;
  onWind();
  onGravity();

  const stopRuntime = (message: string) => {
    if (runtimeStopped) return;
    runtimeStopped = true;
    renderer.setAnimationLoop(null);
    grabber.cancelGrab();
    imageInput.disabled = true;
    resetButton.disabled = true;
    previousButton.disabled = true;
    nextButton.disabled = true;
    windInput.disabled = true;
    gravityInput.disabled = true;
    fileButton.classList.add('is-disabled');
    fileButton.setAttribute('aria-disabled', 'true');
    controls.setAttribute('aria-busy', 'false');
    status.textContent = 'GPU 运行已停止';
    setError(message);
  };
  stopRuntimeAfterStartup = stopRuntime;

  const fixedDt = 1 / 60;
  const maxSubsteps = 3;
  let previousTime = performance.now() / 1000;
  let accumulator = 0;
  let simulationTime = 0;

  const renderFrame = (milliseconds: number) => {
    const now = milliseconds / 1000;
    const frameDt = Math.min(now - previousTime, 1 / 20);
    previousTime = now;
    accumulator += frameDt;

    let steps = 0;
    while (accumulator >= fixedDt && steps < maxSubsteps) {
      simulationTime += fixedDt;
      gallery.step(fixedDt, simulationTime);
      accumulator -= fixedDt;
      steps++;
    }
    // Never feed a large variable time step into XPBD after a browser hitch.
    // Three fixed steps catch a 50 ms clamped frame without runaway catch-up.
    if (steps === maxSubsteps) accumulator = Math.min(accumulator, fixedDt);

    gallery.updatePresentation(frameDt);
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop((milliseconds: number) => {
    if (runtimeStopped) return;
    try {
      renderFrame(milliseconds);
    } catch (error) {
      console.error(error);
      stopRuntime(`GPU 计算或渲染失败：${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const onResize = () => {
    if (startupCancelled || runtimeStopped) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const topInset = Math.max(brand.getBoundingClientRect().bottom, status.getBoundingClientRect().bottom) + 10;
    const controlsTop = controls.getBoundingClientRect().top;
    const hintRect = hint.getBoundingClientRect();
    const bottomContentTop = hintRect.height > 0 ? Math.min(controlsTop, hintRect.top) : controlsTop;
    gallery.handleResize({
      top: topInset,
      bottom: Math.max(0, window.innerHeight - bottomContentTop + 8),
    });
  };
  onResize();
  window.addEventListener('resize', onResize);
  const hudResizeObserver = new ResizeObserver(onResize);
  hudResizeObserver.observe(brand);
  hudResizeObserver.observe(status);
  hudResizeObserver.observe(hint);
  hudResizeObserver.observe(controls);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    applicationCancelled = true;
    runtimeStopped = true;
    stopRuntimeAfterStartup = null;
    renderer.setAnimationLoop(null);
    window.clearTimeout(wheelResetTimer);
    hudResizeObserver.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('beforeunload', cleanup);
    previousButton.removeEventListener('click', onPrevious);
    nextButton.removeEventListener('click', onNext);
    resetButton.removeEventListener('click', onReset);
    windInput.removeEventListener('input', onWind);
    gravityInput.removeEventListener('input', onGravity);
    imageInput.removeEventListener('change', onImagesSelected);
    renderer.domElement.removeEventListener('keydown', onCanvasKeyDown);
    renderer.domElement.removeEventListener('wheel', onCanvasWheel);
    grabber.dispose();
    disposeSceneResources();
    disposeRenderer();
    disposeApplication = null;
  };
  window.addEventListener('beforeunload', cleanup);
  disposeApplication = cleanup;
}

start().catch((error: unknown) => {
  if (applicationCancelled) return;
  console.error(error);
  disposeApplication?.();
  disposeApplication = null;
  setError(`启动失败：${error instanceof Error ? error.message : String(error)}`);
  status.textContent = '初始化失败';
});
