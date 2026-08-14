import { RoomConfig } from '../gallery/GalleryManifest';

export interface HUDCallbacks {
  onCorridorStep: (stationIndex: number) => void;
  onEnterDoor: (doorIndex: number) => void;
  onReturnToCorridor: () => void;
  onPhotoPrevious: () => void;
  onPhotoNext: () => void;
  onReset: () => void;
  onWindChange: (val: number) => void;
  onGravityChange: (val: number) => void;
  onUploadFiles: (files: File[]) => void;
}

export class HUD {
  readonly element: HTMLElement;
  private readonly corridorBar: HTMLElement;
  private readonly corridorStationTabs: HTMLElement;
  private readonly doorPromptPanel: HTMLElement;
  private readonly inRoomHeader: HTMLElement;
  private readonly inRoomFooter: HTMLElement;
  private readonly roomTitleEl: HTMLElement;
  private readonly roomQuoteEl: HTMLElement;
  private readonly photoCounter: HTMLElement;
  private readonly prevPhotoBtn: HTMLButtonElement;
  private readonly nextPhotoBtn: HTMLButtonElement;
  private readonly returnBtn: HTMLButtonElement;
  private readonly windInput: HTMLInputElement;
  private readonly windValue: HTMLElement;
  private readonly gravityInput: HTMLInputElement;
  private readonly gravityValue: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly statusEl: HTMLElement;
  private readonly errorEl: HTMLElement;

  private isCorridor = true;

  constructor(
    private readonly rooms: RoomConfig[],
    private readonly callbacks: HUDCallbacks,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'hud-container is-corridor-mode';
    this.element.innerHTML = `
      <!-- 1. Header -->
      <header class="hud-header">
        <div class="brand">
          <span class="eyebrow">数字记忆博物馆 · SPATIAL PROMENADE</span>
          <h1 class="brand-title">SPATIAL MEMORY GALLERY</h1>
        </div>

        <div class="in-room-nav" id="inRoomHeader">
          <button id="hudReturnBtn" class="return-corridor-btn" type="button">
            <span class="icon">←</span>
            <span>返回走廊 · Corridor</span>
          </button>
          <span class="room-active-title" id="roomActiveTitle">旅行记忆室</span>
        </div>

        <div class="hud-quick-actions">
          <label class="file-button">
            <input
              id="hudImageInput"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              multiple
            />
            <span>+ 创作作品</span>
          </label>
          <button id="hudResetBtn" class="action-btn" type="button" title="复位当前照片物理形变">复位 (R)</button>
        </div>
      </header>

      <!-- 2. Corridor Door Prompt Center Panel -->
      <div class="corridor-door-prompt" id="doorPromptPanel">
        <div class="door-prompt-card door-left" id="doorLeftCard">
          <span class="door-tag">LEFT CHAMBER</span>
          <h2 class="door-title" id="doorLeftTitle">旅行记忆室</h2>
          <p class="door-quote" id="doorLeftQuote">远方的风景，记忆的坐标。</p>
          <button class="door-enter-btn" id="doorLeftBtn" type="button">
            <span>推门进入 · ENTER</span>
          </button>
        </div>

        <div class="door-prompt-divider"></div>

        <div class="door-prompt-card door-right" id="doorRightCard">
          <span class="door-tag">RIGHT CHAMBER</span>
          <h2 class="door-title" id="doorRightTitle">人物记忆室</h2>
          <p class="door-quote" id="doorRightQuote">面孔，情感，关系与陪伴。</p>
          <button class="door-enter-btn" id="doorRightBtn" type="button">
            <span>推门进入 · ENTER</span>
          </button>
        </div>
      </div>

      <!-- In-room Quote -->
      <div class="hud-center-quote" id="roomQuote" hidden></div>

      <!-- 3. Footer -->
      <footer class="hud-footer">
        <!-- Corridor Walk Navigation -->
        <div class="corridor-walk-bar" id="corridorBar">
          <button class="corridor-step-btn" id="corridorPrevBtn" type="button" title="向后退一步 (S / ↓)">
            <span>▼ 向后退</span>
          </button>
          <div class="station-dots" id="corridorStationTabs"></div>
          <button class="corridor-step-btn" id="corridorNextBtn" type="button" title="向前走一步 (W / ↑)">
            <span>▲ 向前走</span>
          </button>
        </div>

        <!-- In-Room Controls -->
        <div class="in-room-controls" id="inRoomFooter">
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
                <span>微气流</span>
                <output id="hudWindVal">0.12</output>
              </span>
              <input id="hudWindInput" type="range" min="0" max="2.5" step="0.05" value="0.12" />
            </label>

            <label class="range-control">
              <span class="range-heading">
                <span>重力</span>
                <output id="hudGravityVal">7.8</output>
              </span>
              <input id="hudGravityInput" type="range" min="1" max="14" step="0.2" value="7.8" />
            </label>
          </div>
        </div>

        <div class="hud-hint" id="hudHint">
          <span>滚动滚轮或方向键漫步长廊</span> · <span>走近展厅门推门进入</span>
        </div>
      </footer>

      <div id="hudStatus" class="hud-status" role="status">已就绪</div>
      <div id="hudError" class="hud-error" role="alert" hidden></div>
    `;

    this.corridorBar = this.element.querySelector('#corridorBar')!;
    this.corridorStationTabs = this.element.querySelector('#corridorStationTabs')!;
    this.doorPromptPanel = this.element.querySelector('#doorPromptPanel')!;
    this.inRoomHeader = this.element.querySelector('#inRoomHeader')!;
    this.inRoomFooter = this.element.querySelector('#inRoomFooter')!;
    this.roomTitleEl = this.element.querySelector('#roomActiveTitle')!;
    this.roomQuoteEl = this.element.querySelector('#roomQuote')!;
    this.photoCounter = this.element.querySelector('#hudCounter')!;
    this.prevPhotoBtn = this.element.querySelector('#hudPrevBtn')!;
    this.nextPhotoBtn = this.element.querySelector('#hudNextBtn')!;
    this.returnBtn = this.element.querySelector('#hudReturnBtn')!;
    this.windInput = this.element.querySelector('#hudWindInput')!;
    this.windValue = this.element.querySelector('#hudWindVal')!;
    this.gravityInput = this.element.querySelector('#hudGravityInput')!;
    this.gravityValue = this.element.querySelector('#hudGravityVal')!;
    this.fileInput = this.element.querySelector('#hudImageInput')!;
    this.resetBtn = this.element.querySelector('#hudResetBtn')!;
    this.statusEl = this.element.querySelector('#hudStatus')!;
    this.errorEl = this.element.querySelector('#hudError')!;

    // Populate 4 Corridor Station dots
    const stationNames = ['01 旅行 / 人物', '02 记忆 / 自然', '03 城市 / 抽象', '04 工坊 / 存档'];
    for (let s = 0; s < 4; s++) {
      const dot = document.createElement('button');
      dot.className = `station-dot ${s === 0 ? 'is-active' : ''}`;
      dot.type = 'button';
      dot.innerHTML = `<span>节点 0${s + 1}</span><small>${stationNames[s]}</small>`;
      dot.addEventListener('click', () => callbacks.onCorridorStep(s));
      this.corridorStationTabs.appendChild(dot);
    }

    const corridorPrev = this.element.querySelector('#corridorPrevBtn')!;
    const corridorNext = this.element.querySelector('#corridorNextBtn')!;
    corridorPrev.addEventListener('click', () => callbacks.onCorridorStep(-1));
    corridorNext.addEventListener('click', () => callbacks.onCorridorStep(-2));

    this.returnBtn.addEventListener('click', () => callbacks.onReturnToCorridor());
    this.prevPhotoBtn.addEventListener('click', () => callbacks.onPhotoPrevious());
    this.nextPhotoBtn.addEventListener('click', () => callbacks.onPhotoNext());
    this.resetBtn.addEventListener('click', () => callbacks.onReset());

    const doorLeftBtn = this.element.querySelector('#doorLeftBtn')!;
    const doorRightBtn = this.element.querySelector('#doorRightBtn')!;
    doorLeftBtn.addEventListener('click', () => {
      const idx = Number(doorLeftBtn.getAttribute('data-door-idx') || 0);
      callbacks.onEnterDoor(idx);
    });
    doorRightBtn.addEventListener('click', () => {
      const idx = Number(doorRightBtn.getAttribute('data-door-idx') || 1);
      callbacks.onEnterDoor(idx);
    });

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

  updateCorridorStation(stationIndex: number): void {
    const dots = this.corridorStationTabs.querySelectorAll('.station-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx === stationIndex);
    });

    const leftIdx = stationIndex * 2;
    const rightIdx = stationIndex * 2 + 1;
    const leftRoom = this.rooms[leftIdx];
    const rightRoom = this.rooms[rightIdx];

    const leftTitle = this.element.querySelector('#doorLeftTitle')!;
    const leftQuote = this.element.querySelector('#doorLeftQuote')!;
    const leftBtn = this.element.querySelector('#doorLeftBtn')!;
    if (leftRoom) {
      leftTitle.textContent = leftRoom.name;
      leftQuote.textContent = leftRoom.quote;
      leftBtn.setAttribute('data-door-idx', String(leftIdx));
    }

    const rightTitle = this.element.querySelector('#doorRightTitle')!;
    const rightQuote = this.element.querySelector('#doorRightQuote')!;
    const rightBtn = this.element.querySelector('#doorRightBtn')!;
    if (rightRoom) {
      rightTitle.textContent = rightRoom.name;
      rightQuote.textContent = rightRoom.quote;
      rightBtn.setAttribute('data-door-idx', String(rightIdx));
    }
  }

