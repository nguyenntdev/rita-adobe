# Deployment — Cloudflare Pages

Yes — RITA Adobe can be deployed to Cloudflare Pages. It is a static Vite SPA (the build emits plain HTML/CSS/JS into `dist/`), which is exactly what Pages serves. There is no server-side runtime, so no Workers/Functions are required.

## Build settings

When connecting the repository in the Cloudflare dashboard (**Workers & Pages → Create → Pages → Connect to Git**), use:

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | Vite            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Node version           | `20` (or newer) |

`npm run build` runs `tsc -b && vite build`, so a type error will fail the deploy — that's intended.

> **Vite version note:** Cloudflare's Workers build pipeline requires Vite 6+ to auto-configure. This project uses Vite 6, so both the Pages and Workers flows work. If you see `The version of Vite used in the project ("5.x") cannot be automatically configured`, the environment is building against an older checkout — pull the latest commit.

If the build image defaults to an older Node, pin it with an environment variable in the Pages project settings:

```
NODE_VERSION = 20
```

## SPA routing (important)

The app uses client-side routing (React Router). Without a fallback, refreshing or deep-linking to a route like `/account/check` returns a 404 because no such file exists in `dist/`.

This repo includes `public/_redirects`:

```
/*    /index.html    200
```

Vite copies everything in `public/` into `dist/` at build time, so Cloudflare Pages picks this up automatically and serves `index.html` (HTTP 200) for every path, letting the router resolve the route. No extra dashboard configuration is needed.

## Deploy options

**Git integration (recommended):** push to your repo and connect it in the Cloudflare dashboard. Every push triggers a build; pull requests get preview deployments.

**Direct upload with Wrangler:**

```bash
npm run build
npx wrangler pages deploy dist --project-name=rita-adobe
```

## Things to confirm before going live

- **Backend CORS / mixed content** — the app calls `https://api-2026-02.ades.support` and `wss://api-2026-02.ades.support` directly from the browser. Those origins must allow requests from your Pages domain (CORS for HTTP, and the WebSocket endpoint must accept the cross-origin upgrade). Cloudflare Pages serves over HTTPS, so all backend calls must be HTTPS/WSS (they already are).
- **Endpoint configuration** — base URLs are hard-coded in `src/utils/appConfig.ts`. If staging and production need different endpoints, move them to `import.meta.env.VITE_*` variables and set them per-environment in the Pages project before deploying.
- **Access control** — this is internal tooling with no built-in IP/SSO gate. Consider putting it behind **Cloudflare Access** (Zero Trust) so only authorized staff can reach the deployment.
- **Caching** — Vite fingerprints asset filenames, so the default Pages caching is safe; `index.html` is served fresh, hashed assets are cached long-term.

## Verifying the production build locally

```bash
npm run build
npm run preview
```

Then exercise a deep link (e.g. open `/monitor` directly) to confirm routing works before deploying. Note that `vite preview` does not apply the `_redirects` rules — deep-link fallback is validated on Cloudflare Pages itself (or any static host that honors `_redirects`).
