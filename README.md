# blog

Personal blog built with [Eleventy](https://www.11ty.dev/), served from `content/` and generated to `_site/`.

## Requirements

- [Bun](https://bun.sh/) `>= 1.4.5`

## Setup

```bash
bun install --frozen-lockfile
```

## Commands

```bash
bun run dev    # local dev server at http://localhost:8000
bun run build  # production build to _site/
bun run clean  # remove _site/
```

## What this setup includes

- **Eleventy**: Markdown content in `content/`, output in `_site/`, no template engine passthrough for md/html.
- **Slugified URLs**: permalinks and internal `src/href` paths are slugified for clean, lowercase URLs.
- **Embeds**: bare YouTube/X/Twitter/Vimeo URLs are converted at build time via `@extractus/oembed-extractor`; failures fall back to a plain link.
- **Syntax highlighting**: build-time Prism highlighting via `@11ty/eleventy-plugin-syntaxhighlight`.
- **Math**: build-time KaTeX rendering via `markdown-it-texmath` + `katex`, with vendored KaTeX CSS/fonts in `public/`.
- **Styling**: local Water.css Light (`public/css/water-light.css`) and custom shell/layout styles in `eleventy.config.js`.

## Reproducibility

This repo aims for **practical reproducibility**:

- Dependencies are pinned in `package.json` and `bun.lock`.
- Install with `bun install --frozen-lockfile`.
- Build-time embed fetching depends on external oEmbed/network responses, so embed HTML can change if providers change.

## GitHub Pages deployment

Workflow: `.github/workflows/deploy-pages.yml`

1. In GitHub repo settings, set **Pages > Source** to **GitHub Actions**.
2. Push to `main` or run the workflow manually.
3. The workflow installs deps with Bun, runs `bun run build`, uploads `_site/`, and deploys with `actions/deploy-pages`.

### Base path

- For root/custom domain deploys, no `PATH_PREFIX` is needed.
- For a subpath deploy (e.g. `https://syswraith.com/blog/` or project pages), set repo variable `PATH_PREFIX` to `/blog/` (leading and trailing slash). The build uses it to prefix internal links/assets.
