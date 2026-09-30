import { useRef } from "react";
import { translate } from "@/i18n";
import { suites } from "./data";
import type { LauncherTool, SuiteId } from "./model";

type SuiteNavigationProps = {
  activeSuite: SuiteId;
  onSelect: (suite: SuiteId) => void;
  tools: readonly LauncherTool[];
};

export function SuiteNavigation({ activeSuite, onSelect, tools }: SuiteNavigationProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const visibleSuites = suites.filter(
    (suite) => suite.id === "overview" || tools.some((tool) => tool.suite === suite.id),
  );

  function moveFocus(currentIndex: number, key: string) {
    let nextIndex = currentIndex;
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % visibleSuites.length;
    if (key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + visibleSuites.length) % visibleSuites.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = visibleSuites.length - 1;
    if (nextIndex !== currentIndex) {
      buttonsRef.current[nextIndex]?.focus();
      onSelect(visibleSuites[nextIndex].id);
    }
  }

  return (
    <nav className="suite-nav" aria-label={translate("nav.label")}>
      {visibleSuites.map((suite, index) => (
        <button
          key={suite.id}
          ref={(element) => {
            buttonsRef.current[index] = element;
          }}
          type="button"
          className="suite-nav__item"
          data-active={activeSuite === suite.id}
          aria-current={activeSuite === suite.id ? "page" : undefined}
          aria-label={suite.ariaLabel ?? translate(suite.labelKey)}
          onClick={() => onSelect(suite.id)}
          onKeyDown={(event) => {
            if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              moveFocus(index, event.key);
            }
          }}
        >
          {translate(suite.labelKey)}
        </button>
      ))}
    </nav>
  );
}
