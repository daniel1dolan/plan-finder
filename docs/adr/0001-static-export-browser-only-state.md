# Static-export Next.js; all comparison state lives in the browser

Plan Finder is meant to become a public page that anyone can use, and people type their health plan and premium numbers into it. We use Next.js (for consistency with Daniel's other projects) but lock it to `output: 'export'`, so the build is a static `out/` folder with no server. The build then fails if anyone adds server-only features. A comparison lives only in the browser: it auto-saves to local storage, and a share link encodes it in the URL fragment (`/#c=...`). Browsers never send the fragment to the host, so plan numbers stay out of request logs, and the app can be hosted on any static host.

## Considered Options

- **Vite + React SPA**: leaner for a single static page; we chose Next.js to match the stack Daniel already uses.
- **Default (server) Next.js**: adds nothing this app needs, and makes it easy to drift into server code that breaks "deploy anywhere" and "data never leaves the browser."
- **Query-string share links (`?c=`)**: the host receives them on every request, and they need `useSearchParams` + Suspense under static export.
- **Accounts / cloud-saved comparisons**: auth and a database for a tool people use about once a year.

## Consequences

- Once share links circulate, their encoding is a public contract. The payload carries a version, and old versions must keep decoding.
- No API routes, middleware, or server components that fetch data. Any future feature that truly needs a server has to supersede this ADR.
