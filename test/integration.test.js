const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { DEFAULT_BUILD_URL, extractWynnBuild } = require('../app');

async function run() {
    const outputPath = path.join(__dirname, 'tmp-build-wynncraft.json');
    try {
        const build = await extractWynnBuild(DEFAULT_BUILD_URL, {
            outputPath,
            debugOnError: false
        });

        assert.strictEqual(build.abilityTree.playerClass, 'Shaman');
        assert.strictEqual(build.abilityTree.totalAbilities, 93);
        assert.strictEqual(build.abilityTree.activeCount, 34);
        assert.strictEqual(build.abilityTree.abilities.length, 34);
        assert.strictEqual(build.meta.validation.ok, true);

        const names = build.abilityTree.abilities.map(ability => ability.name);
        [
            'Relik Proficiency 1',
            'Totemic Smash',
            'Distant Grasp',
            'Double Totem',
            'Triple Totem',
            'Shocking Aura',
            'Flaming Tongue'
        ].forEach(name => assert.ok(names.includes(name), `Missing selected ability: ${name}`));

        const totem = build.abilityTree.abilities.find(ability => ability.name === 'Totem');
        assert.deepStrictEqual(totem.descriptionParsed.clickCombo, ['RIGHT', 'LEFT', 'RIGHT']);
        assert.strictEqual(totem.descriptionParsed.manaCost, 30);
        assert.strictEqual(totem.descriptionParsed.totalDamagePct, 12);
        assert.strictEqual(totem.descriptionParsed.durationSeconds, 30);
        assert.strictEqual(totem.descriptionParsed.areaOfEffect.blocks, 8);

        const weaponTooltip = build.itemTooltips.weapon;
        assert.strictEqual(weaponTooltip._parsed['Combat Level Min'].value, 96);
        assert.strictEqual(weaponTooltip._parsed['Spell Damage %'].min.value, 9);
        assert.strictEqual(weaponTooltip._parsed['Spell Damage %'].max.value, 39);

        assert.strictEqual(typeof build.identifications.sdPct.parsedValue.value, 'number');
    } finally {
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
