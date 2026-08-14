import { RoomConfig } from '../gallery/GalleryManifest';

export interface HUDCallbacks {
  onRoomSelect: (roomIndex: number) => void;
  onPhotoPrevious: () => void;
  onPhotoNext: () => void;
  onReset: () => void;
  onWindChange: (val: number) => void;
  onGravityChange: (val: number) => void;
  onUploadFiles: (files: File[]) => void;
}

export class HUD {
  readonly element: HTMLElement;
  private readonly roomTabsContainer: HTMLElement;
  private readonly photoCounter: HTMLElement;
  private readonly prevPhotoBtn: HTMLButtonElement;
  private readonly nextPhotoBtn: HTMLButtonElement;
  private readonly roomDescEl: HTMLElement;
  private readonly windInput: HTMLInputElement;
  private readonly windValue: HTMLElement;
  private readonly gravityInput: HTMLInputElement;
  private readonly gravityValue: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly statusEl: HTMLElement;
  private readonly errorEl: HTMLElement;

  constructor(
    rooms: RoomConfig[],
    callbacks: HUDCallbacks,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'hud-container';
    this.element.innerHTML = `
      <header class="hud-header">
        <div class="brand">
          <span class="eyebrow">WEBGPU / XPBD PHYSICS</span>
          <h1 class="brand-title">Spatial Memory Gallery</h1>
        </div>

        <nav class="room-nav" id="roomTabs"></nav>

        <div class="hud-quick-actions">
          <label class="file-button">
            <input
              id="hudImageInput"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              multiple
            />
            <span>+ 添加作品</span>
          </label>
          <button id="hudResetBtn" class="action-btn" type="button" title="复位当前照片形变">复位 (R)</button>
        </div>
      </header>

      <div class="hud-center-desc" id="roomDesc"></div>

      <footer class="hud-footer">
        <div class="hud-nav-bar">
          <button id="hudPrevBtn" class="nav-arrow-btn" type="button" aria-label="上一张">
            <span>←</span>
          </button>
          <span id="hudCounter" class="nav-counter">1 / 3</span>
          <button id="hudNextBtn" class="nav-arrow-btn" type="button" aria-label="下一张">
            <span>→</span>
          </button>
        </div>

        <div class="hud-physics-controls">
          <label class="range-control">
            <span class="range-heading">
              <span>空间气流</span>
              <output id="hudWindVal">0.12</output>
            </span>
            <input id="hudWindInput" type="range" min="0" max="3" step="0.05" value="0.12" />
          </label>

          <label class="range-control">
            <span class="range-heading">
              <span>重力刚度</span>
              <output id="hudGravityVal">7.8</output>
            </span>
            <input id="hudGravityInput" type="range" min="1" max="14" step="0.2" value="7.8" />
          </label>
        </div>

        <div class="hud-hint" id="hudHint">
          <span>拖拽布料真实形变</span> · <span>轻点进入聚焦模式</span> · <span>光标靠近产生微气流</span>
        </div>
      </footer>

      <div id="hudStatus" class="hud-status" role="status">已就绪</div>
      <div id="hudError" class="hud-error" role="alert" hidden></div>
    `;

    this.roomTabsContainer = this.element.querySelector('#roomTabs')!;
    this.photoCounter = this.element.querySelector('#hudCounter')!;
    this.prevPhotoBtn = this.element.querySelector('#hudPrevBtn')!;
    this.nextPhotoBtn = this.element.querySelector('#hudNextBtn')!;
    this.roomDescEl = this.element.querySelector('#roomDesc')!;
    this.windInput = this.element.querySelector('#hudWindInput')!;
    this.windValue = this.element.querySelector('#hudWindVal')!;
    this.gravityInput = this.element.querySelector('#hudGravityInput')!;
    this.gravityValue = this.element.querySelector('#hudGravityVal')!;
    this.fileInput = this.element.querySelector('#hudImageInput')!;
    this.resetBtn = this.element.querySelector('#hudResetBtn')!;
    this.statusEl = this.element.querySelector('#hudStatus')!;
    this.errorEl = this.element.querySelector('#hudError')!;

    // Populate room tabs
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const tab = document.createElement('button');
      tab.className = `room-tab ${i === 0 ? 'is-active' : ''}`;
      tab.type = 'button';
      tab.innerHTML = `
        <span class="room-tab-idx">0${i + 1}</span>
        <span class="room-tab-name">${room.name.split('·')[0].trim()}</span>
      `;
      tab.addEventListener('click', () => callbacks.onRoomSelect(i));
      this.roomTabsContainer.appendChild(tab);
    }

    this.prevPhotoBtn.addEventListener('click', () => callbacks.onPhotoPrevious());
    this.nextPhotoBtn.addEventListener('click', () => callbacks.onPhotoNext());
    this.resetBtn.addEventListener('click', () => callbacks.onReset());

    this.windInput.addEventListener('input', () => {
      const val = Number(this.windInput.value);
      this.windValue.textContent = val.toFixed(2);
      callbacks.onWindChange(val);
    });

    this.gravityInput.addEventListener('input', () => {
      const val = Number(this.gravityInput.value);
      this.gravityValue.textContent = val.toFixed(1);
      callbacks.onGravityChange(val);
    });

    this.fileInput.addEventListener('change', () => {
      const files = Array.from(this.fileInput.files ?? []);
      this.fileInput.value = '';
      if (files.length > 0) {
        callbacks.onUploadFiles(files);
      }
    });
  }

  updateState(roomIndex: number, photoIndex: number, totalPhotos: number, roomConfig: RoomConfig): void {
    const tabs = this.roomTabsContainer.querySelectorAll('.room-tab');
    tabs.forEach((tab, idx) => {
      tab.classList.toggle('is-active', idx === roomIndex);
    });

    this.photoCounter.textContent = `${photoIndex + 1} / ${totalPhotos}`;
    this.prevPhotoBtn.disabled = photoIndex <= 0;
    this.nextPhotoBtn.disabled = photoIndex >= totalPhotos - 1;

    this.roomDescEl.textContent = `${roomConfig.enName} · ${roomConfig.description}`;
  }

  setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  setError(msg: string | null): void {
    this.errorEl.hidden = !msg;
    this.errorEl.textContent = msg ?? '';
  }

  setFocusMode(isFocus: boolean): void {
    this.element.classList.toggle('is-focus-mode', isFocus);
  }

  dispose(): void {
    this.element.remove();
  }
}
