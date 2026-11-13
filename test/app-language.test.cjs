const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const catalog = require('../src/lib/i18n/catalog.json');
const international = require('../src/lib/i18n/international.json');
const indian = require('../src/lib/i18n/indian.json');
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
const indianLanguages = compile('src/lib/i18n/indian-languages.ts', {});
const translations = compile('src/lib/translations.ts', { './i18n/catalog.json': catalog, './i18n/international.json': international, './i18n/indian.json': indian, './i18n/indian-languages': indianLanguages });
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
  for (const [language, entries] of Object.entries({ ...international, ...indian })) {
    assert.deepEqual(Object.keys(entries).sort(), Object.keys(catalog).sort(), `${language} coverage`);
    for (const [key, value] of Object.entries(entries)) {
      assert.ok(value.trim(), `${language}: ${key}`);
      assert.deepEqual(tokens(value), tokens(key), `${language}: ${key}`);
      assert.equal(translate(language, key), value, `${language}: ${key}`);
    }
  }
});

test('languages translate interface text while unknown content falls back unchanged', () => {
  assert.equal(translate('english', 'App language'), 'App language');
  assert.equal(translate('malayalam', 'App language'), 'ആപ്പിന്റെ ഭാഷ');
  assert.equal(translate('hindi', 'App language'), 'ऐप की भाषा');
  for (const language of translations.APP_LANGUAGES) {
    assert.equal(isAppLanguage(language), true);
    assert.equal(translate(language, 'A publisher’s unique book title'), 'A publisher’s unique book title');
    const result = translate(language, 'Resend code in {{seconds}}s', { seconds: 0 });
    assert.ok(result.includes('0'));
    assert.ok(!result.includes('{{'));
  }
  assert.equal(isAppLanguage('all'), false);
  assert.equal(isAppLanguage('invalid'), false);
  assert.equal(isAppLanguage(null), false);
  assert.equal(isAppLanguage('toString'), false);
  assert.equal(isAppLanguage('__proto__'), false);
  assert.equal(translations.APP_LANGUAGES.length, 29);
  assert.equal(Object.keys(translations.INDIAN_LANGUAGE_NAMES).length, 22);
  assert.equal(translate('japanese', 'Notifications'), '通知');
  assert.equal(translate('spanish', 'App language'), 'Idioma de la aplicación');
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

test('every translated language survives restart without changing listening preferences', async () => {
  for (const [language, entries] of Object.entries({ ...international, ...indian })) {
    const storage = { languagePreference: 'malayalam' };
    const app = mount(storage);
    await flush();
    await app.render().setLanguage(language);
    const restarted = mount(storage);
    await flush();
    assert.equal(restarted.render().language, language);
    assert.equal(restarted.render().t('Refresh notifications'), entries['Refresh notifications']);
    assert.equal(storage.languagePreference, 'malayalam');
  }
});

test('the eight languages awaiting review persist with explicit English fallback', async () => {
  const pending = ['bodo', 'dogri', 'kashmiri', 'konkani', 'maithili', 'manipuri', 'santali', 'sindhi'];
  assert.deepEqual(Array.from(translations.APP_LANGUAGES).filter(language => !translations.hasAppLanguageTranslations(language)).sort(), pending.sort());
  assert.equal(Object.keys(indian).length, 12);
  for (const language of pending) {
    const storage = { languagePreference: 'malayalam' };
    const app = mount(storage);
    await flush();
    await app.render().setLanguage(language);
    const restarted = mount(storage);
    await flush();
    assert.equal(restarted.render().language, language);
    assert.equal(restarted.render().t('Delete your account?'), 'Delete your account?');
    assert.equal(restarted.render().t('Episode {{number}}', { number: 3 }), 'Episode 3');
    assert.equal(storage.languagePreference, 'malayalam');
  }
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

test('language picker searches native names, scrolls all app languages, and preserves listening options', () => {
  let query = '';
  let dismissed = 0;
  const selected = [];
  const jsx = (type, props) => ({ type, props });
  const { LanguageSheet } = compile('src/components/ui/language-sheet.tsx', {
    react: { useState: () => [query, next => { query = next; }] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': Object.assign(Object.fromEntries(['Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name])), { Animated: { View: 'AnimatedView' }, useWindowDimensions: () => ({ height: 600 }) }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/providers/motion': { useAppMotion: () => ({ animationsEnabled: true }) },
    '@/providers/app-language': { useAppLanguage: () => ({ t: text => text }) },
    '@/lib/translations': translations,
    'react-native-reanimated': { View: 'AnimatedView' },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView' },
    '@/components/ui/pull-scrollables': { PullScrollView: 'PullScrollView' },
    '@/hooks/use-sheet-dismiss': { useSheetDismiss: (_visible, onClose) => ({ dismiss: onClose, reset() {}, style: {}, gesture: 'headerGesture', contentGesture: 'listGesture', scrollProps: { simultaneousWith: 'listGesture' } }) },
  });
  function nodes(tree) {
    return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  }
  const render = (mode = 'app') => LanguageSheet({ visible: true, selected: 'english', mode, onSelect: language => selected.push(language), onClose: () => { dismissed++; } });
  const choices = tree => nodes(tree).filter(node => node.props?.accessibilityState && 'selected' in node.props.accessibilityState);
  assert.equal(choices(render()).length, 29);
  assert.equal(nodes(render()).filter(node => node.type === 'Text' && node.props.children === 'English fallback').length, 8);
  const modalContent = render().props.children;
  assert.equal(modalContent.type, 'GestureHandlerRootView', 'the native modal needs its own gesture root');
  assert.ok(nodes(render()).some(node => node.type === 'GestureDetector' && node.props.gesture === 'headerGesture'));
  assert.ok(nodes(render()).some(node => node.type === 'GestureDetector' && node.props.gesture === 'listGesture'));
  assert.equal(nodes(render()).find(node => node.type === 'PullScrollView').props.simultaneousWith, 'listGesture');
  nodes(render()).find(node => node.type === 'TextInput').props.onChangeText('francais');
  assert.equal(choices(render()).length, 1);
  choices(render())[0].props.onPress();
  assert.deepEqual(selected, ['french']);
  query = '日本';
  choices(render())[0].props.onPress();
  assert.equal(selected[1], 'japanese');
  for (const [queryText, language] of [['Meitei', 'manipuri'], ['Oriya', 'odia'], ['Santhali', 'santali'], ['اردو', 'urdu']]) {
    query = queryText;
    assert.equal(choices(render()).length, 1);
    choices(render())[0].props.onPress();
    assert.equal(selected.at(-1), language);
  }
  assert.ok(nodes(render()).some(node => node.type === 'Text' && node.props.style?.writingDirection === 'rtl'));
  assert.equal(dismissed, 0, 'selecting rows does not trigger the backdrop');
  const tree = render();
  nodes(tree).find(node => node.props?.accessibilityLabel === 'Close language picker').props.onPress();
  tree.props.onRequestClose();
  nodes(tree).find(node => node.type === 'AnimatedView').props.onAccessibilityEscape();
  assert.equal(dismissed, 3);
  for (const mode of ['app', 'listening']) {
    const closeButton = nodes(render(mode)).find(node => node.props?.accessibilityLabel === 'Close');
    assert.equal(closeButton.props.accessibilityRole, 'button');
    closeButton.props.onPress();
  }
  assert.equal(dismissed, 5, 'the visible close button dismisses either language picker');
  query = 'not-a-language';
  assert.equal(choices(render()).length, 0);
  render().props.onShow();
  assert.equal(choices(render()).length, 29);
  assert.equal(choices(render('listening')).length, 4);
});
