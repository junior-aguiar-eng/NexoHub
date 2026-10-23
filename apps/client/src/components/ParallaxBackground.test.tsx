import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launcherTools } from "@/features/launcher/data";
import { ParallaxBackground } from "./ParallaxBackground";

describe("ParallaxBackground", () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let media: EventTarget & { matches: boolean };

  function flushFrames() {
    for (let count = 0; frames.size && count < 200; count++) {
      const pending = [...frames.values()];
      frames.clear();
      act(() => {
        for (const callback of pending) callback(count * 16);
      });
    }
  }

  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    media = Object.assign(new EventTarget(), { matches: true });
    vi.stubGlobal("matchMedia", () => media);
    vi.stubGlobal("PointerEvent", MouseEvent);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("fica ocioso até o ponteiro mover e encerra os frames ao estabilizar", () => {
    const { container } = render(<ParallaxBackground tools={launcherTools} />);
    const backdrop = container.querySelector("aside");
    if (!backdrop) throw new Error("Fundo não encontrado");
    expect(frames.size).toBe(0);
    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: 0 });
    expect(frames.size).toBe(1);
    flushFrames();
    const x = Number.parseFloat(backdrop.style.getPropertyValue("--parallax-x"));
    const y = Number.parseFloat(backdrop.style.getPropertyValue("--parallax-y"));
    expect(Math.hypot(x, y)).toBeGreaterThan(10);
    expect(Math.hypot(x, y)).toBeLessThanOrEqual(18.01);
    expect(frames.size).toBe(0);
    fireEvent.blur(window);
    flushFrames();
    expect(backdrop.style.getPropertyValue("--parallax-x")).toBe("0px");
    expect(backdrop.style.getPropertyValue("--parallax-y")).toBe("0px");
    expect(frames.size).toBe(0);
  });

  it("mantém o fundo estático quando a mídia não permite movimento", () => {
    media.matches = false;
    const { container } = render(<ParallaxBackground tools={launcherTools} />);
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });
    expect(frames.size).toBe(0);
    expect(container.querySelector("aside")).toHaveAttribute("aria-hidden", "true");
  });

  it("cancela movimento pendente quando a preferência muda e ao desmontar", () => {
    const { container, unmount } = render(<ParallaxBackground tools={launcherTools} />);
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });
    expect(frames.size).toBe(1);
    media.matches = false;
    act(() => media.dispatchEvent(new Event("change")));
    expect(frames.size).toBe(0);
    expect(container.querySelector("aside")?.style.getPropertyValue("--parallax-x")).toBe("0px");
    media.matches = true;
    act(() => media.dispatchEvent(new Event("change")));
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});
