import { GalleryItemData } from '../gallery/GalleryItem';
import { getClothPreset } from '../physics/ClothPreset';

export interface FocusCallbacks {
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

export class FocusOverlay {
  readonly element: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly metaEl: HTMLElement;
  private readonly badgeEl: HTMLElement;
  private readonly cameraEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly quoteEl: HTMLElement;
  private readonly counterEl: HTMLElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;

  constructor(private readonly callbacks: FocusCallbacks) {
    this.element = document.createElement('div');
    this.element.className = 'focus-overlay';
    this.element.innerHTML = `
      <div class="focus-backdrop"></div>
      <div class="focus-panel">
        <header class="focus-header">
          <div class="focus-tags">
            <span class="focus-badge" id="focusMediaBadge">高级相纸</span>
            <span class="focus-camera" id="focusCameraInfo">Leica M11</span>
          </div>
          <h2 class="focus-title" id="focusTitle">The Golden Peak</h2>
          <div class="focus-meta" id="focusMeta">2026 · Switzerland</div>
        </header>

        <div class="focus-divider"></div>

        <div class="focus-story">
          <h3 class="focus-subtitle" id="focusSubtitle">晨光穿透流云的瞬间</h3>
          <div class="focus-body" id="focusBody"></div>
          <blockquote class="focus-quote" id="focusQuote"></blockquote>
        </div>

        <footer class="focus-footer">
          <div class="focus-nav">
            <button type="button" class="focus-nav-button" id="focusPrevBtn" aria-label="上一张">
              <span>←</span>
            </button>
            <span class="focus-counter" id="focusCounter">1 / 3</span>
            <button type="button" class="focus-nav-button" id="focusNextBtn" aria-label="下一张">
              <span>→</span>
            </button>
          </div>

          <button type="button" class="focus-close-button" id="focusCloseBtn">
            <span>返回展厅 · Back</span>
            <kbd>ESC</kbd>
          </button>
        </footer>
      </div>
    `;

    this.titleEl = this.element.querySelector('#focusTitle')!;
    this.metaEl = this.element.querySelector('#focusMeta')!;
    this.badgeEl = this.element.querySelector('#focusMediaBadge')!;
    this.cameraEl = this.element.querySelector('#focusCameraInfo')!;
    this.subtitleEl = this.element.querySelector('#focusSubtitle')!;
    this.bodyEl = this.element.querySelector('#focusBody')!;
    this.quoteEl = this.element.querySelector('#focusQuote')!;
    this.counterEl = this.element.querySelector('#focusCounter')!;
    this.prevBtn = this.element.querySelector('#focusPrevBtn')!;
    this.nextBtn = this.element.querySelector('#focusNextBtn')!;
    this.closeBtn = this.element.querySelector('#focusCloseBtn')!;

    this.prevBtn.addEventListener('click', () => callbacks.onPrevious());
    this.nextBtn.addEventListener('click', () => callbacks.onNext());
    this.closeBtn.addEventListener('click', () => callbacks.onClose());

    const backdrop = this.element.querySelector('.focus-backdrop')!;
    backdrop.addEventListener('click', () => callbacks.onClose());
  }

  show(item: GalleryItemData, currentIndex: number, totalCount: number): void {
    const preset = getClothPreset(item.preset);
    this.titleEl.textContent = item.title;
    this.metaEl.textContent = `${item.year} · ${item.location}`;
    this.badgeEl.textContent = preset.name;
    this.cameraEl.textContent = item.cameraInfo || 'Fine Art Photography';
    this.cameraEl.hidden = !item.cameraInfo;

    this.subtitleEl.textContent = item.story.subtitle;
    this.bodyEl.innerHTML = `
      <p>${item.story.paragraph1}</p>
      ${item.story.paragraph2 ? `<p>${item.story.paragraph2}</p>` : ''}
    `;

    if (item.story.quote) {
      this.quoteEl.textContent = item.story.quote;
      this.quoteEl.hidden = false;
    } else {
      this.quoteEl.hidden = true;
    }

    this.counterEl.textContent = `${currentIndex + 1} / ${totalCount}`;
    this.prevBtn.disabled = currentIndex <= 0;
    this.nextBtn.disabled = currentIndex >= totalCount - 1;

    this.element.classList.add('is-active');
  }

  hide(): void {
    this.element.classList.remove('is-active');
  }

  isActive(): boolean {
    return this.element.classList.contains('is-active');
  }

  dispose(): void {
    this.element.remove();
  }
}
