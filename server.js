const http = require('http');
const { extractWynnBuild } = require('./app');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

function isAllowedOrigin(origin) {
    return ALLOWED_ORIGINS.includes('*') || !origin || ALLOWED_ORIGINS.includes(origin);
}

function sendJson(res, statusCode, payload, origin) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? (origin || '*') : 'null',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin'
    });
    res.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                reject(new Error('Request body is too large.'));
                req.destroy();
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(new Error('Request body must be valid JSON.'));
            }
        });
        req.on('error', reject);
    });
}

function validateBuildUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (err) {
        return 'URL is invalid.';
    }

    const allowedHosts = new Set([
        'wynnbuilder-beta.github.io',
        'wynnbuilder.github.io'
    ]);

    if (parsed.protocol !== 'https:') return 'URL must use https.';
    if (!allowedHosts.has(parsed.hostname)) return 'URL must be a WynnBuilder or WynnBuilder Beta link.';
    if (!parsed.pathname.startsWith('/builder/')) return 'URL path must start with /builder/.';
    if (!parsed.hash || parsed.hash.length < 10) return 'URL must include a build hash.';

    return null;
}

async function handleRequest(req, res) {
    const origin = req.headers.origin;

    if (req.method === 'OPTIONS') {
        sendJson(res, 204, {}, origin);
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { ok: true, service: 'WynnExtractor API' }, origin);
        return;
    }

    if (req.method !== 'POST' || req.url !== '/extract') {
        sendJson(res, 404, { ok: false, error: 'Not found.' }, origin);
        return;
    }

    if (!isAllowedOrigin(origin)) {
        sendJson(res, 403, { ok: false, error: 'Origin is not allowed.' }, origin);
        return;
    }

    try {
        const body = await readJsonBody(req);
        const url = String(body.url || '').trim();
        const validationError = validateBuildUrl(url);
        if (validationError) {
            sendJson(res, 400, { ok: false, error: validationError }, origin);
            return;
        }

        const build = await extractWynnBuild(url, {
            writeOutput: false,
            debugOnError: false
        });

        sendJson(res, 200, { ok: true, build }, origin);
    } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message }, origin);
    }
}

if (require.main === module) {
    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch(err => {
            sendJson(res, 500, { ok: false, error: err.message }, req.headers.origin);
        });
    });

    server.listen(DEFAULT_PORT, () => {
        console.log(`WynnExtractor API listening on http://localhost:${DEFAULT_PORT}`);
    });
}

module.exports = {
    handleRequest,
    validateBuildUrl
};
