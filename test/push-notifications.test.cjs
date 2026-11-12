const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../src/lib/push-notifications.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function runtime({ supported = true, missing, importError = false } = {}) {
  let imports = 0;
  const warnings = [];
  const checks = [];
  const notifications = { setNotificationHandler() {} };
  const helpers = {};
  runInNewContext(code, {
    exports: helpers,
    __DEV__: true,
    console: { warn: (message) => warnings.push(message) },
    require(name) {
      if (name === './app-environment') return { PUSH_NOTIFICATIONS_SUPPORTED: supported };
      if (name === 'expo') return {
        requireOptionalNativeModule(moduleName) {
          checks.push(moduleName);
          return moduleName === missing ? null : {};
        },
      };
      if (name === 'expo-notifications') {
        imports++;
        if (importError) throw new Error('Native module unavailable');
        return notifications;
      }
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { ...helpers, warnings, checks, notifications, imports: () => imports };
}

test('loading the helper never eagerly imports notifications', () => {
  const app = runtime();
  assert.equal(app.imports(), 0);
  assert.equal(app.checks.length, 0);
});

test('Expo Go and web skip native probes and notification imports', async () => {
  const app = runtime({ supported: false });
  assert.equal(await app.loadPushNotifications(), null);
  assert.equal(app.imports(), 0);
  assert.equal(app.checks.length, 0);
});

test('missing native modules cannot crash startup or evaluate notifications', async () => {
  for (const missing of ['ExpoApplication', 'ExpoNotificationsEmitter', 'ExpoNotificationsHandlerModule', 'ExpoPushTokenManager']) {
    const app = runtime({ missing });
    assert.equal(await app.loadPushNotifications(), null);
    assert.equal(await app.loadPushNotifications(), null);
    assert.equal(app.imports(), 0);
    assert.equal(app.warnings.length, 1);
    assert.ok(app.warnings[0].includes(missing));
  }
});

test('compatible builds share one import and expose the notification API', async () => {
  const app = runtime();
  const first = app.loadPushNotifications();
  assert.equal(app.loadPushNotifications(), first);
  assert.equal((await first).setNotificationHandler, app.notifications.setNotificationHandler);
  assert.equal(app.imports(), 1);
  assert.equal(app.warnings.length, 0);
});

test('other native import failures remain isolated from the root layout', async () => {
  const app = runtime({ importError: true });
  assert.equal(await app.loadPushNotifications(), null);
  assert.equal(await app.loadPushNotifications(), null);
  assert.equal(app.imports(), 1);
  assert.equal(app.warnings.length, 1);
});
