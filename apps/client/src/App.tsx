import { translate } from "./i18n";

export function App() {
  return (
    <main className="foundation" aria-labelledby="product-name">
      <p className="eyebrow">{translate("foundation.eyebrow")}</p>
      <h1 id="product-name">{translate("foundation.title")}</h1>
      <p>{translate("foundation.description")}</p>
    </main>
  );
}
