// tests/server.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const MOCK_ITERACOES = { count: 1, value: [{ id: 'id-1', name: 'Sprint 1' }] };

test('GET / retorna HTML', async () => {
    const fs = require('fs');
    if (!fs.existsSync(require('path').join(__dirname, '../public/index.html'))) {
        console.log('    SKIP: public/index.html ainda não criado (Task 4)');
        return;
    }
    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
});

test('GET /api/iteracoes retorna JSON das iterações', async (t) => {
    const saved = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => MOCK_ITERACOES });
    process.env.ADO_TOKEN = 'dGVzdA==';

    delete require.cache[require.resolve('../ado-client')];
    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    try {
        const res = await request(app).get('/api/iteracoes');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.count, 1);
        assert.strictEqual(res.body.value[0].name, 'Sprint 1');
    } finally {
        global.fetch = saved;
    }
});

test('POST /api/proxy encaminha para ADO', async () => {
    const saved = global.fetch;
    let capturedUrl;
    global.fetch = async (url, opts) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    process.env.ADO_TOKEN = 'dGVzdA==';

    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    try {
        const res = await request(app)
            .post('/api/proxy')
            .send({ url: 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/wit/classificationnodes/areas?api-version=7.0', method: 'GET' });
        assert.strictEqual(res.status, 200);
        assert.ok(capturedUrl.startsWith('https://dev.azure.com/tr-ggo/'), 'URL deve ser do ADO');
    } finally {
        global.fetch = saved;
    }
});

test('POST /api/proxy recusa URLs fora do ADO', async () => {
    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    const res = await request(app)
        .post('/api/proxy')
        .send({ url: 'https://evil.com/steal', method: 'GET' });

    assert.strictEqual(res.status, 403);
});

test('GET /api/iteracoes retorna 500 quando ADO falha', async () => {
    const saved = global.fetch;
    global.fetch = async () => ({ ok: false, status: 503 });
    process.env.ADO_TOKEN = 'dGVzdA==';

    delete require.cache[require.resolve('../ado-client')];
    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    try {
        const res = await request(app).get('/api/iteracoes');
        assert.strictEqual(res.status, 500);
        assert.ok(res.body.error, 'deve ter campo error');
    } finally {
        global.fetch = saved;
    }
});