  updateState(
    isCorridor: boolean,
    stationIndex: number,
    roomIndex: number,
    photoIndex: number,
    totalPhotos: number,
    roomConfig: RoomConfig,
  ): void {
    this.isCorridor = isCorridor;
    this.element.classList.toggle('is-corridor-mode', isCorridor);
    this.element.classList.toggle('is-room-mode', !isCorridor);

    if (isCorridor) {
      this.updateCorridorStation(stationIndex);
      this.doorPromptPanel.hidden = false;
      this.roomQuoteEl.hidden = true;
      const hint = this.element.querySelector('#hudHint')!;
      hint.innerHTML = '<span>滚动滚轮或方向键 (W/S) 漫步长廊</span> · <span>走近展厅大门推门进入</span>';
    } else {
      this.doorPromptPanel.hidden = true;
      this.roomQuoteEl.hidden = false;
      this.roomQuoteEl.textContent = roomConfig.quote;
      this.roomTitleEl.textContent = `${roomConfig.name} (${roomConfig.enName})`;
      this.photoCounter.textContent = `${photoIndex + 1} / ${totalPhotos}`;
      this.prevPhotoBtn.disabled = photoIndex <= 0;
      this.nextPhotoBtn.disabled = photoIndex >= totalPhotos - 1;
      const hint = this.element.querySelector('#hudHint')!;
      hint.innerHTML = '<span>W/S 或上下滚轮前后移动</span> · <span>左右键切换照片</span> · <span>空白处拖拽环视</span> · <span>点击左上方返回走廊</span>';
    }
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
