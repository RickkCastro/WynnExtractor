const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { extractBatch } = require('../app');

async function run() {
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-urls.txt');
    const outputPath = path.join(__dirname, 'tmp-batch-results.json');

    try {
        const summary = await extractBatch({
            batchPath: fixturePath,
            outputPath,
            debugOnError: false
        });

        assert.strictEqual(summary.meta.total, 4);
        assert.strictEqual(summary.meta.succeeded, 4);
        assert.strictEqual(summary.meta.failed, 0);

        const expected = [
            { playerClass: 'Shaman', totalAbilities: 93, activeCount: 34 },
            { playerClass: 'Mage', totalAbilities: 90, activeCount: 32 },
            { playerClass: 'Mage', totalAbilities: 90, activeCount: 36 },
            { playerClass: 'Mage', totalAbilities: 73, activeCount: 23 }
        ];

        summary.results.forEach((result, index) => {
            assert.strictEqual(result.ok, true);
            assert.strictEqual(result.build.meta.validation.ok, true);
            assert.strictEqual(Object.values(result.build.equipment).filter(Boolean).length, 9);
            assert.strictEqual(result.build.abilityTree.playerClass, expected[index].playerClass);
            assert.strictEqual(result.build.abilityTree.totalAbilities, expected[index].totalAbilities);
            assert.strictEqual(result.build.abilityTree.activeCount, expected[index].activeCount);
            assert.strictEqual(result.build.abilityTree.abilities.length, expected[index].activeCount);
        });
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
