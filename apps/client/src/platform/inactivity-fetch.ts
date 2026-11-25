/** O prazo mede ausência de atividade; cada bloco recebido renova a janela. */
export function createInactivityFetch(fetcher: typeof fetch, inactivityMs = 60_000): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const parentSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(parentSignal?.reason);
    if (parentSignal?.aborted) abort();
    parentSignal?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout>;
    let timedOut = false;
    let timeoutReject: (error: Error) => void = () => {};
    const timeout = new Promise<never>((_, reject) => {
      timeoutReject = reject;
    });
    // Uma rejeição continua observada depois de os headers vencerem a corrida.
    void timeout.catch(() => {});
    let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", abort);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        const error = new Error("TRADUCAO_DOWNLOAD_TIMEOUT");
        controller.abort(error);
        timeoutReject(error);
        bodyController?.error(error);
        cleanup();
      }, inactivityMs);
    };
    arm();
    try {
      const response = await Promise.race([
        fetcher(input, { ...init, signal: controller.signal }),
        timeout,
      ]);
      if (!response.body) {
        cleanup();
        return response;
      }
      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        start(streamController) {
          bodyController = streamController;
        },
        async pull(streamController) {
          try {
            const { done, value } = await reader.read();
            if (timedOut) return;
            if (done) {
              cleanup();
              streamController.close();
            } else {
              arm();
              streamController.enqueue(value);
            }
          } catch (error) {
            cleanup();
            if (!timedOut) streamController.error(error);
          }
        },
        async cancel(reason) {
          cleanup();
          controller.abort(reason);
          await reader.cancel(reason);
        },
      });
      const wrapped = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      Object.defineProperty(wrapped, "url", { value: response.url });
      return wrapped;
    } catch (error) {
      cleanup();
      throw timedOut ? new Error("TRADUCAO_DOWNLOAD_TIMEOUT") : error;
    }
  };
}
