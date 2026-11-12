const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
function compile(file, imports, globals = {}) {
  const source = readFileSync(join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }});
  return exports;
}
const schedule = compile('src/lib/theme-schedule.ts', {});
test('day/night uses local hours with 6 AM and 6 PM boundaries', () => {
  for (const [hour, minute, expected] of [[0, 0, true], [5, 59, true], [6, 0, false], [12, 0, false], [17, 59, false], [18, 0, true], [23, 59, true]]) {
    assert.equal(schedule.isNightTime(new Date(2026, 10, 12, hour, minute)), expected);
  }
});
function mount(storage, hour = 12) {
  let time = new Date(2026, 10, 12, hour).getTime(), cursor = 0, value, id = 0;
  const slots = [], pendingEffects = [], timers = new Map(), listeners = new Set(), schemes = [];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
    static now() { return time; }
  }
  const localSchedule = compile('src/lib/theme-schedule.ts', {}, { Date: Clock });
  const memo = (fn, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) slots[index] = { value: fn(), deps };
    return slots[index].value;
  };
  const provider = compile('src/providers/theme.tsx', {
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], next => { slots[index] = next; }];
      },
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useMemo: memo,
      useCallback: (fn, deps) => memo(() => fn, deps),
      useContext: () => value,
      useEffect(fn, deps) {
        const index = cursor++, old = slots[index];
        if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
          pendingEffects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
        }
      },
    },
    'react/jsx-runtime': { jsx: (_type, props) => { value = props.value; } },
    nativewind: { colorScheme: { set: next => schemes.push(next) } },
    'react-native': { AppState: { addEventListener: (_event, listener) => {
      listeners.add(listener); return { remove: () => listeners.delete(listener) };
    }}},
    '@/lib/api': {
      readPreference: async key => storage[key],
      savePreference: async (key, next) => { storage[key] = next; },
    },
    '@/lib/theme-schedule': localSchedule,
  }, {
    Date: Clock,
    setTimeout: fn => { timers.set(++id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const render = () => {
    cursor = 0;
    provider.ThemeProvider({ children: null });
    pendingEffects.splice(0).forEach(fn => fn());
    return value;
  };
  render();
  return {
    render, schemes, timers, listeners,
    setHour: hour => { time = new Date(2026, 10, 12, hour).getTime(); },
    tick: () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
    resume: () => listeners.forEach(fn => fn('active')),
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  };
}
test('Auto restores and follows the clock across day/night and foreground resume', async () => {
  const storage = { theme_mode: 'auto' };
  const app = mount(storage, 17);
  await flush();
  assert.equal(app.render().auto, true);
  assert.equal(app.render().dark, false);
  app.setHour(18);
  app.tick();
  assert.equal(app.render().dark, true);
  assert.equal(storage.theme_mode, 'auto');
  app.setHour(6);
  app.resume();
  assert.equal(app.render().dark, false);
  assert.equal(app.schemes.at(-1), 'light');
  app.unmount();
  assert.equal(app.timers.size, 0);
  assert.equal(app.listeners.size, 0);
});
test('existing manual preferences remain manual; Auto applies immediately and persists', async () => {
  const storage = { theme_mode: 'dark' };
  const app = mount(storage, 12);
  await flush();
  assert.equal(app.render().dark, true);
  assert.equal(app.render().auto, false);
  await app.render().setAuto(true);
  assert.equal(app.render().dark, false);
  assert.equal(storage.theme_mode, 'auto');
  await app.render().setAuto(false);
  assert.equal(app.render().auto, false);
  assert.equal(app.render().dark, false);
  assert.equal(storage.theme_mode, 'light');
  assert.equal(app.timers.size, 0);
  app.unmount();
});
test('manual override disables Auto immediately and wins over rapid preference changes', async () => {
  const storage = { theme_mode: 'auto' };
  const app = mount(storage, 12);
  await flush();
  app.render();
  const first = app.render().setAuto(true);
  const last = app.render().setDark(true);
  app.resume(); // A queued lifecycle event must not undo the manual choice.
  assert.equal(app.render().auto, false);
  assert.equal(app.render().dark, true);
  await Promise.all([first, last]);
  assert.equal(storage.theme_mode, 'dark');
  assert.equal(app.timers.size, 0);
  app.unmount();
});
