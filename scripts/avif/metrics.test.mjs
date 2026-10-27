import assert from "node:assert/strict";
import test from "node:test";
import { comparePixels } from "./metrics.mjs";

test("RGB sob transparência zero não altera o composto; alpha é medido separadamente", () => {
  const a = { width: 1, height: 1, data: [255, 0, 0, 0] },
    b = { width: 1, height: 1, data: [0, 255, 0, 0] };
  assert.deepEqual(comparePixels(a, b), {
    mse: 0,
    psnrDb: null,
    exactComposite: true,
    alphaMaxError: 0,
  });
  const difference = comparePixels(
    { width: 1, height: 1, data: [0, 0, 0, 255] },
    { width: 1, height: 1, data: [255, 255, 255, 255] },
  );
  assert.equal(difference.mse, 65025);
  assert.equal(difference.psnrDb, 0);
});
test("recusa geometria ou quantidade de pixels divergentes", () => {
  assert.throws(
    () => comparePixels({ width: 1, height: 1, data: [0] }, { width: 1, height: 1, data: [0] }),
    /DIMENSIONS/,
  );
});
