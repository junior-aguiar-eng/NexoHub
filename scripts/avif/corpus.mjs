export async function createCorpus() {
  const cases = new Map();
  const photos = new Map();
  for (const id of ["chelsea", "coffee"]) {
    const bitmap = await createImageBitmap(await (await fetch(`/${id}.png`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    photos.set(id, canvas);
    cases.set(id, ctx.getImageData(0, 0, canvas.width, canvas.height));
    bitmap.close();
  }
  const make = (id, width, height, draw) => {
    const canvas = new OffscreenCanvas(width, height),
      ctx = canvas.getContext("2d");
    draw(ctx, width, height);
    cases.set(id, ctx.getImageData(0, 0, width, height));
  };
  make("alpha-ramps", 256, 128, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = `rgba(40,120,240,${x / 255})`;
      ctx.fillRect(x, 0, 1, h / 2);
      ctx.fillStyle = `rgba(240,60,20,${x / 255})`;
      ctx.fillRect(x, h / 2, 1, h / 2);
    }
  });
  make("edges", 512, 320, (ctx, w, h) => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = x % 16 ? "red" : "blue";
      ctx.fillRect(x, 0, 4, h);
    }
    ctx.fillStyle = "black";
    ctx.fillRect(0, h / 2, w, 1);
  });
  make("text", 800, 400, (ctx, w, h) => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "black";
    for (let n = 0; n < 10; n++) {
      ctx.font = `${12 + n}px sans-serif`;
      ctx.fillText("Relatório autoral — ação, órgão, 0123456789", 10, 25 + n * 35);
    }
  });
  make("gradient", 513, 257, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#002030");
    gradient.addColorStop(0.5, "#309070");
    gradient.addColorStop(1, "#ffe0a0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
  make("odd-alpha", 31, 17, (ctx, w, h) => {
    ctx.fillStyle = "rgba(255,0,0,.5)";
    ctx.fillRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = "blue";
    ctx.fillRect(3, 3, 4, 5);
  });
  make("coffee-upscale-6mp", 3000, 2000, (ctx, w, h) => {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photos.get("coffee"), 0, 0, w, h);
  });
  return cases;
}
