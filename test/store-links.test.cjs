const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../src/lib/store-links.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsForTest = {};
runInNewContext(compiled, { exports: exportsForTest });
const { androidSubscriptionSettingsUrl } = exportsForTest;

test('subscription management follows the configured app identifier and product', () => {
  const url = new URL(androidSubscriptionSettingsUrl('com.happinotes.app', 'monthly'));
  assert.equal(url.origin, 'https://play.google.com');
  assert.equal(url.searchParams.get('package'), 'com.happinotes.app');
  assert.equal(url.searchParams.get('sku'), 'monthly');
});

test('missing config opens the general subscriptions page without an undefined identifier', () => {
  assert.equal(androidSubscriptionSettingsUrl(undefined, 'monthly'),
    'https://play.google.com/store/account/subscriptions');
  const url = new URL(androidSubscriptionSettingsUrl('com.example.app', null));
  assert.equal(url.searchParams.has('sku'), false);
});

test('query values cannot insert additional subscription parameters', () => {
  const url = new URL(androidSubscriptionSettingsUrl('com.example.app', 'monthly&package=other'));
  assert.equal(url.searchParams.get('package'), 'com.example.app');
  assert.equal(url.searchParams.get('sku'), 'monthly&package=other');
  assert.equal([...url.searchParams].length, 2);
});
