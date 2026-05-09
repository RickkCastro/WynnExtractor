const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * WynnBuilder Beta — Comprehensive Build Extractor
 * 
 * Extracts every piece of build data available on the WynnBuilder page:
 * - Equipment (name, rarity, HP, level, powder slots, full item stats)
 * - Skill Points (total, assigned, original, percentage effects)
 * - Summary Stats (HP, EHP, defenses, mana, walk speed)
 * - Detailed Stats (all damage bonuses, spell costs, defense %, etc.)
 * - Spell/Damage Breakdown (melee DPS, all spell damages with element breakdown)
 * - Ability Tree (all active abilities with full descriptions and modifiers)
 * - Active Boosts (toggled combat buffs)
 * - Tomes & Aspects
 * - Set Bonuses
 * - Powder Specials & Poison Damage
 */

async function extractWynnBuild(buildUrl) {
    console.log('🚀 Starting browser...');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`🌐 Accessing: ${buildUrl}`);
    console.log('   Waiting for internal database downloads (networkidle0)...');
    await page.goto(buildUrl, { waitUntil: 'networkidle0', timeout: 90000 });

    console.log('⏳ Waiting for hash decoding and complete rendering...');
    // Wait for the build to fully render (skill points, ability tree, spells, etc.)
    await page.waitForFunction(() => {
        const weaponInput = document.getElementById('weapon-choice');
        const statsPanel = document.getElementById('summary-stats');
        return weaponInput && weaponInput.value.trim() !== '' && statsPanel && statsPanel.children.length > 0;
    }, { timeout: 30000 });
    // Extra safety margin for spell calculations and ability tree rendering
    await new Promise(r => setTimeout(r, 3000));

    // Click "Detailed" stats tab to ensure it's rendered
    await page.evaluate(() => {
        const btn = document.getElementById('detailed-stats-btn');
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Force-show all spell detail sections and item tooltips
    console.log('📖 Expanding spell details and tooltips...');
    await page.evaluate(() => {
        // Force all spell detail panels visible (they use display:none when collapsed)
        for (let i = 0; i <= 15; i++) {
            const detail = document.getElementById(`spell${i}-info`);
            if (detail) detail.style.display = 'block';
        }
        // Force all item float-tooltips visible
        document.querySelectorAll('.float-tooltip').forEach(el => {
            el.style.display = 'block';
            el.style.position = 'static'; // prevent overlap issues
            el.style.visibility = 'visible';
        });
    });
    await new Promise(r => setTimeout(r, 500));

    console.log('🔍 Extracting comprehensive data...');

    const buildData = await page.evaluate(() => {
        // ─── HELPERS ────────────────────────────────────────────────────
        const getText = (el) => el?.innerText?.trim() || '';
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? (el.value?.trim() || el.innerText?.trim() || '') : '';
        };

        /**
         * Extracts the rarity class from an equipment input element.
         * WynnBuilder embeds rarity as a CSS class: Mythic, Legendary, Rare, Fabled, etc.
         */
        const getRarity = (className) => {
            const rarities = ['Mythic', 'Legendary', 'Fabled', 'Rare', 'Unique', 'Set', 'Normal', 'Crafted'];
            for (const r of rarities) {
                if (className?.includes(r)) return r;
            }
            return 'Unknown';
        };

        /**
         * Parses a stat panel (summary or detailed) that uses rows of
         * <div class="row"><div class="col text-start">Label</div><div class="col text-end">Value</div></div>
         */
        const parseStatPanel = (containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return {};

            const stats = {};
            const rows = container.querySelectorAll('.row');
            let currentSection = 'general';

            rows.forEach(row => {
                // HR elements (separators) create section boundaries
                if (row.tagName === 'HR') {
                    currentSection = 'section_' + Object.keys(stats).length;
                    return;
                }

                const cols = row.querySelectorAll('.col, .col-auto');
                if (cols.length >= 2) {
                    const labelEl = row.querySelector('.text-start');
                    const valueEl = row.querySelector('.text-end');
                    if (labelEl && valueEl) {
                        const label = getText(labelEl).replace(/:\s*$/, '').trim();
                        const value = getText(valueEl);
                        if (label && value) {
                            stats[label] = value;
                        }
                    }
                }

                // Handle sub-rows like "➜ Total with base: 23/5s"
                const boldEls = row.querySelectorAll('b');
                if (boldEls.length >= 2) {
                    const label = getText(boldEls[0]).replace(/[➜→]\s*/, '').replace(/:\s*$/, '').trim();
                    const value = getText(boldEls[1]);
                    if (label && value) {
                        stats[label] = value;
                    }
                }
            });

            return stats;
        };

        /**
         * Parses a spell damage card (e.g., #spell0-infoAvg or #spell0-info).
         * Returns the card's title and all lines of text.
         */
        const parseSpellCard = (elementId) => {
            const el = document.getElementById(elementId);
            if (!el || el.offsetParent === null) return null; // hidden or doesn't exist

            const text = getText(el);
            if (!text || text.length < 5) return null;

            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) return null;

            return {
                title: lines[0],
                details: lines.slice(1)
            };
        };

        // ─── 1. EQUIPMENT ───────────────────────────────────────────────
        const equipSlots = [
            { key: 'helmet', label: 'Helmet' },
            { key: 'chestplate', label: 'Chestplate' },
            { key: 'leggings', label: 'Leggings' },
            { key: 'boots', label: 'Boots' },
            { key: 'ring1', label: 'Ring 1' },
            { key: 'ring2', label: 'Ring 2' },
            { key: 'bracelet', label: 'Bracelet' },
            { key: 'necklace', label: 'Necklace' },
            { key: 'weapon', label: 'Weapon' }
        ];

        const equipment = {};
        equipSlots.forEach(({ key, label }) => {
            const choiceEl = document.getElementById(`${key}-choice`);
            const name = choiceEl?.value?.trim() || '';
            if (!name) {
                equipment[key] = null;
                return;
            }

            const rarity = getRarity(choiceEl.className);
            const healthEl = document.getElementById(`${key}-health`);
            const lvEl = document.getElementById(`${key}-lv`);
            const powderEl = document.getElementById(`${key}-powder`);
            const dpsEl = document.getElementById(`${key}-dps`);

            // Parse the tooltip for full item stats
            const tooltipEl = document.getElementById(`${key}-tooltip`);
            let itemStats = null;
            if (tooltipEl) {
                const tooltipText = getText(tooltipEl);
                if (tooltipText) {
                    itemStats = tooltipText.split('\n').map(l => l.trim()).filter(Boolean);
                }
            }

            equipment[key] = {
                name,
                rarity,
                health: getText(healthEl),
                level: getText(lvEl),
                powders: powderEl ? {
                    applied: powderEl.value?.trim() || '',
                    slots: powderEl.placeholder || ''
                } : null,
                baseDps: dpsEl ? getText(dpsEl) : undefined,
                itemTooltip: itemStats
            };
        });

        // ─── 2. LEVEL ───────────────────────────────────────────────────
        const level = getVal('level-choice');

        // ─── 3. SKILL POINTS ────────────────────────────────────────────
        const skillAbbrevs = [
            { prefix: 'str', name: 'Strength', element: 'Earth' },
            { prefix: 'dex', name: 'Dexterity', element: 'Thunder' },
            { prefix: 'int', name: 'Intelligence', element: 'Water' },
            { prefix: 'def', name: 'Defense', element: 'Fire' },
            { prefix: 'agi', name: 'Agility', element: 'Air' }
        ];

        const skillPoints = {};
        skillAbbrevs.forEach(({ prefix, name, element }) => {
            const total = getVal(`${prefix}-skp`);
            const assign = getText(document.getElementById(`${prefix}-skp-assign`));
            const base = getText(document.getElementById(`${prefix}-skp-base`));
            const pct = getText(document.getElementById(`${prefix}-skp-pct`));

            skillPoints[name] = {
                total: total,
                assigned: assign.replace(/Assign:\s*/i, ''),
                original: base.replace(/Original:\s*/i, ''),
                percentage: pct,
                element
            };
        });

        // Assigned / remaining skill point summary
        const summaryBoxText = getText(document.getElementById('summary-box'));

        // ─── 4. SUMMARY STATS ───────────────────────────────────────────
        const summaryStats = parseStatPanel('summary-stats');

        // ─── 5. DETAILED STATS ──────────────────────────────────────────
        const detailedStats = parseStatPanel('detailed-stats');

        // ─── 6. SPELL / DAMAGE BREAKDOWN ────────────────────────────────
        const spells = {};
        // Known spell IDs in WynnBuilder: 0 = Melee, 1-4 = Spells 1-4, 6-7 and 12-13 are class-specific extras
        const spellIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        spellIds.forEach(i => {
            const avg = parseSpellCard(`spell${i}-infoAvg`);
            const detailed = parseSpellCard(`spell${i}-info`);
            if (avg || detailed) {
                spells[`spell_${i}`] = { summary: avg, detailed };
            }
        });

        // ─── 7. ABILITY TREE (ALL abilities, active + inactive) ─────────
        // Access the ATREES global loaded from atree.json by the builder.
        // It contains full ability data for every class.
        // The atree_data BitVector encodes active/inactive state per ability.
        const abilityTree = (() => {
            if (typeof ATREES === 'undefined') return { error: 'ATREES global not found' };

            // Detect the player class from the weapon input
            const weaponName = getVal('weapon-choice');
            const classNames = Object.keys(ATREES).filter(k => k !== 'Any');
            // The builder determines class from weapon type; we check which class tree
            // was rendered by matching with the atree-active panel content
            let playerClass = null;

            // Try to detect class from the rendered tree by checking
            // which class has a matching first ability in the atree-active panel
            const atreeActiveEl = document.getElementById('atree-active');
            const activeText = atreeActiveEl ? atreeActiveEl.innerText?.trim() : '';
            for (const cls of classNames) {
                const tree = ATREES[cls];
                if (tree && tree.length > 0) {
                    const firstName = tree[0].display_name;
                    if (activeText.includes(firstName)) {
                        playerClass = cls;
                        break;
                    }
                }
            }
            if (!playerClass) playerClass = classNames[0]; // fallback

            const classTree = ATREES[playerClass];
            if (!classTree) return { error: `No tree for class ${playerClass}` };

            // Build topo-sorted tree using the same get_sorted_class_atree logic
            const sorted = (typeof get_sorted_class_atree === 'function')
                ? get_sorted_class_atree(ATREES, playerClass)
                : classTree.map(a => ({ ability: a, children: [], parents: [] }));

            // Determine selected abilities using WynnBuilder's own decoder.
            // atree_data is encoded by tree traversal, not by topological index.
            const activeIds = new Set();
            if (
                typeof decodeAtree === 'function' &&
                typeof atree_data !== 'undefined' &&
                atree_data &&
                sorted.length > 0
            ) {
                try {
                    decodeAtree(sorted, atree_data).forEach(node => {
                        if (node?.ability?.id !== undefined) activeIds.add(node.ability.id);
                    });
                } catch(e) { /* fall back below */ }
            }

            // Fallback: read the rendered tree state directly when available.
            // This captures selected nodes even when they are not shown in the
            // merged "Active Abilities" panel.
            if (activeIds.size < 3 && typeof atree_state_node !== 'undefined') {
                try {
                    const state = atree_state_node.value || atree_state_node._value || atree_state_node.result;
                    if (state?.forEach) {
                        state.forEach((node, id) => {
                            if (node?.active) activeIds.add(id);
                        });
                    }
                } catch(e) { /* fall back below */ }
            }

            // Final fallback: text matching against the rendered active panel.
            // This panel is merged/incomplete, so use it only if decoder/state
            // access failed.
            if (activeIds.size < 3 && activeText.length > 20) {
                classTree.forEach(a => {
                    if (activeText.includes(a.display_name)) activeIds.add(a.id);
                });
            }

            // Build the full abilities array with all metadata
            const allAbilities = classTree.map(ability => {
                // Clean HTML from description
                const desc = (ability.desc || '')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&emsp;/g, '  ')
                    .replace(/&nbsp;/g, ' ')
                    .trim();

                return {
                    id: ability.id,
                    name: ability.display_name,
                    active: activeIds.has(ability.id),
                    archetype: ability.archetype || null,
                    cost: ability.cost || 0,
                    parents: ability.parents || [],
                    grid: {
                        row: ability.display?.row,
                        col: ability.display?.col,
                        icon: ability.display?.icon || null
                    },
                    description: desc || null,
                    base_abil: ability.base_abil || null,
                    properties: ability.properties || null
                };
            });

            return {
                playerClass,
                totalAbilities: allAbilities.length,
                activeCount: allAbilities.filter(a => a.active).length,
                inactiveCount: allAbilities.filter(a => !a.active).length,
                abilities: allAbilities.filter(a => a.active)
            };
        })();

        // AP costs (from the rendered panel)
        const apCost = getText(document.getElementById('active_AP_cost'));
        const apCap = getText(document.getElementById('active_AP_cap'));

        // ─── 8. ACTIVE BOOSTS ───────────────────────────────────────────
        const activeBoosts = [];
        document.querySelectorAll('.button-boost').forEach(btn => {
            const text = getText(btn);
            // Only include named boosts (not just numbers/IDs) that are active
            if (text && text.length > 2 && !/^\d+$/.test(text)) {
                activeBoosts.push({
                    name: text,
                    id: btn.id || null,
                    active: !btn.classList.contains('dark-8u') || btn.style.opacity !== '0.3'
                });
            }
        });

        // ─── 9. ELEMENTAL BOOST SLIDERS ─────────────────────────────────
        const boostSliders = {};
        const elements = ['str', 'dex', 'int', 'def', 'agi'];
        elements.forEach(elem => {
            const slider = document.getElementById(`${elem}_boost_armor`);
            const label = document.getElementById(`${elem}_boost_armor_label`);
            if (slider) {
                boostSliders[elem] = {
                    value: slider.value,
                    label: getText(label)
                };
            }
        });

        // Puppet slider
        const puppetSlider = document.getElementById('ability-slider21');
        const puppetLabel = document.getElementById('ability-slider21_label');
        if (puppetSlider) {
            boostSliders.puppets = {
                value: puppetSlider.value,
                label: getText(puppetLabel)
            };
        }

        // ─── 10. TOMES ─────────────────────────────────────────────────
        const tomeSlots = [
            'weaponTome1', 'weaponTome2',
            'armorTome1', 'armorTome2', 'armorTome3', 'armorTome4',
            'guildTome1', 'lootrunTome1',
            'gatherXpTome1', 'gatherXpTome2',
            'dungeonXpTome1', 'dungeonXpTome2',
            'mobXpTome1', 'mobXpTome2'
        ];

        const tomes = {};
        tomeSlots.forEach(slot => {
            const val = getVal(`${slot}-choice`);
            if (val) tomes[slot] = val;
        });

        // ─── 11. ASPECTS ────────────────────────────────────────────────
        const aspects = {};
        for (let i = 1; i <= 5; i++) {
            const name = getVal(`aspect${i}-choice`);
            const tier = getVal(`aspect${i}-tier-choice`);
            if (name) {
                aspects[`aspect_${i}`] = { name, tier: tier || 'N/A' };
            }
        }

        // ─── 12. POISON DAMAGE ──────────────────────────────────────────
        const poisonEl = document.getElementById('build-poison-stats');
        const poisonStats = poisonEl ? getText(poisonEl) : null;

        // ─── 13. POWDER SPECIALS ────────────────────────────────────────
        const powderSpecialEl = document.getElementById('powder-special-stats');
        const powderSpecials = powderSpecialEl ? getText(powderSpecialEl) : null;

        // ─── 14. SET BONUSES ────────────────────────────────────────────
        const setInfoEl = document.getElementById('set-info');
        const setBonuses = setInfoEl ? getText(setInfoEl) : null;

        // ─── 15. ITEM TOOLTIPS (full item stats from bottom cards) ──────
        const itemTooltips = {};
        const tooltipSlots = ['helmet', 'chestplate', 'leggings', 'boots', 'ring1', 'ring2', 'bracelet', 'necklace', 'weapon'];
        tooltipSlots.forEach(slot => {
            const el = document.getElementById(`${slot}-tooltip`);
            if (!el || el.children.length < 3) return;

            const parsed = { _raw: [] };
            
            // Iterate each child div to extract structured data
            Array.from(el.children).forEach(child => {
                const text = child.textContent?.trim();
                if (!text) return; // skip separators/spacers
                
                parsed._raw.push(text);

                // Parse "Key : Value" or "Key: Value" patterns
                const kvMatch = text.match(/^(.+?):\s*(.+)$/);
                if (kvMatch) {
                    const cleanKey = kvMatch[1].replace(/^[❤✤✦❉✹❋⚔⛨♻]\s*/, '').trim();
                    parsed[cleanKey] = kvMatch[2].trim();
                }
                // Parse range-based IDs: "min | Stat Name: | max" (3-column layout)
                const row = child.querySelector('.row');
                if (row) {
                    const cols = row.querySelectorAll('.col');
                    if (cols.length === 3) {
                        const min = cols[0].textContent?.trim();
                        const label = cols[1].textContent?.trim().replace(/:\s*$/, '');
                        const max = cols[2].textContent?.trim();
                        if (label && min && max) {
                            parsed[label] = { min, max };
                        }
                    }
                }
            });

            if (parsed._raw.length > 1) {
                itemTooltips[slot] = parsed;
            }
        });

        // ─── 16. BUILD ORDER ────────────────────────────────────────────
        const buildOrderEl = document.getElementById('build-order');
        const buildOrder = buildOrderEl ? getText(buildOrderEl) : null;

        // ─── 17. EDITABLE IDs (current identification values) ───────────
        const editableIds = {};
        const idNames = [
            'sdPct', 'sdRaw', 'mdPct', 'mdRaw', 'poison',
            'eDamPct', 'tDamPct', 'wDamPct', 'fDamPct', 'aDamPct',
            'atkTier', 'ls',
            'eDefPct', 'tDefPct', 'wDefPct', 'fDefPct', 'aDefPct',
            'hprRaw', 'hprPct', 'hpBonus',
            'spPct1', 'spPct2', 'spPct3', 'spPct4',
            'spRaw1', 'spRaw2', 'spRaw3', 'spRaw4'
        ];
        idNames.forEach(id => {
            const input = document.getElementById(id);
            const base = document.getElementById(`${id}-base`);
            if (input) {
                editableIds[id] = {
                    value: input.value?.trim() || '0',
                    base: base ? getText(base) : undefined
                };
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // FINAL BUILD OBJECT
        // ═══════════════════════════════════════════════════════════════
        return {
            meta: {
                sourceUrl: window.location.href,
                buildHash: window.location.hash,
                timestamp: new Date().toISOString(),
                extractorVersion: '2.0.0'
            },
            level,
            equipment,
            skillPoints: {
                summary: summaryBoxText,
                details: skillPoints
            },
            stats: {
                summary: summaryStats,
                detailed: detailedStats
            },
            spells,
            abilityTree: {
                apUsed: apCost,
                apCap: apCap,
                ...abilityTree
            },
            activeBoosts,
            boostSliders,
            tomes,
            aspects,
            identifications: editableIds,
            poisonStats: poisonStats || null,
            powderSpecials: powderSpecials || null,
            setBonuses: setBonuses || null,
            buildOrder: buildOrder || null,
            itemTooltips
        };
    });

    console.log('💾 Generating JSON...');
    fs.writeFileSync('build-wynncraft.json', JSON.stringify(buildData, null, 4));

    // Print summary
    const equipCount = Object.values(buildData.equipment).filter(Boolean).length;
    const spellCount = Object.keys(buildData.spells).length;
    const totalAbil = buildData.abilityTree.totalAbilities || 0;
    const activeAbil = buildData.abilityTree.activeCount || 0;
    const statCount = Object.keys(buildData.stats.detailed || {}).length;
    console.log(`✅ Extraction complete!`);
    console.log(`   📦 ${equipCount} equipments`);
    console.log(`   📊 ${statCount} detailed stats`);
    console.log(`   🔮 ${spellCount} spells/attacks`);
    console.log(`   🌳 ${activeAbil}/${totalAbil} abilities (active/total)`);
    console.log(`   📄 File: build-wynncraft.json`);

    await browser.close();
}

// ═══════════════════════════════════════════════════════════════════════
// Entry Point — expects CLI argument
// ═══════════════════════════════════════════════════════════════════════
const url = process.argv[2];

if (!url) {
    console.error('❌ Error: No URL provided.');
    console.error('Usage: node app.js "https://wynnbuilder-beta.github.io/builder/#HASH_HERE"');
    process.exit(1);
}

extractWynnBuild(url).catch(err => {
    console.error('❌ Extraction error:', err.message);
    process.exit(1);
});
