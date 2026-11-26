import { extract } from "@extractus/oembed-extractor";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import markdownItTexmath from "markdown-it-texmath";
import katex from "katex";
import slugify from "@sindresorhus/slugify";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const matter = require("gray-matter");
const fmCache = new Map();

function readFrontMatter(inputPath) {
  if (!inputPath) return {};
  if (fmCache.has(inputPath)) return fmCache.get(inputPath);
  try {
    const raw = fs.readFileSync(inputPath, "utf8");
    const { data } = matter(raw);
    fmCache.set(inputPath, data || {});
    return data || {};
  } catch {
    fmCache.set(inputPath, {});
    return {};
  }
}

function slugifyInternalPath(rawPath) {
  return rawPath
    .split("/")
    .map((seg) => {
      if (!seg || seg === "." || seg === "..") return seg;
      const ext = path.posix.extname(seg);
      const base = ext ? seg.slice(0, -ext.length) : seg;
      if (!base) return seg;
      if (ext) return slugify(base) + ext.toLowerCase();
      if (base.toLowerCase() === "index") return "index";
      return slugify(base);
    })
    .join("/");
}

function normalizePathPrefix(prefix) {
  if (!prefix || prefix === "/") return "";
  let p = prefix.trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (!p.endsWith("/")) p += "/";
  return p;
}

const PATH_PREFIX = normalizePathPrefix(process.env.PATH_PREFIX || "");
const withPrefix = (url) => (PATH_PREFIX ? `${PATH_PREFIX.slice(0, -1)}${url}` : url);
const SITE_URL = (process.env.SITE_URL || "https://syswraith.com").replace(/\/+$/, "");
const SITE_NAME = "syswraith";
const SITE_AUTHOR = "Aryan Karekar";
const DEFAULT_DESCRIPTION = "A digital record of conquests with computers, programming, books, music, linguistics, cryptography, typography, et cetera.";

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function plainText(html = "") {
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

function clipText(s = "", n = 200) {
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, "").replace(/[.,;:]+$/, "") + "...";
}

function pageUrlFromOutput(outputPath) {
  let rel = outputPath.replace(/^.*?_site[\\/]/, "/").split(path.sep).join("/");
  if (rel.endsWith("index.html")) rel = rel.slice(0, -"index.html".length);
  if (!rel.startsWith("/")) rel = "/" + rel;
  return `${SITE_URL}${withPrefix(rel)}`.replace(/([^:]\/)\/+/g, "$1");
}

function ogImageUrlFromOutput(outputPath) {
  let rel = outputPath.replace(/^.*?_site[\\/]/, "/").split(path.sep).join("/");
  let dir = rel.endsWith("/index.html") ? rel.slice(0, -"index.html".length) : rel.replace(/\.html$/, "/");
  if (!dir.startsWith("/")) dir = "/" + dir;
  if (!dir.endsWith("/")) dir += "/";
  return `${SITE_URL}${withPrefix(dir)}og-image.png`.replace(/([^:]\/)\/+/g, "$1");
}

function rewriteInternalUrls(html, page) {
  const srcDir = path.posix.dirname(page.filePathStem || "/");
  return html.replace(/\b(src|href)="([^"]+)"/g, (m, attr, url) => {
    if (/^(?:[a-z]+:|\/\/|#|data:|mailto:|tel:)/i.test(url)) return m;
    const hashIdx = url.indexOf("#");
    const qIdx = url.indexOf("?");
    const cut = [hashIdx, qIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? url.length;
    const pathname = url.slice(0, cut);
    const suffix = url.slice(cut);
    if (!pathname) return m;
    let resolved = pathname.startsWith("/")
      ? path.posix.normalize(pathname)
      : path.posix.normalize(path.posix.join(srcDir, pathname));
    if (!resolved.startsWith("/")) resolved = "/" + resolved;
    resolved = slugifyInternalPath(resolved);
    if (resolved.endsWith("/index.html")) resolved = resolved.slice(0, -"/index.html".length) + "/";
    if (PATH_PREFIX && resolved.startsWith(PATH_PREFIX)) return `${attr}="${resolved}${suffix}"`;
    return `${attr}="${withPrefix(resolved)}${suffix}"`;
  });
}

const EMBED_URL_RE = /<p>\s*(?:<a href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[^"\s<]+|youtu\.be\/[^"\s<]+|(?:www\.)?youtube\.com\/shorts\/[^"\s<]+|(?:x|twitter)\.com\/[^"\s<]+\/status\/\d+[^"\s<]*|vimeo\.com\/\d+[^"\s<]*))"[^>]*>[^<]+<\/a>|(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[^\s<]+|youtu\.be\/[^\s<]+|(?:www\.)?youtube\.com\/shorts\/[^\s<]+|(?:x|twitter)\.com\/[^\s<]+\/status\/\d+[^\s<]*|vimeo\.com\/\d+[^\s<]*)))\s*<\/p>/g;

