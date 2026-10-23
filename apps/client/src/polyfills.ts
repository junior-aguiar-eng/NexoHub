/**
 * Polyfills essenciais para compatibilidade de ambientes de execução
 * (Node.js < 23 em CI e navegadores ligeiramente anteriores aos padrões 2025/2026).
 */

// Polyfill de Promise.try (exigido pelo despachante de mensagens do pdfjs-dist)
const promiseProto = Promise as unknown as {
  try?: <T, A extends unknown[]>(fn: (...args: A) => T | PromiseLike<T>, ...args: A) => Promise<T>;
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
};

if (typeof promiseProto.try !== "function") {
  Object.defineProperty(Promise, "try", {
    value: function promiseTry<T, A extends unknown[]>(
      fn: (...args: A) => T | PromiseLike<T>,
      ...args: A
    ): Promise<T> {
      return new Promise((resolve) => {
        resolve(fn(...args));
      });
    },
    writable: true,
    configurable: true,
  });
}

if (typeof promiseProto.withResolvers !== "function") {
  Object.defineProperty(Promise, "withResolvers", {
    value: function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },
    writable: true,
    configurable: true,
  });
}

// Polyfill de Uint8Array.prototype.toHex (exigido por certas rotinas de criptografia do pdfjs-dist)
const uint8Proto = Uint8Array.prototype as unknown as { toHex?: () => string };
if (typeof uint8Proto.toHex !== "function") {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    value: function toHex(this: Uint8Array): string {
      return Array.from(this, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    writable: true,
    configurable: true,
  });
}
