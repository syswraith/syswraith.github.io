import { extract } from "@extractus/oembed-extractor";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import markdownItTexmath from "markdown-it-texmath";
import katex from "katex";
import slugify from "@sindresorhus/slugify";
import fs from "node:fs";
import path from "node:path";

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
    return dir ? `/${dir}/${slug}/index.html` : `/${slug}/index.html`;
  });

  eleventyConfig.addPassthroughCopy({ "public/css/water-light.css": "css/water-light.css" });
  eleventyConfig.addPassthroughCopy({ "public/css/katex.min.css": "css/katex.min.css" });
  eleventyConfig.addPassthroughCopy({ "public/fonts": "fonts" });
  eleventyConfig.addPassthroughCopy({ "public/.nojekyll": ".nojekyll" });
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
    const title = this.page.fileSlug === "" ? "Home" : this.page.fileSlug;
    const mainClass = "";
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/water-light.css">
  <link rel="stylesheet" href="/css/katex.min.css">
  <style>
    :root { --content-width: 860px; }
    body { max-width: var(--content-width); padding: 0.5rem 1.25rem 2.5rem; }
    .site-header, .site-footer { text-align: center; margin: 0 auto; padding: 0; }
    .site-header { padding-top: 0; }
    .site-footer { color: var(--text-muted); border-top: 0; }
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
    <a href="/blogs/">Blogs</a>
    <a href="/ctfs/">CTFs</a>
    <a href="/braindev/">Braindev</a>
    <a href="/useful/">Useful</a>
    <a href="/reading/">Reading</a>
    <a href="/watching/">Watching</a>
    <a href="https://syswraith.com/notes">Notes</a>
  </nav>
  <hr class="site-rule">
</header>
<main class="content${mainClass}">
${body}
</main>
<footer class="site-footer">
  <hr class="site-rule">
  <p><small><a href="https://syswraith.com">syswraith.com</a> &copy; Aryan Karekar</small></p>
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
