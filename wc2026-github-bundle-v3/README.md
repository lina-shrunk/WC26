# World Cup 2026 — Australia Viewing Guide (auto-updating on GitHub)

A single-page World Cup 2026 schedule in Australian time zones, with group standings
and a knockout bracket. A scheduled GitHub Action pulls **finished** match scores from
[football-data.org](https://www.football-data.org/) every two hours and writes them into
`index.html`, so the standings stay current with nobody entering anything.

## Repository layout

Put the three files in exactly this structure:

```
your-repo/
├── index.html                          ← the page (served by GitHub Pages)
├── scripts/
│   └── update-scores.mjs               ← fetches results, writes them into index.html
└── .github/
    └── workflows/
        └── update-scores.yml           ← runs the script on a schedule
```

## One-time setup

1. **Create the repo.** On GitHub, click **New repository**, name it (e.g. `world-cup-2026`),
   make it **Public**, and create it. Add the three files above — easiest via **Add file →
   Upload files** in the web UI (create the `scripts` and `.github/workflows` folders by typing
   the path into the filename when you create each file).

2. **Get a free API token.** Register at <https://www.football-data.org/client/register>.
   After confirming your email, copy your **API token** from your account page.

3. **Store the token as a secret.** In the repo: **Settings → Secrets and variables →
   Actions → New repository secret**.
   - Name: `FOOTBALL_DATA_TOKEN`
   - Value: *(paste your token)*

4. **Allow the Action to commit.** **Settings → Actions → General → Workflow permissions →**
   select **Read and write permissions → Save**.

5. **Turn on GitHub Pages.** **Settings → Pages → Build and deployment → Source:**
   **Deploy from a branch**, branch **main**, folder **/(root)**, **Save**.
   After a minute your live URL appears, e.g. `https://YOURNAME.github.io/world-cup-2026/`.

6. **Run it once now.** **Actions** tab → **Update World Cup scores** → **Run workflow**.
   It fetches any finished matches and commits them. (It also runs automatically every 2 hours.)

That's it — open your Pages URL and pick your city. Standings fill in on their own as matches finish.

## How it works

- `update-scores.mjs` reads the 72 group fixtures already defined in `index.html`, matches each
  finished result from the API to the right fixture **by team names** (it handles spelling
  differences like *United States → USA*, *Korea Republic → South Korea*, *Türkiye → Turkey*),
  and rewrites the small `const RESULTS={…}` block near the top of the page's script.
- The page merges those auto-pulled results as the baseline. Any group score a viewer types in
  their own browser still takes precedence locally (saved in their browser only) — handy if the
  feed lags behind a final whistle.
- **The knockout bracket fills itself in.** Once a group's matches are done, its winner and
  runner-up drop into the Round of 32; once every group finishes, the eight best third-placed
  teams are slotted into their bracket positions; and as knockout results arrive, the winner of
  each match advances to the next round (penalty-shootout winners handled too). Scores show on
  each bracket card.
- The script records knockout results by kickoff time (each knockout match has a unique slot),
  and group results by team name. Third-place teams are placed respecting FIFA's allowed-group
  rules for each slot; in rare combinations the exact slot may differ from FIFA's published
  table, but the qualifying teams and bracket integrity are always correct.

## Notes & troubleshooting

- **No matches played yet?** `RESULTS` stays empty and every group table reads 0 — that's correct
  until the tournament starts (12 June 2026 AEST).
- **A result didn't appear?** Check the workflow run log under the **Actions** tab. If a team
  name from the API isn't recognised it's logged as "Could not map (skipped)"; tell me the names
  and I'll add the alias.
- **football-data.org free tier** allows ~10 requests/minute — far more than this needs.
- Times use Australian **standard** time (AEST/ACST/AWST). Australia has no daylight saving in
  June–July, so no DST handling is required.
- This is an unofficial fan guide. Fixture data was cross-checked against the FIFA fixture list.
