import fs from "node:fs";
import path from "node:path";

const siteUrl = (process.env.SITE_URL || "https://syswraith.com").replace(/\/+$/, "");
const outDir = path.resolve("_site");

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

const urls = [...new Set(walk(outDir).map(toUrl).filter(Boolean))].sort();
const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`)
  .join("\n")}\n</urlset>\n`;

fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
fs.writeFileSync(
  path.join(outDir, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`
);

console.log(`Generated sitemap.xml (${urls.length} URLs) and robots.txt`);
