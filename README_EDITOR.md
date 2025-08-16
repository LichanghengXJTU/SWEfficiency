# README for Editors (Content & Data Updates)

This document explains how to update site content without touching code logic. It covers:
- Where to edit data
- Field meanings and how to fill them
- Whether items auto-appear when added
- How to replace placeholders in pages
- Where to place images and how sizing works
- Common notes to avoid mistakes

---

## 1) Index (homepage)
File: `index.html`

What to edit:
- Hero (title, description, authors, CTA links)
  - Title: inside `<div class="brand">…</div>`
  - Description: `<div class="desc">…</div>`
  - Authors: `<div class="brand-authors">…</div>`
  - CTA buttons: GitHub/Paper/Dataset links inside the `.cta-row`
- KPI strip (Tasks / Agents / Best Mean Speedup / Best Pass Rate)
  - Find the four KPI cards under "Performance, Measured." and replace `tbu` with numbers
- Sections backed by JSON (Features, Criteria, Results, Analysis, Examples)
  - These render dynamically; DO NOT hardcode cards here
  - Data files live under `assets/data/` (see section 3 below for JSON schemas)
- Platforms section
  - The "Learn more about Helper" link points to `helper.html` (edit that page’s text directly if needed)

Placeholders to replace on index:
- Comments marked `<!-- TODO: ... -->` indicate copy that should be finalized (titles, descriptions, counts, links)
- Replace only the visible text inside the indicated elements; do not change classes/ids

Images used on index:
- The site logo is at `assets/images/logo.png` (replace file to update the logo)

Auto-add behavior:
- Index reads JSON for Features, Criteria, Results, Analysis, and Examples
- Adding items to those JSON files automatically adds cards/tabs on the homepage (no extra HTML needed)

---

## 2) Leaderboard
Files:
- Page: `leaderboard.html`
- Data: `assets/data/leaderboard.json`

Replace placeholders in the page:
- Title and supporting texts are already generic; main content is from JSON
- If needed, adjust the small copy in the "Contribute" card

Data file schema (`assets/data/leaderboard.json`):
```json
{
  "criteria": [
    {
      "id": "c1",
      "name": "Time Improvement",
      "columns": ["Rank", "Model", "Language", "Tasks", "Score", "Date"],
      "rows": [
        [1, "Agent-X", "Python/C++", 50, "1.42×", "2025-08-13"],
        [2, "Agent-Y", "Python/C++", 50, "1.15×", "2025-08-13"]
      ]
    }
  ]
}
```
Field meanings:
- `criteria`: array of leaderboard tabs
  - `id`: unique id (used in hash routing)
  - `name`: tab button display name, referring to real criteria
  - `columns`: table headers (first column is usually Rank)
  - `rows`: array of rows (arrays aligned with `columns`)

Formatting:
- Numeric cells can be plain numbers (for Tasks), percentages (e.g., `78%`) or speedups (e.g., `1.42×`)
- Language cells are rendered as badges if header includes the word "Language"

Auto-add behavior:
- Adding a new object to `criteria` creates a new leaderboard
- Changing `columns`/`rows` re-renders table automatically

Images:
- Leaderboard has no image assets

Common notes:
- Keep `id` unique per criterion
- Ensure each `row` has the same number/order of columns as `columns`

---

## 3) Homepage Data Sections (JSON)
Folder: `assets/data/`

### 3.1) Features
File: `assets/data/features.json`
```json
{
  "media": {
    "basePath": "assets/images/features/",
    "defaultRatio": 0.35,
    "minSide": 120,
    "maxSide": 400
  },
  "items": [
    { "id": "f1", "title": "Feature 1", "body": "Description", "image": "placeholder_f1.png", "ratio": 0.3 }
  ]
}
```
- `items[]` fields:
  - `id`: unique id
  - `title`: feature title
  - `body`: short description
  - `image`: image filename under `media.basePath`
  - `ratio` (optional): approximate target area ratio for image sizing (0–1)
- `media` controls default image sizing and base folder for images
- Auto-add: add/remove items to change cards count automatically

Images: place under `assets/images/features/` (PNG/JPG/SVG) with mentioning the image path in json variable "image".

