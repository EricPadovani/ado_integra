// ado-client.js
require('dotenv').config();

const ADO_URL = 'https://dev.azure.com/tr-ggo/9464d7d1-c63b-4af4-9399-dc57bf983384/_apis/work/teamsettings/iterations?api-version=7.0';

async function buscaIteracoesADO() {
    if (!process.env.ADO_TOKEN) {
        throw new Error('ADO_TOKEN environment variable is not set');
    }
    const response = await fetch(ADO_URL, {
        headers: {
            'Authorization': `Basic ${process.env.ADO_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error(`ADO API error: ${response.status}`);
    return response.json();
}

module.exports = { buscaIteracoesADO };
