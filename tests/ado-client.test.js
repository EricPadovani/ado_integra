// tests/ado-client.test.js
const { test } = require('node:test');
const assert = require('node:assert');

const MOCK_DATA = {
    count: 2,
    value: [
        { id: 'id-1', name: 'Sprint 1', path: 'Mastersaf Interfaces\\Sprint 1', url: 'https://dev.azure.com/...', attributes: { startDate: '2024-01-01', finishDate: '2024-01-14', timeFrame: 'past' } },
        { id: 'id-2', name: 'Sprint 2', path: 'Mastersaf Interfaces\\Sprint 2', url: 'https://dev.azure.com/...', attributes: { startDate: '2024-01-15', finishDate: '2024-01-28', timeFrame: 'current' } }
    ]
};

test('buscaIteracoesADO retorna dados estruturados', async (t) => {
    const saved = global.fetch;
    global.fetch = async (url, opts) => {
        assert.ok(url.includes('dev.azure.com'), 'deve chamar dev.azure.com');
        assert.ok(opts.headers.Authorization.startsWith('Basic '), 'deve ter header Basic');
        return { ok: true, json: async () => MOCK_DATA };
    };

    process.env.ADO_TOKEN = 'dGVzdA==';
    delete require.cache[require.resolve('../ado-client')];
    const { buscaIteracoesADO } = require('../ado-client');

    try {
        const result = await buscaIteracoesADO();
        assert.strictEqual(result.count, 2);
        assert.strictEqual(result.value[0].name, 'Sprint 1');
    } finally {
        global.fetch = saved;
    }
});

test('buscaIteracoesADO lança erro se ADO responde não-ok', async (t) => {
    const saved = global.fetch;
    global.fetch = async () => ({ ok: false, status: 401 });

    process.env.ADO_TOKEN = 'dGVzdA==';
    delete require.cache[require.resolve('../ado-client')];
    const { buscaIteracoesADO } = require('../ado-client');

    try {
        await assert.rejects(buscaIteracoesADO, /401/);
    } finally {
        global.fetch = saved;
    }
});
