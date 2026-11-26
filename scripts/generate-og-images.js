import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const SITE_URL = (process.env.SITE_URL || "https://syswraith.com").replace(/\/+$/, "");
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

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function stripTags(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text, max = 180) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "").replace(/[.,;:]+$/, "") + "…";
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = (text || "").split(/\s+/).filter(Boolean);
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

function metaContent(html, name, attr = "name") {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attr}=["']${name}["'][^>]*>`, "i");
  const m = html.match(re) || html.match(re2);
  return m ? stripTags(m[1]) : "";
}

function pageInfo(file) {
  const html = fs.readFileSync(file, "utf8");
  const title = stripTags((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1]) || SITE_NAME;
  const desc = metaContent(html, "description") || metaContent(html, "og:description", "property") || "";
  const rel = path.relative(OUT_DIR, file).split(path.sep).join("/");
  const outPng = path.join(path.dirname(file), "og-image.png");
  return { title, desc, outPng, rel };
}

async function drawOg({ title, desc }, favicon) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const maxWidth = WIDTH - PAD * 2;
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = "bold 68px sans-serif";
  const titleLines = wrapText(ctx, title, maxWidth, 3);
  let y = PAD + 68;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += 80;
  }

  y += 8;
  ctx.fillStyle = MUTED;
  ctx.font = "32px sans-serif";
  ctx.fillText(`by ${AUTHOR}`, PAD, y);
  y += 64;

  if (desc) {
    ctx.fillStyle = MUTED;
    ctx.font = "italic 30px sans-serif";
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
