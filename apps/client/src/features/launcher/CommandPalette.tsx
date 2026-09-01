import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { launcherTools, suites } from "./data";
import type { SuiteId } from "./model";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSuite: (suite: SuiteId) => void;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function CommandPalette({ open, onOpenChange, onSelectSuite }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalize(query.trim());
  const visibleSuites = useMemo(
    () => suites.filter((suite) => normalize(translate(suite.labelKey)).includes(normalizedQuery)),
    [normalizedQuery],
  );
  const visibleTools = useMemo(
    () =>
      launcherTools.filter((tool) => normalize(translate(tool.titleKey)).includes(normalizedQuery)),
    [normalizedQuery],
  );

  function closePalette() {
    setQuery("");
    onOpenChange(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="command-backdrop" />
        <Dialog.Viewport className="command-viewport">
          <Dialog.Popup className="command-dialog" initialFocus={inputRef}>
            <div className="command-dialog__header">
              <div>
                <Dialog.Title>{translate("command.title")}</Dialog.Title>
                <Dialog.Description>{translate("command.description")}</Dialog.Description>
              </div>
              <Dialog.Close
                className="button button--ghost button--icon"
                aria-label={translate("command.close")}
              >
                <X size={19} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <label className="command-search">
              <Search size={19} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={translate("command.placeholder")}
              />
            </label>
            <div className="command-results">
              {visibleSuites.length > 0 && (
                <section aria-labelledby="command-navigation">
                  <h3 id="command-navigation">{translate("command.navigation")}</h3>
                  {visibleSuites.map((suite) => (
                    <Button
                      key={suite.id}
                      variant="ghost"
                      className="command-item"
                      onClick={() => {
                        onSelectSuite(suite.id);
                        closePalette();
                      }}
                    >
                      <span>{translate(suite.labelKey)}</span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </Button>
                  ))}
                </section>
              )}
              {visibleTools.length > 0 && (
                <section aria-labelledby="command-tools">
                  <h3 id="command-tools">{translate("command.tools")}</h3>
                  {visibleTools.map((tool) => (
                    <div className="command-item command-item--disabled" key={tool.id}>
                      <span>{translate(tool.titleKey)}</span>
                      <span className="status-badge">{translate("tools.comingSoon")}</span>
                    </div>
                  ))}
                </section>
              )}
              {visibleSuites.length === 0 && visibleTools.length === 0 && (
                <p className="command-empty" role="status">
                  {translate("command.noResults")}
                </p>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
