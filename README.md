# ⚽ World Cup 2026 Live — Scores, Sweeps & a Spinning Trophy

A single-page live scoreboard for the 2026 FIFA World Cup, built for two family
sweepstakes leagues (**Hoogies** and **Shrunk**) and hosted on GitHub Pages.
No backend, no build step, no framework. One HTML file, one trophy, one PDF of
extremely serious competition rules.

Open it, tap your league, pick your name, and watch your duds let you down in
real time against a field of twinkling gold stars.

## What it does

- **Live scores** for every match, auto-refreshing every 30 seconds while games
  are in play (60s otherwise, paused when the tab is hidden)
- **Goal flash** — cards pulse green with a GOAL badge the moment a score changes
- **Tap any match** to expand goalscorers and cards, pulled per game on demand
- **Mini calendar** locked to the tournament window (11 June – 19 July), with
  dots on match days that follow whatever filter you have active
- **Kickoff times twice over** — your local time (auto-detected from the
  browser) and the venue's local time, mapped across all 16 host cities
- **Group tables** for all twelve groups
- **Knockout bracket** from the Round of 32 to the Final, filling itself in as
  the draw is decided, flags front and centre, winner crowned at the end
- **Two sweep leagues**, draws hardcoded and locked:
  - **Hoogies** — 42 registrants, one Golden Pot and one Sh\*t Pot team each,
    straight from the Competition Charter (linked in-app as `charter.pdf`)
  - **Shrunk** — five members, Best and Dud picks, ranked live on sweep points
    (**win +2, draw +1, loss −1**)
- **Member picker** — choose any player and the whole site becomes their
  personal fixture list: matches, calendar dots, the lot. Players in both
  leagues see all their teams combined
- **League-scoped tags** — member chips on match cards and the bracket only
  show names from the league you've opened, so nobody wades through 42
  strangers from the other draw
- **A rotating 3D World Cup trophy** (GLB model) floating in a gold starfield,
  with a procedural fallback trophy if the model can't load

## The files

```
├── index.html      ← the entire app (rename from wc2026-live-scores.html)
├── trophy.glb      ← the 3D trophy model (~1.9 MB)
├── charter.pdf     ← the Hoogies Competition Charter
└── README.md       ← you are here
```

That's it. Drop all of them in a GitHub Pages repo and you're live.

## How it works

### Data

Everything comes from ESPN's public (undocumented) endpoints — no API key,
permissive CORS, fetched straight from the browser:

| Endpoint | Used for |
|---|---|
| `.../fifa.world/scoreboard?dates=YYYYMMDD` | The day's matches, live clocks, scores |
| `.../scoreboard?dates=start-end` | Month fixtures for calendar dots, knockout results for the bracket and eliminations |
| `.../summary?event={id}` | Goalscorers and cards when a card is expanded |
| `.../standings?season=2026` | Group tables, team index, group letters for badges |

A quirk worth knowing: ESPN buckets its "days" by **US Eastern time**. The app
follows the same bucketing, so the default view is ESPN's current matchday,
not the browser's local date. For viewers in Australia that means the games
still in play (local yesterday) show first, instead of skipping ahead to
fixtures that haven't started. Kickoff *times* are still always rendered in
the viewer's own timezone.

### Architecture

Vanilla JavaScript in one inline script, organised in sections:

- **State + helpers** — date handling, ESPN day bucketing, host-city timezone
  map, HTML escaping
- **Match rendering** — cards, badges, sweep chips, goal-diff detection
- **Calendar** — month fetch cached per month, dots filtered by team search,
  member selection and starred favourites
- **Groups / Bracket / Sweeps** — lazy-loaded tabs sharing the standings and
  knockout fetches
- **Sweeps engine** — both draws are hardcoded constants (`HOOGIES_DRAW`,
  `SHRUNK_DRAW`), resolved to ESPN team IDs at runtime by normalised name
  matching with aliases for the tricky ones (Türkiye, Czechia, Ivory Coast,
  Curaçao, Cape Verde, DR Congo, Bosnia and Herzegovina…)
- **Three.js background** — layered gold starfield with per-star twinkle,
  GLTFLoader for the trophy, responsive placement so the trophy stays in
  frame on any aspect ratio, reduced particle counts and pixel ratio on phones

Light state (starred teams, chosen league, selected member) persists in
`localStorage` with an in-memory fallback. The sweep draws themselves are
locked in the code — every visitor sees the identical official draws.

### Performance notes

- Polling backs off when nothing is live and stops entirely in hidden tabs
- Calendar and knockout fetches are cached for the session
- On phones: ~55% fewer particles, pixel ratio capped at 1.5, antialiasing
  off, backdrop blur disabled
- Respects `prefers-reduced-motion` (static starfield, no goal-flash strobe)

## Customising

| Want to… | Look for |
|---|---|
| Change sweep scoring | `sweepPoints()` |
| Edit a draw | `HOOGIES_DRAW` / `SHRUNK_DRAW` |
| Link two player names as one person | `MEMBER_ALIASES` |
| Move or resize the trophy | `positionTrophy()` |
| Swap the trophy | replace `trophy.glb` (auto-centred and scaled) |
| Adjust colours | CSS variables in `:root` |
| Re-tune refresh rates | `scheduleNext()` |

## Credits

Built by **Shrunk Innovation Group Pty Ltd** over a series of very productive
sessions during the group stage. Match data courtesy of ESPN's quietly
excellent public feeds. Trophy model via Sketchfab.

The Soccer Sucks Award remains, at time of writing, unclaimed.
