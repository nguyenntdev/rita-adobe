# Deployment — Cloudflare

RITA Adobe is a static Vite SPA (the build emits plain HTML/CSS/JS into `dist/`), with no server-side runtime. It deploys to Cloudflare as a **Workers static-assets** project — the Worker just serves the files in `dist/` and falls back to `index.html` for client-side routes.

## Build settings

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | Vite            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Node version           | `20`+ (CI uses 22) |

`npm run build` runs `tsc -b && vite build`, so a type error will fail the deploy — that's intended.

> **Vite version:** Cloudflare's build pipeline requires Vite 6+ to auto-configure. This project uses Vite 6. If you see `The version of Vite used in the project ("5.x") cannot be automatically configured`, the environment is building against an older checkout — pull the latest commit.

## SPA routing — handled by `wrangler.jsonc` (do NOT use `_redirects`)

The app uses client-side routing (React Router), so deep links like `/account/check` must serve `index.html` rather than 404.

This repo commits a `wrangler.jsonc` that handles it:

```jsonc
{
  "name": "rita-adobe",
  "compatibility_date": "2026-06-02",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  },
  "observability": { "enabled": true }
}
```

`not_found_handling: "single-page-application"` serves `index.html` (HTTP 200) for any unmatched path.

> **Important:** Do **not** add a `public/_redirects` file for this deploy. Workers Assets rejects a catch-all `/* /index.html 200` rule with `Infinite loop detected in this rule` (error 100324). The `not_found_handling` setting above is the Workers-native replacement. (`_redirects` is only the right approach for the older *Cloudflare Pages* product, not Workers static assets.)

## Deploy options

**Git integration (recommended):** connect the repo in the Cloudflare dashboard. Each push builds and deploys; the dashboard runs `npm run build` then `npx wrangler deploy`, which reads `wrangler.jsonc`.

**Direct upload with Wrangler:**

```bash
npm run build
npx wrangler deploy
```

## Things to confirm before going live

- **Backend CORS / WebSocket** — the app calls `https://api-2026-02.ades.support` and `wss://api-2026-02.ades.support` directly from the browser. Those origins must allow requests from your deployed domain (CORS for HTTP; the WebSocket endpoint must accept the cross-origin upgrade). The deployment is HTTPS, so all backend calls must be HTTPS/WSS (they already are).
- **Endpoint configuration** — base URLs are hard-coded in `src/utils/appConfig.ts`. If staging and production need different endpoints, move them to `import.meta.env.VITE_*` variables and set them per-environment before deploying.
- **Access control** — this is internal tooling with no built-in IP/SSO gate. Consider putting it behind **Cloudflare Access** (Zero Trust) so only authorized staff can reach the deployment.
- **Caching** — Vite fingerprints asset filenames, so default caching is safe; `index.html` is served fresh, hashed assets are cached long-term.

## Verifying the production build locally

```bash
npm run build
npm run preview      # Vite's static preview
```

To verify the actual Workers behavior (including the SPA fallback), use Wrangler:

```bash
npm run build
npx wrangler dev     # serves dist/ via the Worker using wrangler.jsonc
```

Then open a deep link (e.g. `/monitor`) directly to confirm routing resolves.
