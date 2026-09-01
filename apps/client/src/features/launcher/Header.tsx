import { Command, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type HeaderProps = {
  onOpenCommandPalette: () => void;
};

export function Header({ onOpenCommandPalette }: HeaderProps) {
  return (
    <header className="app-header">
      <a className="brand" href="#main-content" aria-label="NexoHub">
        <span className="brand__mark" aria-hidden="true">
          N
        </span>
        <span className="brand__copy">
          <strong>NexoHub</strong>
          <small>{translate("brand.tagline")}</small>
        </span>
      </a>

      <div className="header-actions">
        <Button
          variant="secondary"
          className="command-trigger"
          onClick={onOpenCommandPalette}
          aria-haspopup="dialog"
        >
          <Command size={17} aria-hidden="true" />
          <span>{translate("header.search")}</span>
          <kbd>{translate("header.searchShortcut")}</kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label={`${translate("header.settings")} — ${translate("tools.comingSoon")}`}
        >
          <Settings2 size={19} aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