function normalizeEmbedHtml(html, url) {
  if (!html) return `<p><a href="${url}">${url}</a></p>`;
  if (/twitter-tweet|blockquote/.test(html) && /twitter|x\.com/.test(url)) {
    return `<div class="embed embed-twitter">${html}</div>`;
  }
  html = html.replace(/<iframe\b([^>]*)>/i, (m, attrs) => {
    if (/loading=/.test(attrs)) return m;
    return `<iframe${attrs} loading="lazy">`;
  });
  return `<div class="embed embed-media"><div class="embed-frame">${html}</div></div>`;
}

const embedCache = new Map();

async function fetchEmbed(url) {
  if (embedCache.has(url)) return embedCache.get(url);
  const promise = (async () => {
    try {
      const data = await extract(url, { maxwidth: 800 });
      if (data?.html) return normalizeEmbedHtml(data.html, url);
    } catch (e) {}
    return `<p><a href="${url}">${url}</a></p>`;
  })();
  embedCache.set(url, promise);
  return promise;
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.amendLibrary("md", (md) =>
    md.use(markdownItTexmath, {
      engine: katex,
      delimiters: "dollars",
      katexOptions: { throwOnError: false }
    })
  );

  eleventyConfig.addGlobalData("permalink", () => (data) => {
    const stem = (data.page.filePathStem || "").replace(/^\/+/, "");
    if (!stem || stem === "index") return "/index.html";
    const parts = stem.split("/").filter(Boolean);
    const file = parts.pop();
    const dir = parts.map((p) => slugify(p)).join("/");
    if (file.toLowerCase() === "index") return `/${dir}/index.html`;
    const slug = slugify(file);
    if (!dir && slug === "404") return "/404.html";
    return dir ? `/${dir}/${slug}/index.html` : `/${slug}/index.html`;
  });

  eleventyConfig.addPassthroughCopy({ "public/css/water-light.css": "css/water-light.css" });
  eleventyConfig.addPassthroughCopy({ "public/css/katex.min.css": "css/katex.min.css" });
  eleventyConfig.addPassthroughCopy({ "public/fonts": "fonts" });
  eleventyConfig.addPassthroughCopy({ "public/.nojekyll": ".nojekyll" });
  eleventyConfig.addPassthroughCopy({ "public/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy("content/**/*.{png,jpg,jpeg,gif,webp,svg,ico,pdf,txt,xml,webm,mp4,mp3}");
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const srcRoot = path.resolve(dir.input);
    const outRoot = path.resolve(dir.output);
    const exts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pdf", ".txt", ".xml", ".webm", ".mp4", ".mp3"]);
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (exts.has(path.extname(e.name).toLowerCase())) {
          const rel = path.relative(srcRoot, p).split(path.sep).join("/");
          const slugRel = slugifyInternalPath(rel);
          const dest = path.join(outRoot, slugRel);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(p, dest);
        }
      }
    };
    walk(srcRoot);
  });

  eleventyConfig.addTransform("embeds", async function (content) {
    if (!this.page.outputPath?.endsWith(".html")) return content;
    const matches = [...content.matchAll(EMBED_URL_RE)];
    if (!matches.length) return content;
    const replacements = await Promise.all(matches.map((m) => fetchEmbed(m[1] || m[2])));
    let i = 0;
    return content.replace(EMBED_URL_RE, () => replacements[i++]);
  });

  eleventyConfig.addTransform("html-shell", function (content) {
    if (!this.page.outputPath?.endsWith(".html")) return content;
    let body = rewriteInternalUrls(content, this.page);
    if (/^\s*<!doctype html>/i.test(body) || /^\s*<html[\s>]/i.test(body)) return body;
    const data = { ...readFrontMatter(this.page?.inputPath), ...(this.data || {}), ...(this.page?.data || {}) };
    const titleBase = data.title || (this.page.fileSlug === "" ? "Home" : this.page.fileSlug);
    const fullTitle = titleBase === "Home" ? `${SITE_NAME} - ${SITE_AUTHOR}` : `${titleBase} | ${SITE_NAME}`;
    if (!/^\s*<h1[\s>]/i.test(body) && titleBase) {
      body = `<h1>${escapeHtml(titleBase)}</h1>\n${body}`;
    }
    const description = clipText(
      data.description || data.socialDescription || plainText(body) || DEFAULT_DESCRIPTION,
      200
    );
    const canonical = pageUrlFromOutput(this.page.outputPath);
    const ogImage = ogImageUrlFromOutput(this.page.outputPath);
    const tags = Array.isArray(data.tags) ? data.tags.filter((t) => t && t !== "post" && t !== "all") : (data.tags ? [data.tags] : []);
    const publishedRaw = data.published || data.date || data.created || "";
    const published = publishedRaw ? new Date(publishedRaw).toISOString() : "";
    const articleType = published && !String(this.page.filePathStem || "").endsWith("/index") && this.page.fileSlug !== "" ? "article" : "website";
    const keywords = tags.length ? `<meta name="keywords" content="${escapeHtml(tags.join(", "))}">` : "";
    const articleTags = tags.map((t) => `<meta property="article:tag" content="${escapeHtml(String(t))}">`).join("\n  ");
    const articlePublished = articleType === "article" && published ? `<meta property="article:published_time" content="${escapeHtml(published)}">` : "";
    const mainClass = "";
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="${withPrefix("/favicon.ico")}" type="image/x-icon">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapeHtml(titleBase === "Home" ? SITE_NAME : titleBase)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:type" content="${articleType}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:locale" content="en_US">
  ${articlePublished}
  <meta property="article:author" content="${SITE_AUTHOR}">
  ${articleTags}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(titleBase === "Home" ? SITE_NAME : titleBase)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  ${keywords}
  <link rel="stylesheet" href="/css/water-light.css">
  <link rel="stylesheet" href="/css/katex.min.css">
  <style>
    :root { --content-width: 860px; }
    body { max-width: var(--content-width); padding: 0.5rem 1.25rem 2.5rem; }
    .site-header, .site-footer { text-align: center; margin: 0 auto; padding: 0; }
    .site-header { padding-top: 0; }
    .site-footer { color: var(--text-muted); border-top: 0; }
    .site-footer nav { display: flex; flex-wrap: wrap; justify-content: center; gap: .45rem .8rem; margin-top: .75rem; }
    .site-header nav { display: flex; flex-wrap: wrap; justify-content: center; gap: .45rem .8rem; font-size: 1rem; align-items: center; }
    .site-header nav a { text-decoration: none; }
    .site-header nav a:hover { text-decoration: underline; }
    .site-title { width: 100%; display: inline-flex; flex-direction: column; align-items: center; gap: .4rem; font-size: 1.3rem; margin-bottom: .35rem; }
    .site-avatar { width: 72px; height: 72px; border-radius: 100%; margin: 0; }
    .site-rule { border: 0; border-top: 1px solid var(--border); margin: 1rem 0 0; width: 100%; }
    img, video { display: block; width: 100%; max-width: 100%; height: auto; margin: 1.25rem auto; border-radius: 8px; }
    figure { margin: 1.25rem 0; }
    .embed { width: 100%; margin: 1.5rem 0; }
    .embed-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 10px; background: #0001; }
    .embed-frame iframe, .embed-frame object, .embed-frame embed { position: absolute; inset: 0; width: 100% !important; height: 100% !important; border: 0; }
    .embed-twitter { display: flex; justify-content: center; padding: .5rem 0; }
    .embed-twitter .twitter-tweet, .embed-twitter .twitter-tweet-rendered, .embed-twitter iframe { margin: 0 auto !important; max-width: 550px !important; width: 100% !important; }

    pre[class*="language-"] { border-radius: 8px; padding: 1rem; overflow-x: auto; }
    code[class*="language-"], pre[class*="language-"] { font-size: .95em; }
    .token.comment,.token.prolog,.token.doctype,.token.cdata { color: #6a737d; }
    .token.punctuation { color: #24292e; }
    .token.property,.token.tag,.token.boolean,.token.number,.token.constant,.token.symbol { color: #005cc5; }
    .token.selector,.token.attr-name,.token.string,.token.char,.token.builtin { color: #032f62; }
    .token.operator,.token.entity,.token.url,.token.variable { color: #d73a49; }
    .token.atrule,.token.attr-value,.token.keyword { color: #d73a49; }
    .token.function,.token.class-name { color: #6f42c1; }
    .token.regex,.token.important { color: #e36209; }
    eqn, .katex-display { display: block; text-align: center; margin: 1.25rem auto; overflow-x: auto; overflow-y: hidden; }
    eqn > .katex, .katex-display > .katex { text-align: center; }
    .compact-lines p { margin: 0.2rem 0; }
  </style>
</head>
<body>
<header class="site-header">
  <nav>
    <a class="site-title" href="/"><img class="site-avatar" src="https://github.com/syswraith.png" alt="syswraith avatar"><strong>syswraith</strong></a>
    <a href="/projects/">Projects</a>
    <a href="/blogs/">Blog</a>
    <a href="https://syswraith.com/notes">Notes</a>
  </nav>
  <hr class="site-rule">
</header>
<main class="content${mainClass}">
${body}
</main>
<footer class="site-footer">
  <hr class="site-rule">
  <nav aria-label="Footer links">
    <a href="https://github.com/syswraith">GitHub</a>
    <a href="https://youtube.com/@syswraith">YouTube</a>
    <a href="https://x.com/syswraith">Twitter</a>
    <a href="mailto:syswraith@proton.me">Email</a>
  </nav>
</footer>
</body>
</html>`;
  });

  return {
    dir: {
      input: "content",
      output: "_site"
    },
    markdownTemplateEngine: false,
    htmlTemplateEngine: false
  };
}
