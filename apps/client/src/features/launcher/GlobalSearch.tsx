import { Search } from "lucide-react";
import { translate } from "@/i18n";

type GlobalSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function GlobalSearch({ value, onChange }: GlobalSearchProps) {
  return (
    <label className="global-search">
      <span className="sr-only">{translate("search.label")}</span>
      <Search size={21} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={translate("search.placeholder")}
      />
    </label>
  );
}
