const { extractWynnBuild } = require('../app');
const { validateBuildUrl } = require('../server');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

function isAllowedOrigin(origin) {
    return ALLOWED_ORIGINS.includes('*') || !origin || ALLOWED_ORIGINS.includes(origin);
}

function setCors(res, origin) {
    res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin(origin) ? (origin || '*') : 'null');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

module.exports = async function handler(req, res) {
    const origin = req.headers.origin;
    setCors(res, origin);

    if (!isAllowedOrigin(origin)) {
        res.status(403).json({ ok: false, error: 'Origin is not allowed.' });
        return;
    }

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed.' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const url = String(body.url || '').trim();
        const validationError = validateBuildUrl(url);
        if (validationError) {
            res.status(400).json({ ok: false, error: validationError });
            return;
        }

        const build = await extractWynnBuild(url, {
            writeOutput: false,
            debugOnError: false
        });

        res.status(200).json({ ok: true, build });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};
