const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const catalog = require('../src/lib/i18n/catalog.json');
function compile(file, imports) {
  const source = readFileSync(join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }});
  return exports;
}
const translations = compile('src/lib/translations.ts', { './i18n/catalog.json': catalog });
const { translate, isAppLanguage } = translations;

test('every interface translation is populated and preserves interpolation values', () => {
  const tokens = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort();
  for (const [key, values] of Object.entries(catalog)) {
    assert.equal(values.length, 2, key);
    for (const value of values) {
      assert.ok(value.trim(), key);
      assert.deepEqual(tokens(value), tokens(key), key);
    }
  }
});

test('languages translate interface text while unknown content falls back unchanged', () => {
  assert.equal(translate('english', 'App language'), 'App language');
  assert.equal(translate('malayalam', 'App language'), 'ആപ്പിന്റെ ഭാഷ');
  assert.equal(translate('hindi', 'App language'), 'ऐप की भाषा');
  for (const language of ['english', 'malayalam', 'hindi']) {
    assert.equal(translate(language, 'A publisher’s unique book title'), 'A publisher’s unique book title');
    const result = translate(language, 'Resend code in {{seconds}}s', { seconds: 0 });
    assert.ok(result.includes('0'));
    assert.ok(!result.includes('{{'));
  }
  assert.equal(isAppLanguage('all'), false);
  assert.equal(isAppLanguage('invalid'), false);
  assert.equal(isAppLanguage(null), false);
});

function mount(storage, { readFails = false, writeFails = false } = {}) {
  const slots = [], effects = [], writes = [];
  let cursor = 0, value;
  const provider = compile('src/providers/app-language.tsx', {
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], next => { slots[i] = next; }];
      },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
      useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
      useMemo: fn => fn(), useCallback: fn => fn, useContext: () => value,
    },
    'react/jsx-runtime': { jsx: (_type, props) => { value = props.value; } },
    '@/lib/api': {
      readPreference: async key => { if (readFails) throw new Error('Unavailable'); return storage[key]; },
      savePreference: async (key, next) => {
        writes.push([key, next]);
        if (writeFails) { writeFails = false; throw new Error('Storage full'); }
        storage[key] = next;
      },
    },
    '@/lib/translations': translations,
  });
  const render = () => { cursor = 0; provider.AppLanguageProvider({ children: null }); return value; };
  render(); effects.forEach(fn => fn());
  return { render, writes };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('UI language persists across restarts independently of listening language', async () => {
  const storage = { app_language: 'hindi', languagePreference: 'malayalam' };
  const app = mount(storage);
  assert.equal(app.render().ready, false);
  await flush();
  assert.equal(app.render().language, 'hindi');
  assert.equal(app.render().ready, true);
  await app.render().setLanguage('english');
  assert.equal(storage.languagePreference, 'malayalam');
  const restarted = mount(storage);
  await flush();
  assert.equal(restarted.render().language, 'english');
  assert.equal(restarted.render().t('Home'), 'Home');
});

test('invalid or unreadable preferences fall back safely and do not block startup', async () => {
  for (const app of [mount({ app_language: 'all' }), mount({}, { readFails: true })]) {
    await flush();
    assert.equal(app.render().language, 'english');
    assert.equal(app.render().ready, true);
  }
});

test('rapid changes save the latest selection even after a failed write', async () => {
  const storage = {};
  const app = mount(storage, { writeFails: true });
  await flush();
  const failed = app.render().setLanguage('malayalam');
  const last = app.render().setLanguage('hindi');
  assert.equal(app.render().language, 'hindi');
  await assert.rejects(failed);
  await last;
  assert.equal(storage.app_language, 'hindi');
});
