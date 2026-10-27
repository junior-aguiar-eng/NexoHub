// Controles sintéticos autorais MPL-2.0; não representam assinatura de pessoa real.
export const overlayReference = {
  stamp: "CONTROLE Q-C0 - ação 00123",
  signer: "Pessoa de Teste",
  date: "27/10/2026",
  numberMargin: 30,
  // Helvetica padrão a 10 pt: altura 9,25 pt; referência do topo = margem + altura.
  numberTopBaseline: 39.25,
  // pdf-lib inclui kerning na largura; PDF.js mede o avanço efetivamente extraído.
  textAlignmentTolerance: 0.5,
  signaturePngBase64:
    "iVBORw0KGgoAAAANSUhEUgAAACgAAAAKCAIAAABJ+IsHAAAAGklEQVR4nGP4z8AwIGhgbB21eNTiUYuHhcUAaRuOgDO6NfgAAAAASUVORK5CYII=",
  cropMargins: { top: 10, bottom: 20, left: 5, right: 15 },
  croppedBoxes: [
    { x: 24.5, y: 102, width: 232, height: 287 },
    { x: 41, y: 41.5, width: 217, height: 344 },
    { x: 59.5, y: 65, width: 264, height: 315 },
    { x: 80, y: 90.5, width: 245, height: 376 },
  ],
} as const;
