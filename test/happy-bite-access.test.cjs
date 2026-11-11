const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

// Load the pure TypeScript helpers without loading Expo native modules in Node.
const source = readFileSync(join(__dirname, '../src/lib/happy-bite-access.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exportsObject = {};
runInNewContext(compiled, { exports: exportsObject });
const { parseHappyBite, happyBiteAsBook, hasHappyBiteProAccess } = exportsObject;

test('legacy Happy Bites remain free and retain their playable audio', () => {
  const bite = parseHappyBite({ _id: 'legacy', audioUrl: '/audio.mp3' });
  assert.equal(bite.accessType, 'free');
  assert.equal(bite.locked, false);
  assert.equal(bite.audioUrl, '/audio.mp3');
});

test('locked audio cannot enter the shared player even if a URL was supplied', () => {
  const bite = parseHappyBite({ _id: 'premium', accessType: 'premium', locked: true, audioUrl: '/protected.mp3' });
  const book = happyBiteAsBook(bite);
  assert.equal(book.accessType, 'premium');
  assert.equal(book.happyBiteId, 'premium');
  assert.equal(book.audioUrl, '');
  assert.equal(book.episodes[0].audioUrl, '');
});

test('unlocked premium Happy Bites retain the playback identity used for server rechecks', () => {
  const book = happyBiteAsBook(parseHappyBite({ _id: 'premium', accessType: 'premium', locked: false, audioUrl: '/audio.mp3' }));
  assert.equal(book.happyBiteId, 'premium');
  assert.equal(book.id, 'happy-bite-premium');
  assert.equal(book.episodes[0].audioUrl, '/audio.mp3');
  assert.equal(book.accessType, 'premium');
});

test('premium card state follows existing Pro entitlement including expiry and admin override', () => {
  const now = Date.parse('2026-11-11T00:00:00Z');
  for (const user of [null, {}, { purchasedBookIds: ['premium'] }, { subscriptionActive: false }, { subscriptionActive: true, subscriptionExpiresAt: '2026-11-10' }, { subscriptionActive: true, subscriptionExpiresAt: 'invalid' }]) {
    assert.equal(hasHappyBiteProAccess(user, now), false);
  }
  for (const user of [{ role: 'admin' }, { subscriptionActive: true }, { subscriptionActive: true, subscriptionExpiresAt: '2026-12-11' }]) {
    assert.equal(hasHappyBiteProAccess(user, now), true);
  }
});
