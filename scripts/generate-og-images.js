import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { parseDocument } from "htmlparser2";
import { selectAll, selectOne } from "css-select";
import { getAttributeValue, textContent } from "domutils";

const OUT_DIR = path.resolve("_site");
const FAVICON = path.resolve("public/favicon.ico");
const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 60;
const BG = "#ffffff";
const TITLE_COLOR = "#111827";
const MUTED = "#555555";
const AUTHOR = "Aryan Karekar";
const SITE_NAME = "syswraith";
const FONT_FAMILY = "DejaVu Sans";
const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
];

function registerFonts() {
  let registered = 0;
  for (const file of FONT_CANDIDATES) {
    if (!fs.existsSync(file)) continue;
    try {
      GlobalFonts.registerFromPath(file, FONT_FAMILY);
      registered++;
    } catch (e) {
      console.warn(`font register failed for ${file}: ${e.message}`);
    }
  }
  if (!registered) {
    console.warn(`No DejaVu Sans font files found; OG text rendering may be blank on CI.`);
  } else {
    console.log(`Registered ${registered} font file(s) for ${FONT_FAMILY}`);
  }
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function normText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function clip(text, max = 180) {
  const t = normText(text);
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "").replace(/[.,;:]+$/, "") + "…";
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = normText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    last = clip(last, Math.max(40, last.length));
    if (!last.endsWith("…")) last += "…";
    lines[lines.length - 1] = last;
  }
  return lines;
}

function metaByName(dom, name) {
  const nodes = selectAll(`meta[name="${name}"], meta[property="${name}"]`, dom);
  for (const node of nodes) {
    const content = normText(getAttributeValue(node, "content"));
    if (content) return content;
  }
  return "";
}

function pageInfo(file) {
  const html = fs.readFileSync(file, "utf8");
  const dom = parseDocument(html);
  const titleNode = selectOne("title", dom);
  const title = normText(titleNode ? textContent(titleNode) : "") || SITE_NAME;
  const desc =
    metaByName(dom, "description") ||
    metaByName(dom, "og:description") ||
    metaByName(dom, "twitter:description") ||
    "";
  const rel = path.relative(OUT_DIR, file).split(path.sep).join("/");
  let outPng = path.join(path.dirname(file), "og-image.png");
  if (rel === "404.html") outPng = path.join(OUT_DIR, "404", "og-image.png");
  return { title, desc, outPng, rel };
}

async function drawOg({ title, desc }, favicon) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const maxWidth = WIDTH - PAD * 2;
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = `bold 68px "${FONT_FAMILY}", sans-serif`;
  const titleLines = wrapText(ctx, title, maxWidth, 3);
  let y = PAD + 68;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += 80;
  }

  y += 8;
  ctx.fillStyle = MUTED;
  ctx.font = `32px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(`by ${AUTHOR}`, PAD, y);
  y += 64;

  if (desc) {
    ctx.fillStyle = MUTED;
    ctx.font = `italic 30px "${FONT_FAMILY}", sans-serif`;
    const descLines = wrapText(ctx, clip(desc, 220), maxWidth, 4);
    for (const line of descLines) {
      ctx.fillText(line, PAD, y);
      y += 42;
      if (y > HEIGHT - 110) break;
    }
  }

  if (favicon) {
    const size = 64;
    ctx.drawImage(favicon, WIDTH - PAD - size, HEIGHT - PAD - size, size, size);
  }

  return canvas.toBuffer("image/png");
}

async function main() {
  registerFonts();
  if (!fs.existsSync(OUT_DIR)) throw new Error(`Missing ${OUT_DIR}. Run eleventy first.`);
  let favicon = null;
  if (fs.existsSync(FAVICON)) {
    try { favicon = await loadImage(FAVICON); } catch (e) { console.warn("favicon load failed:", e.message); }
  }

  const htmlFiles = walk(OUT_DIR).filter((f) => f.endsWith(".html"));
  let count = 0;
  for (const file of htmlFiles) {
    const info = pageInfo(file);
    try {
      fs.mkdirSync(path.dirname(info.outPng), { recursive: true });
      const png = await drawOg(info, favicon);
      fs.writeFileSync(info.outPng, png);
      count++;
    } catch (e) {
      console.warn(`OG skipped for ${info.rel}: ${e.message}`);
    }
  }
  console.log(`Generated ${count} OG images in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
