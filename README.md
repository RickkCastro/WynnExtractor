# WynnExtractor

WynnExtractor is a **Node.js + Puppeteer web scraper** built to deep-extract complete build data from [WynnBuilder Beta](https://wynnbuilder-beta.github.io/builder/), a loadout/build calculator for the MMORPG Wynncraft.

This script runs a headless browser to access a build URL, waits for all internal databases to download and the client-side rendering to finish, reads all dynamic panels, and exports the extracted data into a deeply structured `.json` file.

## Extracted Features (17 Sections)

The Extractor goes beyond the surface, digging into hidden information and complex tooltips:

1. **Equipment:** Name, rarity, HP, level, and powder slots for 9 gear slots (including rings, bracelets, necklaces, and weapon).
2. **Level:** Overall build (player) level.
3. **Skill Points:** Total, assigned, and base skill points.
4. **Summary Stats:** HP, EHP, Defenses, Mana, Walk Speed, etc.
5. **Detailed Stats:** 35 types of detailed stats such as % damage bonuses, spell costs, reflections, sprint, etc.
6. **Spells:** Thorough breakdown of 9 attacks/spells (crit/non-crit, total by element, base damage, etc.).
7. **Ability Tree:** The complete ability tree captured directly from WynnBuilder's global objects. It extracts all 93 abilities (identifying which ones are active based on the URL Hash), including names, descriptions, archetypes, and AP (Ability Points) costs.
8. **Active Boosts:** Active combat buffs enabled by the "toggle buttons".
9. **Boost Sliders:** Values input into sliders for bonus simulation (e.g., elemental boost armor).
10. **Tomes:** Tomes used by the build.
11. **Aspects:** Extra build information (Aspects with name and tier).
12. **Identifications (IDs):** 28 extracted identifications (Current value vs Base value).
13. **Poison Stats:** Continuous poison damage breakdown.
14. **Powder Specials:** Abilities triggered by powder combinations (Quake, Courage, etc.).
15. **Set Bonuses:** Bonuses granted by wearing multiple pieces of the same armor Set.
16. **Build Order:** Recommended build order if available.
17. **Item Tooltips:** Raw text extracted and re-standardized including item requirements, min/max ID ranges, lore, and powder slots.

## How to Use

### 1. Requirements
- Node.js (v18 or higher)
- NPM or Yarn

### 2. Installation
Clone or download the repository, then install the dependencies.
```bash
npm install
```

### 3. Extracting a Build
Run the main script `node app.js`, **passing the full URL** containing the desired Wynnbuilder Hash **in quotes**:

```bash
node app.js "https://wynnbuilder-beta.github.io/builder/#CT013HxGyb0yQWT82eGnEamWecKS230q-Kz7sNAI50"
```

> **Note:** If you don't provide a URL, the script will throw an error explaining the correct usage.

### 4. Understanding the Output
After loading the virtual browser and completing all steps, the script will report the total items captured in the terminal:
```
✅ Extração completa!
   📦 9 equipamentos
   📊 35 stats detalhados
   🔮 9 magias/ataques
   🌳 17/93 habilidades (ativas/total)
   📄 Arquivo: build-wynncraft.json
```

The `build-wynncraft.json` file will be generated or updated in your local directory (weighing around 120KB), with the data organized in a hierarchical JSON ready to be used by other applications.

## Scraper Technical Details
Because WynnBuilder represents the build state by **decoding a Base64 encoded BitVector hash**, all of the "State" exists in the DOM and dynamic JS scripts (not in a clean JSON API).

To successfully extract this data, Puppeteer is configured to:
* Wait for `networkidle0` alongside an extra timer and evaluate if key elements have rendered.
* Force visibility (`display: block`) via CSS injection for dozens of floating tooltips (items and spells) that are usually only loaded when the user hovers over them.
* When parsing identifications where hidden spans (min/max/base) are structured in a 3-column CSS grid, the scraper iterates over `children.textContent` of each item, which works much better on hidden CSS than conventional `innerText`.
* Use base objects (like `ATREES`) generated in real-time by the decoding process to map and cross-reference the Tree Vector bits, generating a highly accurate representation of the Ability Tree.

## Next Steps (Contribution Ideas)
* Batch Extraction (Lists/multiple URLs).
* Robust Error Handling (Timeouts/Fallbacks).
* Parse raw strings with numeric values into Integers within Identification keys (e.g., `"Health": "4100"` to `"Health": 4100`).
* Parse Ability "Description" strings into structured objects (e.g., `"Mana Cost: 30"` to `{manaCost: 30}`).
