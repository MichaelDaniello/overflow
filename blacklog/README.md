# BLACK LOG — solo pirate-horror campaign cockpit

A **local-first** solo GM engine, ship tracker and campaign journal for dark
pirate RPGs. No backend, no accounts, no cloud — everything lives in your
browser (IndexedDB). It's a GM oracle + ship/clock/thread tracker + auto
journal, not a VTT.

> All tables, names and flavor text are **original** to Black Log. No
> third-party RPG text or art is reproduced.

## Play

Bootable from the OVERFL0W terminal with the `blacklog` command (alias `log`),
or open the built app directly:

```
blacklog/dist/index.html
```

## Stack

Vite · React + TypeScript · Tailwind CSS · Dexie (IndexedDB) · Zod ·
`dexie-react-hooks` · React Router (HashRouter) · lucide-react icons.

## Dev

```
cd blacklog
npm install
npm run dev        # local dev server
npm run build      # type-check + build into dist/
```

### Deploy

The repo's GitHub Pages site builds nothing, so the **built `dist/` is
committed** and served as static files (Vite `base: './'` makes it
portable under any sub-path). After changing source, run `npm run build`
and commit the updated `dist/`.

## v0.1 features

- Campaign create / load / delete, persisted in IndexedDB
- Dashboard cockpit (responsive; stacks on mobile)
- Scene manager (start/end, location, danger; log entries attach to the scene)
- Oracle (d20 ladder: *No, and … Yes, and*) with your own interpretation
- Dice roller (`d20`, `2d6`, `1d20+2`, `3d6-1`, `d66`, `d100` + quick buttons)
- Campaign log (typed entries, manual notes, newest/oldest toggle)
- Ship tracker (hull/crew/morale/supplies/plunder, cargo, curses)
- Threat clocks (4/6/8/10/12 segments, tick/complete/reset)
- Threads (weighted, with a random "pull")
- Crew & NPC tracker (roles, disposition, secrets, dead/missing, generator)
- JSON random-table engine with nested `{{table}}` expansion + original core pack
- Markdown export (per-campaign and all-campaigns)

## Layout

```
src/
  types.ts            models + Zod schemas
  db.ts               Dexie database + repositories
  data/coreTables.ts  the original nautical-horror table pack
  lib/                dice · oracle · tables · markdown · util
  ui.tsx              reusable components (Panel, Button, Modal, …)
  pages/              CampaignList · Dashboard · Settings
  panels/             Scene · Oracle · Dice · Log · Ship · Clocks · Threads · Crew · Generators
```
