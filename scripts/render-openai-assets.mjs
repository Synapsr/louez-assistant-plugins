#!/usr/bin/env node
/**
 * Renders the OpenAI listing's PNGs (openai/assets/) from the Duo mark,
 * brand/duo.svg (a copy of Louez's apps/web/public/favicon.svg, brand blue #0166FE).
 *
 *   assets/logo.png       512x512  blue mark on white, 72% of the canvas
 *   assets/logo-dark.png  512x512  blue mark on #212121 (ChatGPT's dark surface)
 *   assets/icon.png       256x256  blue mark, transparent, 92% of the canvas
 *   assets/icon-dark.png  256x256  white mark, transparent, 92% of the canvas
 *
 * Needs sharp: `npm install --no-save sharp`, then `node scripts/render-openai-assets.mjs`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "openai", "assets");

const svg = await readFile(path.join(root, "brand", "duo.svg"), "utf8");
const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
const body = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1]?.trim();
if (!viewBox || !body) throw new Error("brand/duo.svg: no viewBox or no body to read.");

/** The mark centred on a `size` canvas, recoloured to `fill`, on an optional ground. */
function compose({ size, coverage, ground, fill }) {
  const inner = Math.round(size * coverage);
  const offset = (size - inner) / 2;
  const mark = body.replaceAll('fill="#0166FE"', `fill="${fill}"`);
  return [
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`,
    ground ? `<rect width="${size}" height="${size}" fill="${ground}"/>` : "",
    `<svg x="${offset}" y="${offset}" width="${inner}" height="${inner}" viewBox="${viewBox}">${mark}</svg>`,
    "</svg>",
  ].join("");
}

const outputs = [
  ["logo.png", { size: 512, coverage: 0.72, ground: "#FFFFFF", fill: "#0166FE" }],
  ["logo-dark.png", { size: 512, coverage: 0.72, ground: "#212121", fill: "#0166FE" }],
  ["icon.png", { size: 256, coverage: 0.92, fill: "#0166FE" }],
  ["icon-dark.png", { size: 256, coverage: 0.92, fill: "#FFFFFF" }],
];

for (const [name, variant] of outputs) {
  const png = await sharp(Buffer.from(compose(variant)))
    .resize(variant.size, variant.size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(assets, name), png);
  console.log(`assets/${name} ${variant.size}x${variant.size}`);
}
