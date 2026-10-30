import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("usa o camaleão no README e remove os assets do monograma antigo", () => {
  expect(readFileSync("../../README.md", "utf8")).toContain("src/assets/nexohub-camaleao.svg");
  for (const path of [
    "src/assets/nexohub-icon.png",
    "src/assets/nexohub-icon.svg",
    "public/favicon.png",
    "../desktop/src-tauri/icons/icon.icns",
    "../desktop/src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher.png",
    "../desktop/src-tauri/icons/ios/AppIcon-512@2x.png",
  ]) {
    expect(existsSync(path), path).toBe(false);
  }
  expect(readFileSync("src/assets/nexohub-camaleao.svg", "utf8")).toBe(
    readFileSync("../desktop/src-tauri/app-icon.svg", "utf8"),
  );
  expect(readFileSync("src/assets/nexohub-camaleao.png")).toEqual(
    readFileSync("../desktop/src-tauri/icons/icon.png"),
  );
});
