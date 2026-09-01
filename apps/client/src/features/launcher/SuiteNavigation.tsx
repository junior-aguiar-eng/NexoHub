import { useRef } from "react";
import { translate } from "@/i18n";
import { suites } from "./data";
import type { SuiteId } from "./model";

type SuiteNavigationProps = {
  activeSuite: SuiteId;
  onSelect: (suite: SuiteId) => void;
};

export function SuiteNavigation({ activeSuite, onSelect }: SuiteNavigationProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(currentIndex: number, key: string) {
    let nextIndex = currentIndex;
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % suites.length;
    if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + suites.length) % suites.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = suites.length - 1;
    if (nextIndex !== currentIndex) {
      buttonsRef.current[nextIndex]?.focus();
      onSelect(suites[nextIndex].id);
    }
  }

  return (
    <nav className="suite-nav" aria-label={translate("nav.label")}>
      {suites.map((suite, index) => (
        <button
          key={suite.id}
          ref={(element) => {
            buttonsRef.current[index] = element;
          }}
          type="button"
          className="suite-nav__item"
          data-active={activeSuite === suite.id}
          aria-current={activeSuite === suite.id ? "page" : undefined}
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
