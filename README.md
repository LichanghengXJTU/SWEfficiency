# SWEfficiency (website)

Our website to introduce our work in SWEfficiency.

- Live site: https://LichanghengXJTU.github.io/SWEfficiency
- Repo: https://github.com/LichanghengXJTU/SWEfficiency
- Paper: TBD

## Overview
SWEfficiency Website provides:
- A Leaderboard and descriptive sections (Features, Criteria, Results, Analysis, Examples)
- A Non‑LLM Benchmark to compare performance Before/After human‑expert patches on real‑world repos

## Leaderboard
A dynamic leaderboard rendered from `assets/data/leaderboard.json` (placeholder data). Update this JSON to populate the table.

## Features (placeholder)
High‑level capabilities and value propositions shown on the homepage. Data loaded from `assets/data/features.json`.

## Criteria (placeholder)
Describes evaluation criteria (with media). Content sourced from `assets/data/criteria_results.json` → `criteria` section.

## Results (placeholder)
Describes result highlights (with media). Content sourced from `assets/data/criteria_results.json` → `results` section.

## Analysis (placeholder)
Foldable analysis notes, loaded from `assets/data/analysis.json`.

## Examples (placeholder)
Flip‑style example cards. Content loaded from `assets/data/examples.json`.

## Run SWEfficiency (placeholder)
A future section to present quick‑start snippets/commands to run components or reproduce results.

## Non‑LLM Benchmark
Provide an instance ID / GitHub PR URL / Docker image URL and your benchmark workload code to measure and compare performance Before/After the human patch.
- Helper: the page integrates a local Helper for secure execution
- Docker: includes a local Docker availability check
- Submit: records locally; optional upload to a public dataset (via GitHub Device Flow)

Go to the Non‑LLM Bench: `bench.html` (or use the "Go to Non‑LLM Bench" button on the homepage Platforms section)

## Helper (macOS)
The Helper is a small local service used by the Non‑LLM Bench to run Docker jobs securely on your machine.

Learn more: `helper.html`

## License (placeholder)
Replace this section with the actual license details used by the project.
