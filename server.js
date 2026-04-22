// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { buscaIteracoesADO } = require('./ado-client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADO_ALLOWED_PREFIX = 'https://dev.azure.com/tr-ggo/';

app.get('/api/iteracoes', async (req, res) => {
    try {
        const data = await buscaIteracoesADO();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/proxy', async (req, res) => {
    const { url, method = 'GET', body } = req.body || {};
    if (!url || !url.startsWith(ADO_ALLOWED_PREFIX)) {
        return res.status(403).json({ error: 'URL não permitida' });
    }
    try {
        const opts = {
            method,
            headers: {
                'Authorization': `Basic ${process.env.ADO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const response = await fetch(url, opts);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const SAP_BASE = process.env.SAP_SERVER_URL || 'http://localhost:80';

async function sapProxy(req, res, sapPath) {
    try {
        const qs = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
        const opts = { method: req.method, headers: { 'Content-Type': 'application/json' } };
        if (req.method === 'POST') {
            const body = sapPath === '/api/zendesk/sync-to-ado'
                ? { ...req.body, adoToken: process.env.ADO_TOKEN }
                : req.body;
            opts.body = JSON.stringify(body);
        }
        const r = await fetch(SAP_BASE + sapPath + qs, opts);
        const data = await r.json();
        res.status(r.status).json(data);
    } catch (e) {
        res.status(502).json({ success: false, error: 'SAP server indisponível: ' + e.message });
    }
}

app.get('/api/analise',              (req, res) => sapProxy(req, res, '/api/analise'));
app.post('/api/ia-analise',          (req, res) => sapProxy(req, res, '/api/ia-analise'));
app.post('/api/rfc-exec',            (req, res) => sapProxy(req, res, '/api/rfc-exec'));
app.post('/api/rfc-val',             (req, res) => sapProxy(req, res, '/api/rfc-val'));
app.post('/api/ia-val-safx',         (req, res) => sapProxy(req, res, '/api/ia-val-safx'));
app.post('/api/ia-val-consolidar',   (req, res) => sapProxy(req, res, '/api/ia-val-consolidar'));
app.get('/api/zendesk/ticket',       (req, res) => sapProxy(req, res, '/api/zendesk/ticket'));
app.post('/api/zendesk/sync-to-ado', (req, res) => sapProxy(req, res, '/api/zendesk/sync-to-ado'));

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

module.exports = app;
