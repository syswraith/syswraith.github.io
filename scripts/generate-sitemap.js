import fs from "node:fs";
import path from "node:path";
import { crawlSite } from "@geosuite/sitemap-builder";

const siteUrl = (process.env.SITE_URL || "https://syswraith.com").replace(/\/+$/, "");
const outDir = path.resolve("_site");
const notesUrl = new URL("/notes/", siteUrl).href;
const notesOrigin = new URL(notesUrl).origin;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function toUrl(file) {
  let rel = path.relative(outDir, file).split(path.sep).join("/");
  if (!rel.endsWith(".html")) return null;
  if (rel === "404.html") return null;
  if (rel.endsWith("/index.html")) rel = rel.slice(0, -"index.html".length);
  else if (rel === "index.html") rel = "";
  else rel = rel.replace(/\.html$/, "");
  const urlPath = rel ? `/${rel}` : "/";
  return `${siteUrl}${urlPath}`;
}

function inNotesScope(parsed) {
  return (
    parsed.origin === notesOrigin &&
    (parsed.pathname === "/notes" || parsed.pathname.startsWith("/notes/")) &&
    !parsed.pathname.endsWith(".html")
  );
}

function isNotesUrl(url) {
  return inNotesScope(new URL(url));
}

async function crawlNotes() {
  const scopedFetch = (input, init) => {
    const raw = typeof input === "string" ? input : input.url ?? String(input);
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return new Response("", { status: 204, headers: { "content-type": "text/html" } });
    }
    if (!inNotesScope(parsed)) {
      return new Response("", { status: 204, headers: { "content-type": "text/html" } });
    }
    return fetch(input, init);
  };

  try {
    const { pages } = await crawlSite(notesUrl, {
      maxPages: 200,
      maxDepth: 6,
      concurrency: 4,
      perPageTimeoutMs: 8000,
      deadlineMs: Date.now() + 30_000,
      fetch: scopedFetch,
    });
    return pages.map((page) => page.url).filter(isNotesUrl);
  } catch (error) {
    console.warn(`Could not crawl ${notesUrl}: ${error.message}`);
    return [];
  }
}

const notesUrls = await crawlNotes();
const urls = [...new Set([...walk(outDir).map(toUrl), ...notesUrls].filter(Boolean))].sort();
const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`)
  .join("\n")}\n</urlset>\n`;

fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
fs.writeFileSync(
  path.join(outDir, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`
);

console.log(`Generated sitemap.xml (${urls.length} URLs, ${notesUrls.length} from /notes/) and robots.txt`);
