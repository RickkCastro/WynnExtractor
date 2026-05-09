# WynnExtractor

WynnExtractor extracts complete WynnBuilder/WynnBuilder Beta build data into structured JSON. It opens the build in a headless browser, waits for the client-side databases and calculations to finish, reads the rendered build state, and returns a downloadable JSON file.

## Use The App

Open the hosted Vercel app:

[https://wynnextractor.vercel.app](https://wynnextractor.vercel.app)

Paste a WynnBuilder link, click **Extract JSON**, then download the generated file. The app validates the URL before extraction and runs the scraper through its built-in Vercel API.

Supported URL formats:

```text
https://wynnbuilder-beta.github.io/builder/#...
https://wynnbuilder.github.io/builder/#...
```

## Use The CLI

Install dependencies:

```bash
npm install
```

Extract one build:

```bash
node app.js "https://wynnbuilder-beta.github.io/builder/#CT013HxGyb0yQWT82eGnEamWecKS230q-Kz7sNAI50"
```

Choose an output file:

```bash
node app.js "https://wynnbuilder-beta.github.io/builder/#HASH_HERE" --out output/build.json
```

Extract multiple builds from a text file:

```bash
node app.js --batch urls.txt --out build-outputs
node app.js --batch urls.txt --out results.json
```

Batch files use one URL per line. Empty lines and lines starting with `#` are ignored. Directory output creates one JSON per build plus a `manifest.json`; `.json` output creates one combined result file.

## JSON Contents

The extractor captures:

1. Equipment and full item tooltips
2. Level
3. Skill points
4. Summary stats
5. Detailed stats
6. Spell and attack breakdowns
7. Selected ability tree nodes
8. Active boosts
9. Boost sliders
10. Tomes
11. Aspects
12. Identifications
13. Poison stats
14. Powder specials
15. Set bonuses
16. Build order
17. Parsed tooltip and ability metadata

Useful structured fields include:

```text
meta.schemaVersion
meta.validation
abilityTree.selectedAbilityIds
abilityTree.abilities[].descriptionParsed
identifications.*.parsedValue
identifications.*.parsedBase
itemTooltips.*._parsed
```

## Development

Run tests:

```bash
npm test
```

Run the local API:

```bash
npm run api
```

The production Vercel app uses:

```text
public/index.html
api/extract.js
api/health.js
```

Local CLI extraction uses full `puppeteer`. Vercel extraction uses `@sparticuz/chromium` with `puppeteer-core`.

## Technical Notes

WynnBuilder stores the build in a URL hash and reconstructs the page client-side. WynnExtractor waits for the rendered UI, forces hidden tooltip/spell panels visible, and reads both DOM content and WynnBuilder globals such as `ATREES`, `atree_data`, and `decodeAtree`.

The ability tree extraction uses WynnBuilder's own tree traversal decoder, so it captures selected nodes even when they do not appear in the merged "Active Abilities" panel.

## Next Steps

- UI improvements
- Error messages in the UI
- Add an AI agent to analyze and explain the build in text
- Convert UI to React/Vite
