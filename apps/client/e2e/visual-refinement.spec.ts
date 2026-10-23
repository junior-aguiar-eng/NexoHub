import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

for (const [width, columns] of [
  [390, 1],
  [520, 2],
  [768, 3],
  [1024, 4],
  [1440, 5],
] as const) {
  test(`grade legível e alinhada em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const cards = page.locator(".tool-card");
    await expect(cards).toHaveCount(19);
    await expect(cards.last()).toHaveCSS("opacity", "1");
    await expect
      .poll(() =>
        page
          .locator(".tool-grid")
          .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length),
      )
      .toBe(columns);
    await expect(page.locator(".tool-card__icon").first()).toHaveCSS("width", "44px");
    await expect(cards.first()).toHaveCSS("padding", "24px");
    await expect(cards.first()).toHaveCSS("border-radius", "16px");
    await expect(page.locator(".tool-grid")).toHaveCSS("gap", "20px");
    const layout = await cards.evaluateAll((elements) =>
      elements.map((card) => {
        const rect = card.getBoundingClientRect();
        const heading = card.querySelector("h3");
        const description = card.querySelector("p");
        if (!heading || !description) throw new Error("Cartão incompleto");
        const title = heading.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          height: rect.height,
          titleY: title.top - rect.top,
          clipped: description.scrollHeight > description.clientHeight,
        };
      }),
    );
    for (const card of layout) {
      expect(card.left).toBeGreaterThanOrEqual(0);
      expect(card.right).toBeLessThanOrEqual(width);
      expect(card.clipped).toBe(false);
    }
    for (const card of layout.slice(0, columns)) {
      expect(card.height).toBeCloseTo(layout[0].height, 0);
      expect(card.titleY).toBeCloseTo(layout[0].titleY, 0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    for (const control of await page
      .locator(".suite-nav__item, .header-search-icon-btn, .brand-btn")
      .all()) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: testInfo.outputPath(`inicio-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto("/juntar-pdf");
    await expect(page.locator(".ilovepdf-main-upload-btn")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const upload = await page.locator(".ilovepdf-main-upload-btn").boundingBox();
    if (!upload) throw new Error("Upload não encontrado");
    expect(upload.x + upload.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath(`ferramenta-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("cartão tem foco visível, abre pelo teclado e aceita arquivos arrastados", async ({
  page,
}) => {
  await page.goto("/");
  const card = page
    .locator(".tool-card")
    .filter({ has: page.getByRole("heading", { name: "Juntar PDF", exact: true }) });
  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.locator(".dedicated-tool-page")).toBeVisible();
  await page.goto("/");
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["%PDF-1.7"], "exemplo.pdf", { type: "application/pdf" }));
    return data;
  });
  await card.dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(card).toHaveClass(/tool-card--drag-over/);
  await card.dispatchEvent("dragleave", { dataTransfer: transfer });
  await expect(card).not.toHaveClass(/tool-card--drag-over/);
  await transfer.dispose();
});

test("catálogo mantém fundo limpo e cards estáticos com movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.mouse.move(1200, 700);
  await expect(page.locator(".parallax-backdrop")).toHaveCount(0);
  await page.locator(".tool-card").first().hover();
  await expect(page.locator(".tool-card").first()).toHaveCSS("translate", "none");
});

test("mantém contraste de textos, filtros e ícones", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tool-card").last()).toHaveCSS("opacity", "1");
  const contrasts = await page.evaluate(() => {
    function luminance(color: string) {
      const channels = (color.match(/[\d.]+/g) ?? [])
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const linear = value / 255;
          return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    return [
      ...document.querySelectorAll(
        ".tool-card__title, .tool-card__desc, .suite-nav__item, .tool-card__icon",
      ),
    ].map((element) => {
      const style = getComputedStyle(element);
      const background =
        element.closest(".tool-card") && !element.matches(".tool-card__icon")
          ? getComputedStyle(element.closest(".tool-card") as Element).backgroundColor
          : style.backgroundColor;
      const a = luminance(style.color);
      const b = luminance(background);
      return {
        name: element.textContent || element.className,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        minimum: element.matches(".tool-card__icon") ? 3 : 4.5,
      };
    });
  });
  for (const contrast of contrasts) {
    expect(contrast.ratio, contrast.name).toBeGreaterThanOrEqual(contrast.minimum);
  }
});

test("painéis de PDF com arquivo carregado cabem na tela móvel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const file = {
    name: "exemplo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  };
  for (const path of ["/juntar-pdf", "/dividir-pdf", "/comprimir-pdf", "/rotacionar-pdf"]) {
    await page.goto(path);
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.locator(".ilovepdf-action-red-btn")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      path,
    ).toBeLessThanOrEqual(390);
    for (const button of await page.locator(".dedicated-tool-page button:visible").all()) {
      const box = await button.boundingBox();
      if (!box) throw new Error("Controle sem dimensões");
      // Transformações de entrada podem produzir 43,99998px no cálculo da caixa.
      expect(Number(box.height.toFixed(2))).toBeGreaterThanOrEqual(44);
      expect(Number(box.width.toFixed(2))).toBeGreaterThanOrEqual(44);
      expect(box.x, path).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, path).toBeLessThanOrEqual(390);
    }
  }
});

test("download final mantém destaque e contraste da ação principal", async ({ page }) => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const buffer = Buffer.from(await pdf.save());
  await page.goto("/juntar-pdf");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "primeiro.pdf", mimeType: "application/pdf", buffer },
    { name: "segundo.pdf", mimeType: "application/pdf", buffer },
  ]);
  await page.locator(".ilovepdf-action-red-btn").click();
  const download = page.locator(".ilovepdf-big-download-btn");
  await expect(download).toBeVisible();
  await expect(download).toHaveCSS("background-color", "rgb(225, 29, 72)");
  await expect(download).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("catálogo fecha por Escape e Tab sem perder o foco de teclado", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Todas as ferramentas PDF" });
  const panel = page.locator(".megamenu-panel--all");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await panel.getByRole("button").last().focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Buscar no NexoHub" })).toBeFocused();
  await expect(panel).toHaveCount(0);
});

test("clique interno no catálogo preserva a seleção da ferramenta", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Todas as ferramentas PDF" });
  const panel = page.locator(".megamenu-panel--all");
  await trigger.click();
  await panel.locator(".megamenu-col-title").first().click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Juntar PDF", exact: true }).click();
  await expect(page.locator(".dedicated-tool-page")).toBeVisible();
  await expect(panel).toHaveCount(0);
});

test("busca do catálogo combina categorias, limpa com Escape e abre a paleta pelo atalho", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Buscar ferramentas" });
  await search.fill("juntar");
  await expect(page.locator(".tool-card")).toHaveCount(1);
  await expect(page.locator(".tool-card")).toHaveAttribute("data-tone", "coral");
  await page
    .getByRole("navigation", { name: "Categorias de ferramentas" })
    .getByRole("button", { name: "Converter PDF", exact: true })
    .click();
  await expect(page.locator(".tool-card")).toHaveCount(0);
  await search.focus();
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator(".tool-card").first()).toHaveAttribute("data-tone", "amber");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Abrir busca rápida (Ctrl + K ou ⌘K)" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
