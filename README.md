# Plan Finder

Compare health plans by what they'd cost you over a year. Enter each plan's premium, deductible,
coinsurance, OOP max and any employer HSA/HRA contribution, and Plan Finder charts annual cost
against care cost, names the cheapest plan for every range of care cost, and shows a breakdown at
your expected care cost.

It's a static site: everything runs in the browser. The comparison auto-saves to local storage,
and share links carry it in the URL fragment (`/#c=…`), so plan numbers never reach a server. See
[ADR 0001](docs/adr/0001-static-export-browser-only-state.md). Domain terms are defined in
[CONTEXT.md](CONTEXT.md).

## Develop

Requires [Bun](https://bun.sh) (1.4+) and Node 24.

```sh
bun install
bun dev          # http://localhost:3000
bun test         # engine, share codec, flock and copy helpers
bun run typecheck
bun run lint
bun run check    # all of the above plus the build
```

## Build and serve

```sh
bun run build    # static export to out/
bun run preview  # serves out/ at http://localhost:4173 (python3 http.server)
```

`out/` can be deployed to any static host.

## Layout

- `src/engine/`: pure cost engine (validation, costs, cheapest ranges, chart sampling)
- `src/share/`: versioned share-link codec, auto-save and load order. The v1 payload is a public
  contract: add a new version alongside it rather than changing it.
- `src/flock.ts`: the starling simulation behind the chart's roosting birds
- `src/copy.ts`: all explanatory copy and term popovers
- `src/components/`: React UI
