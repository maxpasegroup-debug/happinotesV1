const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const source = readFileSync(join(__dirname, '../src/lib/account-deletion-status.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const helpers = {};
runInNewContext(code, { exports: helpers });
const { readDeletionStatus, isExpiredDeletionSession } = helpers;
const reject = (error) => async () => { throw error; };

test('missing request is an empty state for both backend response versions', async () => {
  for (const status of [401, 404]) {
    assert.equal(await readDeletionStatus(reject({ status, message: 'Deletion request not found' }), async () => assert.fail('not needed')), null);
  }
});

test('old backend unavailable response verifies the session before showing a new request form', async () => {
  let verified = 0;
  const result = await readDeletionStatus(reject({ status: 401, message: 'Account deletion is no longer available' }), async () => { verified++; });
  assert.equal(verified, 1);
  assert.equal(result, null);
});

test('real expired sessions are not treated as missing deletion requests', async () => {
  const expired = { status: 401, message: 'Invalid or expired token' };
  await assert.rejects(readDeletionStatus(reject({ status: 401, message: 'Account deletion is no longer available' }), reject(expired)), (e) => e === expired);
  assert.equal(isExpiredDeletionSession(expired), true);
});

test('a deletion endpoint error cannot expire a session confirmed by auth/me', async () => {
  await assert.rejects(readDeletionStatus(reject({ status: 401, message: 'Invalid or expired token' }), async () => {}), (e) => {
    assert.equal(isExpiredDeletionSession(e), false);
    assert.match(e.message, /session is active/);
    return true;
  });
});

test('wrong credentials and old availability responses never trigger automatic logout', () => {
  for (const message of ['Credential verification failed', 'Deletion proof is invalid or expired', 'Account deletion is no longer available']) {
    assert.equal(isExpiredDeletionSession({ status: 401, message }), false);
  }
});

test('network failures stay retryable errors and existing requests retain their status', async () => {
  const network = new Error('Network unavailable');
  await assert.rejects(readDeletionStatus(reject(network), async () => assert.fail('not needed')), (e) => e === network);
  await assert.rejects(readDeletionStatus(reject({ status: 401 }), reject(network)), (e) => e === network);
  const pending = { status: 'requested', reference: 'reference' };
  assert.equal(await readDeletionStatus(async () => pending, async () => assert.fail('not needed')), pending);
});
