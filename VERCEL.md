# Blockbench, deployed on Vercel

The editor runs in the browser and the site is served by a Rust function on the
official Vercel Rust runtime. One origin, one deployment.

## How a request is answered

Vercel builds `src/main.rs` and asks `@vercel/rust` for a route table. For a
project that depends on `vercel_runtime`, that table is:

```
{ handle: "filesystem" }              → serve a matching file from public/
{ src: "/(.*)", dest: "/src/main" }   → everything else goes to the function
```

So the CDN answers every static request first, and Rust only sees paths that no
file backs. That split is what keeps the multi-megabyte editor bundle away from
the 4.5 MB function payload limit, a limit that applies to request and response
bodies, not to a function's package size (250 MB).

| Path | Served by |
| --- | --- |
| `/` | `public/index.html`, the download page |
| `/app/` | `public/app/index.html`, the editor |
| `/dist/bundle.js`, `/css/*`, `/font/*`, `/lang/*` | static files |
| `/api/blockbench/health` | Rust |
| `/api/blockbench/version` | Rust |
| `/api/blockbench/chat` | Rust, proxying Anthropic |
| anything else | Rust, which redirects to `/app/` |

## Build

`vercel.json` runs `npm ci && node scripts/vercel_build.mjs`, which:

1. writes `build-info.json` (version, commit, download links);
2. switches `index.html` to the web bundle and builds `dist/bundle.js`;
3. assembles `public/` from an explicit list of directories and files.

An explicit list matters: everything inside `public/` becomes a URL, so copying
the repository root would expose sources, CI configuration and `node_modules`.

Locally, the same output is produced with:

```bash
npm ci
node scripts/vercel_build.mjs
npx vercel dev
```

## Deploying

The project is connected to the repository, so a push deploys. To deploy a
preview without a push, use the Vercel connector or `vercel deploy`.

Without a custom domain the site is served at the project's `.vercel.app`
address. Custom domains are configured in the Vercel dashboard or through the
connector; nothing in this repository depends on the hostname.

## The chat endpoint

`/api/blockbench/chat` forwards a conversation to Anthropic and returns the
reply unchanged, so the browser never holds the API key. It is disabled until
`ANTHROPIC_API_KEY` is set on the project; without it the endpoint answers 503
and the page leaves the chat control out.

Optional: `ANTHROPIC_MODEL` overrides the model, which defaults to
`claude-sonnet-4-20250514`.

## Windows 7

The desktop build in this repository is unchanged by the deployment: the same
commit produces the Windows 7 installer through GitHub Actions. The landing page
links to the newest successful run of that workflow, so it can never advertise a
build that failed.

## Files

| Path | Purpose |
| --- | --- |
| `Cargo.toml` | Rust crate and the release profile from Vercel's docs |
| `src/main.rs` | Route table handling, JSON API, chat proxy |
| `publisher/index.html` | Download page, the site root |
| `publisher/site.js` | Generated data the download page renders |
| `scripts/site.mjs` | Writes `build-info.json` and `publisher/site.js` |
| `scripts/vercel_build.mjs` | Build command; assembles `public/` |
| `vercel.json` | Framework, build command, output directory, cache headers |
