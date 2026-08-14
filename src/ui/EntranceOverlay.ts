export interface EntranceCallbacks {
  onEnter: () => void;
}

export class EntranceOverlay {
  readonly element: HTMLElement;
  private isEntering = false;

  constructor(callbacks: EntranceCallbacks) {
    this.element = document.createElement('div');
    this.element.className = 'entrance-overlay';
    this.element.innerHTML = `
      <div class="entrance-content">
        <div class="entrance-eyebrow">WEBGPU · XPBD PHYSICAL EXHIBITION</div>
        <h1 class="entrance-title">Spatial Memory Gallery</h1>
        <div class="entrance-subtitle">空间记忆画廊 · 一场由物理驱动的空间叙事之旅</div>
        
        <div class="entrance-door-frame">
          <div class="entrance-slit"></div>
        </div>

        <p class="entrance-description">
          照片像真实纸张与织物般悬挂。靠近受微风吹拂，拖拽泛起褶皱，轻触开启沉浸式回忆。
        </p>

        <button type="button" class="entrance-button" id="enterGalleryButton">
          <span class="button-glow"></span>
          <span class="button-text">推门进入展厅 · Enter Gallery</span>
        </button>
      </div>
    `;

    const enterBtn = this.element.querySelector<HTMLButtonElement>('#enterGalleryButton')!;
    enterBtn.addEventListener('click', () => {
      if (this.isEntering) return;
      this.isEntering = true;
      this.element.classList.add('is-opening');
      setTimeout(() => {
        callbacks.onEnter();
      }, 400);
      setTimeout(() => {
        this.element.classList.add('is-hidden');
      }, 1200);
    });
  }

  hideImmediately(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
