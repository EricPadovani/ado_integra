// tests/package.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const pkg = require('../package.json');

test('package.json tem script start', () => {
    assert.ok(pkg.scripts.start, 'script start ausente');
    assert.match(pkg.scripts.start, /server\.js/, 'start deve rodar server.js');
});

test('package.json tem express como dependência', () => {
    assert.ok(pkg.dependencies.express, 'express ausente em dependencies');
});
