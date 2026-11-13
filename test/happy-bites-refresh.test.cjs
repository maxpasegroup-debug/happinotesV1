const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function compile(file, imports) {
  const code = ts.transpileModule(readFileSync(join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, URLSearchParams, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  } });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function hookState() {
  let cursor = 0;
  const slots = [];
  return {
    reset: () => { cursor = 0; },
    hooks: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
      },
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
      createContext: () => ({ Provider: 'Provider' }),
    },
  };
}

test('forced reloads bypass reused URLs and preserve category, pagination and no-store', async () => {
  const calls = [];
  const api = compile('src/lib/happy-bites.ts', {
    '@/lib/api': { request: async (path, options) => { calls.push({ path, options }); return { items: [] }; } },
    '@/lib/happy-bite-access': { parseHappyBite: item => item },
  });
  await api.fetchHappyBites(1, 'all', true);
  await api.fetchHappyBites(1, 'all', true);
  await api.fetchHappyBites(2, 'Positive thoughts');
  assert.notEqual(calls[0].path, calls[1].path);
  for (const call of calls) assert.equal(call.options.cache, 'no-store');
  assert.equal(new URL(calls[0].path, 'https://api.test').searchParams.has('category'), false);
  const paginated = new URL(calls[2].path, 'https://api.test');
  assert.equal(paginated.searchParams.get('category'), 'Positive thoughts');
  assert.equal(paginated.searchParams.get('page'), '2');
  assert.equal(paginated.searchParams.has('_refresh'), false);
});

test('refresh replaces edited/deleted content and an older response cannot undo it', async () => {
  const state = hookState(), calls = [];
  const { HappyBitesProvider } = compile('src/providers/happy-bites.tsx', {
    react: state.hooks,
    'react/jsx-runtime': { jsx },
    '@/lib/api': { apiErrorMessage: error => error.message },
    '@/lib/happy-bites': { fetchHappyBites: (...args) => { const request = deferred(); calls.push({ args, ...request }); return request.promise; } },
  });
  const render = () => { state.reset(); return HappyBitesProvider({ children: null }).props.value; };
  const older = render().loadFirst('all');
  const fresh = render().loadFirst('all', true);
  assert.equal(calls[1].args[2], true);
  assert.equal(render().loading, true);
  calls[1].resolve({ items: [{ id: 'updated', category: 'Joy', title: 'Edited title' }], categories: ['Joy'], hasMore: false });
  await fresh;
  calls[0].resolve({ items: [{ id: 'deleted' }], categories: [], hasMore: true });
  await older;
  assert.equal(render().items[0].title, 'Edited title');
  assert.equal(render().hasMore, false);
  assert.equal(render().loading, false);
  const failed = render().loadFirst('all', true);
  calls[2].reject(new Error('Network unavailable'));
  await failed;
  assert.equal(render().error, 'Network unavailable');
  const retry = render().loadFirst('all', true);
  calls[3].resolve({ items: [], categories: [], hasMore: false });
  await retry;
  assert.equal(render().error, null);
  assert.equal(render().items.length, 0);
});

test('realtime reload uses the current category even before the next render', async () => {
  const state = hookState(), calls = [];
  const { HappyBitesProvider } = compile('src/providers/happy-bites.tsx', {
    react: state.hooks, 'react/jsx-runtime': { jsx },
    '@/lib/api': { apiErrorMessage: error => error.message },
    '@/lib/happy-bites': { fetchHappyBites: async (...args) => {
      calls.push(args);
      return { items: [], categories: [], hasMore: false };
    } },
  });
  const actions = HappyBitesProvider({ children: null }).props.value;
  await actions.loadFirst('Joy');
  await actions.reloadActive();
  assert.deepEqual(calls[1], [1, 'Joy', true]);
  await actions.loadFirst('all');
  await actions.reloadActive();
  assert.deepEqual(calls[3], [1, 'all', true]);
});

function mountHome(loadBooks, bites) {
  const state = hookState();
  let refresh;
  const imports = {
    react: state.hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', useWindowDimensions: () => ({ width: 390 }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { router: {}, useFocusEffect() {} },
    '@/providers/app-language': { useAppLanguage: () => ({ t: text => text }) },
    '@/providers/auth': { useAuth: () => ({ user: null }) },
    '@/providers/books': { useBooks: () => ({ books: [], upcoming: [], library: [], hasLoaded: true, loadBooks }) },
    '@/providers/notifications': { useNotifications: () => ({}) },
    '@/providers/happy-bites': { useHappyBites: () => bites },
    '@/providers/player': { usePlayer: () => ({}) },
    '@/providers/toast': { useToast: () => ({}) },
    '@/lib/api': { apiErrorMessage: error => error.message },
    '@/lib/format': {}, '@/lib/happy-bites': {},
    '@/hooks/use-elastic-refresh': { useElasticRefresh: (_busy, callback) => { refresh = callback; return {}; } },
  };
  for (const [file, names] of Object.entries({
    'book-visuals': ['BookCard', 'Cover'], skeleton: ['SkeletonBox'],
    'inline-state': ['InlineState', 'SectionTitle'], 'book-pull-surface': ['BookPullSurface'],
    'pull-scrollables': ['PullScrollView'], 'language-sheet': ['LanguageSheet'],
  })) imports[`@/components/ui/${file}`] = Object.fromEntries(names.map(name => [name, name]));
  imports['@/components/happy-bite-card'] = { HappyBiteCard: 'HappyBiteCard' };
  const { default: Home } = compile('src/app/(tabs)/index.tsx', imports);
  const render = () => { state.reset(); return Home(); };
  render();
  return { render, refresh: () => refresh() };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

test('Home pulls both feeds and waits for Happy Bites even when books fail', async () => {
  const books = deferred(), bites = deferred(), calls = [];
  const app = mountHome(options => { calls.push(['books', options.forceRefresh]); return books.promise; }, {
    items: [], loadFirst: (category, force) => { calls.push(['bites', category, force]); return bites.promise; },
  });
  const refresh = app.refresh();
  assert.deepEqual(calls, [['books', true], ['bites', 'all', true]]);
  books.reject(new Error('Books failed'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(find(app.render(), node => node.type === 'BookPullSurface').props.refreshing, true);
  bites.resolve();
  await refresh;
  assert.equal(find(app.render(), node => node.type === 'BookPullSurface').props.refreshing, false);
});

test('Home exposes Happy Bites loading and failure with a forced retry', () => {
  const calls = [], bites = { items: [], loading: true, error: null, loadFirst: (...args) => calls.push(args) };
  const app = mountHome(async () => {}, bites);
  assert.ok(find(app.render(), node => node.props?.accessibilityState?.busy));
  bites.loading = false;
  bites.error = 'Network unavailable';
  const error = find(app.render(), node => node.type === 'InlineState' && node.props.title === 'Couldn’t load Happy Bites');
  assert.equal(error.props.message, 'Network unavailable');
  error.props.onAction();
  assert.deepEqual(calls, [['all', true]]);
});
