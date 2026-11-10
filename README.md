# Updating the dashboard

This folder is the website and a git repository (github.com/brandon-wca/suspensions-dashboard). A push to `main` publishes the site through Netlify within a minute or two. The numbers are not changed here; see `../update_data_here/README.md`.

**Don't touch the files in this folder unless you are authorized to update the dashboard and know what you are doing.** `charts.js` and `styles.css` in particular: a small mistake in either breaks the whole page. If in doubt, ask Brandon.

## Who makes changes

Ask Claude first; do it yourself as the fallback. Claude will name the kind of change (the scenarios below), say what it will touch, ask what it needs, make the change, check the page, log it, and show you before anything is published. A Cowork session can edit files but can't move, delete, commit or push; Claude Code can. Each scenario below gives the Claude path, then "Yourself" for doing it by hand.

## Where things are

| To change… | Edit |
|---|---|
| Words: titles, commentary, captions, the bill's cards, "What you can do", "About the data" | `index.html`. Numbers inside sentences are `<span data-fill="…">` tags that `charts.js` fills from `data/data.json`; don't type numbers from the data into the text. |
| A chart | `charts.js`, the function for that chart (`drawGroups`, `drawDaysByRace`, `drawPathSteps`). Which groups a chart shows is set in `../update_data_here/build_data.py`. |
| The map and its side panel | `charts.js`, section 4. The map's color steps are set in the script (`RATE_STEPS`). |
| Part 1's drawings (the children, the school, the home) | `index.html`, the Drawings block at the top. They were drawn for this dashboard; their colors are in `styles.css`. |
| Colors, font, spacing, layout | `styles.css`. WCA's colors and font are defined once at the top (part A), this dashboard's colors right under them (part A2); everything else refers to them by name. |

## The scenarios

**2. Text: wording, grammar, logic, sources.** Tell Claude which passage, what it should say instead (or let Claude draft it), and why. Claude fixes grammar as it goes unless you say not to, keeps numbers as `data-fill` tags, updates "About the data" and the source lines together when a source changes, and shows old and new text side by side before committing. *Yourself:* edit `index.html`, preview (below), log, commit, push.

**3. New indicator, or layout, color or design change.** Always a code change. For an indicator, tell Claude which measure, from which table and column, where it goes (map, chart or headline) and what it is compared with; for design, what exactly and where (a screenshot helps). Claude checks the data supports it first (if not, it becomes a data change plus a script change), lists every file it will touch, checks any new color for color-blind readers, builds it, and shows screenshots at desktop and phone width. *Yourself:* not recommended without code experience; at minimum follow the "Where things are" table, preview, log, commit, push.

**4. Under construction.** Two options, both done by a person in a minute. *Freeze* (the live site stays as it is while work continues): Netlify → Deploys → "Stop auto publishing"; undo it with "Start auto publishing" when done. *Hide* (visitors see a holding page): replace `index.html` with a one-paragraph "temporarily unavailable" page, commit and push; restore the real file from git afterwards. Password-protecting the site needs Netlify's paid plan. Claude's role: remind you which option fits, and restore afterwards.

**5. A library or component fails** (the page loads but charts or the map don't draw, or the browser shows errors). Tell Claude what you see and where. Claude reads the browser's error messages, reproduces the problem, names the cause only with evidence (the error text, what triggers it), proposes the smallest fix (usually one file in `resources/`), shows before and after, and waits for your approval. If it can't reach confidence it says so. *Yourself:* restore the last working version from git (scenario 10).

**6. The dashboard is slow.** Claude measures first (file sizes, load time, where the browser spends its time), reports the numbers, and proposes fixes ranked by gain and risk. Nothing changes without approval. The district outlines (`data/Geography.json`) are already a lighter copy, about 170 KB; how light is a setting in the script (`MAP_SIMPLIFY_TOLERANCE`).

**7. GitHub or Netlify problems; accounts and ownership.** *Instructions to come from Brandon.* Headings to fill in: Netlify build failed (read the deploy log in Netlify → Deploys); the site isn't updating after a push (check which branch Netlify deploys and that auto publishing is on); a push is rejected (pull first, or check branch protection); accounts and access (who owns the GitHub repository and the Netlify site, how to add a colleague, moving the repository to a WCA organization, the custom domain, making the repository private). Claude's role: read the deploy log and explain it; the fixes are done by a person.

**10. Restore a previous version of the page.** Git holds every version. Ask Claude Code to restore a file or the whole folder to a named commit, or in GitHub Desktop open History, pick the commit, and revert. Data restores are in `../update_data_here/README.md`.

## Steps, whoever makes the change

1. Make the change (Claude, or yourself per the scenario).
2. Look at it. Browsers won't load the data files straight from a folder, so from this folder run `python -m http.server 8000` and open `http://localhost:8000/`. Check a wide window and a narrow one (phone).
3. Add a line to `CHANGELOG.md`: date, who, what, why. Claude writes it when Claude made the change, naming who asked.
4. Commit with a one-line message saying what changed, then push to `main`. (Once the review process is set up: open a pull request instead and merge after review.)
5. Check the live site after Netlify finishes.

## The change log

`CHANGELOG.md` gets a line for every change to this folder that is committed: words, charts, styling, data files, documentation. Git keeps the full detail (`git log`, or the Commits tab on GitHub); the change log is the plain-language summary.
