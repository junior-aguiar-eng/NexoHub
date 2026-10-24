type RenderPreview = (file: File, page: number, signal: AbortSignal) => Promise<string>;

/** Six decoded previews per file; a newer page aborts obsolete active work. */
export class PdfPreviewQueue {
  private file?: File;
  private cache = new Map<number, string>();
  private active?: { page: number; controller: AbortController; promise: Promise<string> };
  constructor(private readonly render: RenderPreview) {}
  cancel() {
    this.active?.controller.abort();
    this.active = undefined;
    this.file = undefined;
    this.cache.clear();
  }
  get cachedPages(): readonly number[] {
    return [...this.cache.keys()];
  }
  request(file: File, page: number): Promise<string> {
    if (this.file !== file) {
      this.cancel();
      this.file = file;
    }
    if (this.active?.page !== page) {
      this.active?.controller.abort();
      this.active = undefined;
    }
    const cached = this.cache.get(page);
    if (cached) {
      this.cache.delete(page);
      this.cache.set(page, cached);
      return Promise.resolve(cached);
    }
    if (this.active) return this.active.promise;
    const controller = new AbortController();
    const { signal } = controller;
    const pending = Promise.resolve()
      .then(() => {
        if (signal.aborted) return "";
        return this.render(file, page, signal);
      })
      .then(
        (value) => {
          if (signal.aborted) return "";
          if (value) {
            this.cache.set(page, value);
            if (this.cache.size > 6) {
              const oldest = this.cache.keys().next().value;
              if (oldest !== undefined) this.cache.delete(oldest);
            }
          }
          if (!value && this.active?.controller === controller) this.active = undefined;
          return value;
        },
        (error: unknown) => {
          if (signal.aborted) return "";
          if (this.active?.controller === controller) this.active = undefined;
          throw error;
        },
      );
    this.active = { page, controller, promise: pending };
    return pending;
  }
}
