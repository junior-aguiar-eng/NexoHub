import { type CSSProperties, useEffect, useRef } from "react";
import type { LauncherTool } from "@/features/launcher/model";
import { translate } from "@/i18n";

type ParallaxBackgroundProps = {
  tools: readonly LauncherTool[];
};

// Profundidades 1/3, 2/3 e 1: a camada mais próxima nunca ultrapassa 18px.
const locations = [
  { x: 3, y: 18, depth: 1, rotation: -8 },
  { x: 87, y: 22, depth: 2, rotation: 6 },
  { x: 1, y: 48, depth: 3, rotation: -5 },
  { x: 90, y: 57, depth: 1, rotation: 8 },
  { x: 5, y: 82, depth: 2, rotation: -6 },
  { x: 86, y: 88, depth: 3, rotation: 5 },
] as const;

export function ParallaxBackground({ tools }: ParallaxBackgroundProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let frame: number | null = null;
    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };

    function writeOffset() {
      container?.style.setProperty("--parallax-x", `${current.x}px`);
      container?.style.setProperty("--parallax-y", `${current.y}px`);
    }

    function stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      target = { x: 0, y: 0 };
      current = { x: 0, y: 0 };
      writeOffset();
    }

    function animate() {
      frame = null;
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      const settled = Math.hypot(target.x - current.x, target.y - current.y) < 0.025;
      if (settled) current = { ...target };
      writeOffset();
      if (!settled) frame = requestAnimationFrame(animate);
    }

    function schedule() {
      if (frame === null) frame = requestAnimationFrame(animate);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!media.matches || document.hidden || event.pointerType === "touch") return;
      const x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2));
      const magnitude = Math.max(1, Math.hypot(x, y));
      target = { x: (x / magnitude) * 18, y: (y / magnitude) * 18 };
      schedule();
    }

    function reset() {
      if (!media.matches || document.hidden) {
        stop();
        return;
      }
      target = { x: 0, y: 0 };
      if (current.x !== 0 || current.y !== 0 || frame !== null) schedule();
    }

    function handleMediaChange() {
      // Zera também ao voltar: a próxima interação inicia uma animação nova.
      stop();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    media.addEventListener("change", handleMediaChange);
    return () => {
      stop();
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
      media.removeEventListener("change", handleMediaChange);
    };
  }, []);

  return (
    <aside
      ref={containerRef}
      className="parallax-backdrop"
      aria-hidden="true"
      style={{ "--parallax-x": "0px", "--parallax-y": "0px" } as CSSProperties}
    >
      {[1, 2, 3].map((depth) => (
        <span
          key={depth}
          className={`parallax-backdrop__shape parallax-backdrop__shape--${depth}`}
          style={{ "--depth": depth / 3 } as CSSProperties}
        />
      ))}
      {locations.slice(0, tools.length).map((location, index) => (
        <span
          key={tools[index].id}
          className="parallax-backdrop__item"
          style={
            {
              left: `${location.x}%`,
              top: `${location.y}%`,
              "--depth": location.depth / 3,
              "--rotation": `${location.rotation}deg`,
            } as CSSProperties
          }
        >
          {translate(tools[index].titleKey)}
        </span>
      ))}
    </aside>
  );
}
