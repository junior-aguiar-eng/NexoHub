import { comparePixels } from "/metrics.mjs";

const memories = new Set();
const NativeMemory = WebAssembly.Memory;
WebAssembly.Memory = new Proxy(NativeMemory, {
  construct(target, args) {
    const value = Reflect.construct(target, args);
    memories.add(value);
    return value;
  },
});
for (const key of ["instantiate", "instantiateStreaming"]) {
  const original = WebAssembly[key]?.bind(WebAssembly);
  if (original)
    WebAssembly[key] = async (...args) => {
      const result = await original(...args);
      const instance = result instanceof WebAssembly.Instance ? result : result.instance;
      for (const value of Object.values(instance?.exports ?? {}))
        if (value instanceof NativeMemory) memories.add(value);
      return result;
    };
}
let encoder, decoder;
self.onmessage = async ({ data }) => {
  try {
    const { codec, options, pixels, width, height, invalid } = data;
    if (invalid) {
      const module = await import(`/${codec}/decode.js`);
      try {
        await module.default(new Uint8Array([0, 1, 2, 3]).buffer);
        postMessage({ invalidRejected: false });
      } catch {
        postMessage({ invalidRejected: true });
      }
      return;
    }
    const source = { width, height, data: pixels };
    const input = new Uint8ClampedArray(pixels);
    if (codec === "jpeg")
      for (let i = 0; i < input.length; i += 4) {
        const alpha = input[i + 3] / 255;
        for (let c = 0; c < 3; c++)
          input[i + c] = Math.round(input[i + c] * alpha + 255 * (1 - alpha));
        input[i + 3] = 255;
      }
    const start = performance.now();
    if (!encoder) {
      encoder = await import(`/${codec}/encode.js`);
      await encoder.init();
    }
    const encodeStart = performance.now();
    postMessage({ phase: "encode" });
    const bytes = await encoder.default(new ImageData(input, width, height), options);
    const encodedAt = performance.now();
    if (!decoder) decoder = await import(`/${codec}/decode.js`);
    const decoded = await decoder.default(bytes);
    const decodedAt = performance.now();
    const quality = comparePixels(source, decoded);
    postMessage(
      {
        bytes,
        encodeMs: encodedAt - encodeStart,
        importAndEncodeMs: encodedAt - start,
        decodeMs: decodedAt - encodedAt,
        quality,
        wasmObservedBytes: [...memories].reduce((n, m) => n + m.buffer.byteLength, 0),
        wasmMemoryCount: memories.size,
      },
      [bytes],
    );
  } catch (error) {
    postMessage({ error: String(error) });
  }
};
