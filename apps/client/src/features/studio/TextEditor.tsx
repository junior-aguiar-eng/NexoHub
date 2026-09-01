import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type TextEditorProps = {
  initialContent?: string;
  onSave?: (content: string) => Promise<void> | void;
};

export function TextEditor({ initialContent = "", onSave }: TextEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const dirty = content !== savedContent;

  async function save() {
    if (!onSave || !dirty) return;
    await onSave(content);
    setSavedContent(content);
  }

  return (
    <section className="text-editor" aria-labelledby="text-editor-title">
      <div className="text-editor__toolbar">
        <div>
          <p className="eyebrow">{translate("textEditor.eyebrow")}</p>
          <h2 id="text-editor-title">{translate("textEditor.title")}</h2>
        </div>
        <Button variant="secondary" disabled={!onSave || !dirty} onClick={save}>
          <Save size={16} aria-hidden="true" />
          {translate("textEditor.save")}
        </Button>
      </div>
      <label>
        <span className="sr-only">{translate("textEditor.label")}</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          placeholder={translate("textEditor.placeholder")}
        />
      </label>
      <footer>
        <span>{translate("textEditor.utf8")}</span>
        <span>
          {content.length} {translate("textEditor.characters")}
        </span>
        {!onSave && <span>{translate("textEditor.projectRequired")}</span>}
      </footer>
    </section>
  );
}