### 3.2) Criteria & Results (with media)
File: `assets/data/criteria_results.json`
```json
{
  "media": {
    "criteriaBasePath": "assets/images/criteria/",
    "resultsBasePath": "assets/images/results/",
    "defaultRatio": 0.30,
    "minSide": 180,
    "maxSide": 320
  },
  "criteria": [
    { "id": "c1", "label": "c1", "title": "Criterion c1", "body": "Text", "image": "placeholder_c1.png", "ratio": 0.25 }
  ],
  "results": [
    { "id": "c1", "label": "c1", "title": "Result c1", "body": "Text", "image": "placeholder_r1.png", "ratio": 0.25 }
  ]
}
```
- `criteria[]` / `results[]` fields:
  - `id`: unique key (used for tabs and card keys)
  - `label`: short label shown in tabs
  - `title`: card title
  - `body`: description
  - `image`: filename under respective base path
  - `ratio` (optional): image area ratio (overrides `defaultRatio`)
- Auto-add: adding items creates tabs and 3D cards automatically

Images: place under `assets/images/criteria/` or `assets/images/results/` with mentioning the image path in json variable "image".

### 3.3) Analysis (foldable list)
File: `assets/data/analysis.json`
```json
{
  "items": [
    { "id": "a1", "title": "Reason 1", "body": "Text" }
  ]
}
```
- `items[]` fields:
  - `id`: unique id
  - `title`: header text of a foldable card
  - `body`: content shown when expanded
- Auto-add: each item becomes one foldable card

### 3.4) Examples (flip cards)
File: `assets/data/examples.json`
```json
{
  "examples": [
    {
      "id": "eg1",
      "title": "Title",
      "lang": "Python",
      "meta": {
        "task": "PR repo #id",
        "instance_id": "org__repo-123",
        "repo_url": "https://github.com/...",
        "commit": "sha"
      },
      "workload": "plain text of workload code",
      "humanPatch": "plain text or diff",
      "criteriaList": [ {"id":"c1","name":"c1"} ],
      "models": [
        {
          "name": "Agent-X",
          "status": "Success|Failure|Untest",
          "llmPatch": "plain text",
          "analysis": "plain text",
          "criteriaScores": { "c1": "Pass|Fail|+x.x%|-x.x%" }
        }
      ]
    }
  ]
}
```
- Fields:
  - Top-level `examples[]` → each becomes a flip card with tabs/controls
  - `meta.*` shown as meta text (task, instance id, repo link, commit)
  - `criteriaList` defines selectable criteria for scoring chips
  - `models[]` defines model-specific LLM patch/analysis and per-criterion scores
- Auto-add: more `examples[]` creates more flip cards automatically
- This is highly related to leaderboard: if an agent is not tested in one criteria, it will not display that citeria when choosing that agent.

---

## 4) Bench (Non‑LLM Bench page)
Files:
- Page: `bench.html`
- Logic: `assets/bench.js` (no data JSON here)

To mention, when user submit their data, we can see it on `https://github.com/LichanghengXJTU/SWEf-data` 's pull request. The link can be changed easily by changing some simple variables in the future.
---

## 5) Replacing Placeholders (summary)
- Replace text-only placeholders directly in `index.html` and `leaderboard.html` where marked by `<!-- TODO: ... -->`
- For data-driven sections (Features / Criteria / Results / Analysis / Examples / Leaderboard), edit the corresponding JSON files under `assets/data/`
- Adding items to JSON automatically adds cards/tabs (no HTML edits required)

---

## 6) Images: placement & sizing
- Place images here:
  - Features: `assets/images/features/`
  - Criteria: `assets/images/criteria/`
  - Results: `assets/images/results/`
- Refer to them by filename in the JSON
- Sizing controls:
  - Use `ratio` on an item to hint target area fraction (0–1) relative to the card
  - Global bounds set via `media.defaultRatio`, `media.minSide`, `media.maxSide`
  - The bounds are more previlege compared to the ratio.

---

## 7) Common Notes
- Keep ids (`id` fields in JSON, element ids in HTML) stable; code depends on them for routing/states
- Avoid renaming or removing container elements with specific ids/classes used by scripts (e.g., `criteria-tabs`, `results-deck`)
- JSON must be valid UTF‑8 encoded JSON (no trailing commas); if editing on Windows, ensure LF line endings if possible
- For Links: always include full `https://` URLs
- For Percentages/speedups: format like `78%`, `1.42×` (the site recognizes `%` and `×`) 