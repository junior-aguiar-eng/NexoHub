import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import type { LauncherTool } from "@/features/launcher/model";
import { translate } from "@/i18n";

type ParallaxBackgroundProps = {
  tools: readonly LauncherTool[];
};

type FloatingLabel = {
  id: string;
  name: string;
  xPercent: number;
  yPercent: number;
  depth: number; // 1, 2 ou 3 (profundidade de parallax)
  rotation: number;
  fontSizeRem: number;
  opacity: number;
};

export function ParallaxBackground({ tools }: ParallaxBackgroundProps) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetOffset = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });
  const animFrameId = useRef<number | null>(null);

  // Deriva a lista de nomes das ferramentas ativas e distribui de forma elegante pelo fundo
  const labels = useMemo<FloatingLabel[]>(() => {
    if (!tools || tools.length === 0) return [];

    const toolNames = tools.map((t) => translate(t.titleKey));

    // Garante um volume visual equilibrado distribuindo em 3 camadas de profundidade
    // Usamos posições determinísticas calculadas para nunca sobrepor o centro de leitura
    const seededLocations = [
      { x: 6, y: 12, depth: 1, rot: -3, size: 0.95, op: 0.045 },
      { x: 88, y: 15, depth: 2, rot: 2, size: 1.1, op: 0.055 },
      { x: 14, y: 32, depth: 3, rot: 1, size: 0.85, op: 0.04 },
      { x: 92, y: 38, depth: 1, rot: -2, size: 1.05, op: 0.05 },
      { x: 5, y: 54, depth: 2, rot: 3, size: 1.0, op: 0.045 },
      { x: 86, y: 58, depth: 3, rot: -1, size: 0.9, op: 0.04 },
      { x: 12, y: 72, depth: 1, rot: -4, size: 1.15, op: 0.06 },
      { x: 89, y: 76, depth: 2, rot: 2, size: 0.95, op: 0.045 },
      { x: 22, y: 88, depth: 3, rot: 1, size: 1.0, op: 0.04 },
      { x: 78, y: 92, depth: 1, rot: -2, size: 1.2, op: 0.05 },
      { x: 48, y: 8, depth: 2, rot: 2, size: 0.85, op: 0.035 },
      { x: 52, y: 96, depth: 2, rot: -3, size: 0.9, op: 0.04 },
    ];

    return seededLocations.map((loc, index) => {
      const name = toolNames[index % toolNames.length];
      return {
        id: `parallax-label-${index}-${name}`,
        name,
        xPercent: loc.x,
        yPercent: loc.y,
        depth: loc.depth,
        rotation: loc.rot,
        fontSizeRem: loc.size,
        opacity: loc.op,
      };
    });
  }, [tools]);

  useEffect(() => {
    if (reduceMotion) return;

    function handleMouseMove(e: MouseEvent) {
      // Normaliza entre -1 e +1 a partir do centro da viewport
      const normalX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normalY = (e.clientY / window.innerHeight - 0.5) * 2;

      // Amplitude sutil e refinada (máximo de 15px de deslocamento)
      targetOffset.current = {
        x: normalX * 15,
        y: normalY * 15,
      };
    }

    function renderLoop() {
      // Interpolação linear (LERP) para movimento contínuo e suave
      currentOffset.current.x += (targetOffset.current.x - currentOffset.current.x) * 0.08;
      currentOffset.current.y += (targetOffset.current.y - currentOffset.current.y) * 0.08;

      if (containerRef.current) {
        containerRef.current.style.setProperty(
          "--parallax-x",
          `${currentOffset.current.x.toFixed(2)}px`,
        );
        containerRef.current.style.setProperty(
          "--parallax-y",
          `${currentOffset.current.y.toFixed(2)}px`,
        );
      }

      animFrameId.current = requestAnimationFrame(renderLoop);
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animFrameId.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animFrameId.current !== null) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [reduceMotion]);

  return (
    <aside
      ref={containerRef}
      className="parallax-backdrop"
      aria-hidden="true"
      style={
        {
          "--parallax-x": "0px",
          "--parallax-y": "0px",
        } as React.CSSProperties
      }
    >
      {labels.map((item) => {
        // Multiplicador de profundidade (quanto maior o depth, maior a velocidade relativa)
        const depthMultiplier = item.depth === 1 ? 0.6 : item.depth === 2 ? 1.0 : 1.5;

        return (
          <span
            key={item.id}
            className="parallax-backdrop__item"
            style={{
              left: `${item.xPercent}%`,
              top: `${item.yPercent}%`,
              fontSize: `${item.fontSizeRem}rem`,
              opacity: item.opacity,
              transform: reduceMotion
                ? `rotate(${item.rotation}deg)`
                : `translate3d(calc(var(--parallax-x) * ${depthMultiplier}), calc(var(--parallax-y) * ${depthMultiplier}), 0) rotate(${item.rotation}deg)`,
            }}
          >
            {item.name}
          </span>
        );
      })}
    </aside>
  );
}
