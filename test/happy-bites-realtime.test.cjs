const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function mount() {
  const events = new Map(), timers = new Map(), slots = [], effects = [];
  const calls = { books: 0, bites: 0, plans: 0, admin: 0, connect: 0, disconnect: 0 };
  let cursor = 0, timerId = 0, appState, appStateRemoved = false;
  let reloadBites = () => { calls.bites++; };
  const user = { role: 'user' };
  const socket = {
    connected: true,
    on(name, fn) { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); },
    connect() { calls.connect++; },
    disconnect() { calls.disconnect++; },
    removeAllListeners() { events.clear(); },
  };
  const imports = {
    react: {
      useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
      useEffect(fn, deps) {
        const index = cursor++, previous = slots[index];
        if (!deps || !previous || deps.some((value, i) => value !== previous.deps?.[i])) {
          effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
        }
      },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: 'web' }, AppState: { addEventListener: (_name, fn) => {
      appState = fn; return { remove() { appStateRemoved = true; } };
    } } },
    'expo-router': {}, 'socket.io-client': { io: () => socket },
    '@/lib/api': { API_ORIGIN: 'https://api.test', API_SOCKET_PATH: '/socket.io' },
    '@/lib/push-notifications': {},
    '@/providers/auth': { useAuth: () => ({ user }) },
    '@/providers/books': { useBooks: () => ({ reloadActive: () => { calls.books++; } }) },
    '@/providers/happy-bites': { useHappyBites: () => ({ reloadActive: reloadBites }) },
    '@/providers/admin': { useAdmin: () => ({ loadAll: () => { calls.admin++; } }) },
    '@/providers/subscription': { useSubscription: () => ({ reload: () => { calls.plans++; } }) },
    '@/providers/notifications': {},
  };
  const source = readFileSync(join(__dirname, '../src/components/runtime-bridge.tsx'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports, require(name) {
      if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
      return imports[name];
    },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  // Mount the actual realtime child, without mounting the unrelated native push child.
  const Component = exports.RuntimeBridge().props.children[0].type;
  const render = () => { cursor = 0; Component(); while (effects.length) effects.shift()(); };
  render();
  return {
    calls, events, socket, render,
    emit(name) { for (const fn of events.get(name) ?? []) fn(); },
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    resume(state = 'active') { appState(state); },
    updateReload(fn) { reloadBites = fn; render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    removed: () => appStateRemoved,
  };
}

test('Happy Bite events debounce reloads without changing audiobook or subscription handlers', () => {
  const app = mount();
  app.emit('happy-bites:changed');
  app.emit('happy-bites:changed');
  assert.equal(app.calls.bites, 0);
  app.flush();
  assert.equal(app.calls.bites, 1);
  assert.equal(app.calls.books, 0);
  assert.equal(app.calls.plans, 0);
  app.emit('books:changed');
  app.emit('subscription-plans:changed');
  app.flush();
  assert.equal(app.calls.books, 1);
  assert.equal(app.calls.plans, 1);
  assert.equal(app.calls.bites, 1);
  assert.equal(app.calls.admin, 0);
});

test('connect, reconnect and foreground resync Happy Bites after missed events', () => {
  const app = mount();
  app.emit('connect'); app.flush();
  app.emit('connect'); app.flush();
  assert.equal(app.calls.bites, 2);
  app.resume('background'); app.flush();
  assert.equal(app.calls.bites, 2);
  app.socket.connected = false;
  app.resume(); app.flush();
  assert.equal(app.calls.connect, 1);
  assert.equal(app.calls.bites, 3);
});

test('listeners use the latest reload callback and clean up pending timers on unmount', () => {
  const app = mount();
  let freshCalls = 0;
  app.updateReload(() => { freshCalls++; });
  assert.equal(app.events.get('happy-bites:changed').length, 1);
  app.emit('happy-bites:changed'); app.flush();
  assert.equal(freshCalls, 1);
  assert.equal(app.calls.bites, 0);
  app.emit('happy-bites:changed');
  app.unmount(); app.flush();
  assert.equal(freshCalls, 1);
  assert.equal(app.events.size, 0);
  assert.equal(app.calls.disconnect, 1);
  assert.equal(app.removed(), true);
});
