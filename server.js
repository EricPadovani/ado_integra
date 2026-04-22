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

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

module.exports = app;
