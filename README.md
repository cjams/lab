# lab.connorjdavis.com

Interactive research writeups. Essays stay on Substack (www.connorjdavis.com);
this site hosts the versions with figures you can play with.

Astro + MDX, with React islands for visualizations. Static output, no server.

## Develop

```sh
npm install
npm run dev        # http://localhost:4321, drafts visible
npm run check      # type-check
npm run build      # -> dist/, drafts excluded
```

Requires Node >= 22.12 (pinned in `.node-version`).

## Write a paper

Copy `src/content/papers/anatomy-of-a-writeup.mdx` to a new `<slug>.mdx`. It
appears at `/papers/<slug>/`. Frontmatter: `title`, `subtitle`, `date`,
`abstract`, `substack` (companion post URL), `draft`.

Building blocks:

| Component | Use |
| --- | --- |
| `<Figure width="text\|wide\|full">` | Auto-numbered figure; caption in `<Fragment slot="caption">` |
| `<Sidenote>` | Margin note on desktop, indented aside on mobile |
| `<Scrolly id>` + `<Step>` | Sticky graphic, steps scroll past; active step → `scrollySteps[id]` |
| `$...$`, `$$...$$` | KaTeX math |

Visualizations live in `src/viz/`. Hydrate with `client:visible` so they
only load when scrolled to. Patterns to copy:

- `TemperatureSoftmax` — explorable: controls → derived state → animated marks.
- `AttentionMatrix` — linked views: one hover state drives two SVG views.
- `EmbeddingCloud` — canvas scene: thousands of points, rAF loop, drag to rotate,
  driven by a `Scrolly`. Swap `build()` for real data exported from a notebook.

Colors come from CSS tokens in `src/styles/global.css` (`--c1`…`--c6`, `--ink`,
`--muted`, `--grid`), which switch with light/dark mode. SVG uses `var(--c1)`
directly; canvas reads them through `usePalette()` in `src/lib/palette.ts`.

Cross-island state goes through nanostores (`src/lib/store.ts`).

Data: put large precomputed JSON/binary in `public/data/` and `fetch()` it
from the island, rather than importing it into the bundle.

## Deploy (Cloudflare Pages)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
   Build command `npm run build`, output directory `dist`.
3. Pages project → Custom domains → add `lab.connorjdavis.com`. Cloudflare shows
   a CNAME target (`<project>.pages.dev`).
4. Route 53 → hosted zone `connorjdavis.com` → create record:
   `lab` / CNAME / `<project>.pages.dev`. The Substack records (`www`, apex) are untouched.

Every push to `main` deploys; other branches get preview URLs (handy for drafts).
