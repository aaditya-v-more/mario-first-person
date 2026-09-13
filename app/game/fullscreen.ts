type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void | Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

export type FullscreenState = { active: boolean; supported: boolean; message: string };

// Fullscreen is requested only by UI gestures. Leaving it opts out of automatic
// entry for the rest of the page session; the toolbar can still re-enable it.
export class FullscreenSession {
  private automatic = true;
  private wasActive = false;
  private pending = false;
  private disposed = false;
  private message = '';

  constructor(
    private document: FullscreenDocument,
    private element: FullscreenElement,
    private changed: (state: FullscreenState) => void,
    private exited: () => void,
  ) {
    document.addEventListener('fullscreenchange', this.sync);
    document.addEventListener('webkitfullscreenchange', this.sync);
    this.sync();
  }

  get active() {
    return (this.document.fullscreenElement ?? this.document.webkitFullscreenElement) === this.element;
  }

  get supported() {
    return !!(
      (typeof this.element.requestFullscreen === 'function' && this.document.fullscreenEnabled !== false) ||
      (typeof this.element.webkitRequestFullscreen === 'function' && this.document.webkitFullscreenEnabled !== false)
    );
  }

  private emit() {
    if (!this.disposed) this.changed({ active: this.active, supported: this.supported, message: this.message });
  }

  private sync = () => {
    if (this.disposed) return;
    const active = this.active;
    if (this.wasActive && !active) {
      this.automatic = false;
      this.exited();
    }
    this.wasActive = active;
    this.emit();
  };

  async enter(automatic = false) {
    if (this.disposed || this.pending || (automatic && !this.automatic)) return;
    if (!automatic) this.automatic = true;
    if (this.active) return;
    if (!this.supported) {
      this.automatic = false;
      this.message = 'Fullscreen is unavailable here. You can play in this tab.';
      this.emit();
      return;
    }
    this.pending = true;
    this.message = '';
    try {
      // Called synchronously before the first await, while the click is active.
      if (typeof this.element.requestFullscreen === 'function' && this.document.fullscreenEnabled !== false)
        await this.element.requestFullscreen({ navigationUI: 'hide' });
      else await this.element.webkitRequestFullscreen?.();
      this.sync();
    } catch {
      this.automatic = false;
      this.message = 'Fullscreen could not open. You can keep playing in this tab.';
      this.emit();
    } finally {
      this.pending = false;
    }
  }

  async toggle() {
    if (!this.active) return this.enter();
    this.automatic = false;
    try {
      if (this.document.exitFullscreen) await this.document.exitFullscreen();
      else await this.document.webkitExitFullscreen?.();
    } catch {
      this.message = 'Use your browser’s fullscreen control to leave fullscreen.';
      this.emit();
    }
  }

  destroy() {
    this.disposed = true;
    this.document.removeEventListener('fullscreenchange', this.sync);
    this.document.removeEventListener('webkitfullscreenchange', this.sync);
  }
}
