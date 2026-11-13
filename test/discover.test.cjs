const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function compile(file, requireMock) {
  const code = ts.transpileModule(readFileSync(join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: requireMock });
  return exports;
}
const library = (fetchHappyBites = async () => ({ items: [], hasMore: false })) => compile('src/lib/discover.ts', name => {
  assert.equal(name, '@/lib/happy-bites');
  return { fetchHappyBites };
});
const book = (id, title, description = '', category = '') => ({ id, title, description, category, language: 'english' });
const bite = (id, title, description = '', category = '') => ({ id, title, description, category });
const ids = items => Array.from(items, ({ kind, item }) => `${kind}:${item.id}`);

test('each filter searches only its content type, preserving both items when IDs collide', () => {
  const { filterDiscover } = library();
  const books = [book('same', 'Joy'), book('other', 'Focus')];
  const bites = [bite('same', 'Joy')];
  assert.deepEqual(ids(filterDiscover(books, bites, 'books', 'joy')), ['book:same']);
  assert.deepEqual(ids(filterDiscover(books, bites, 'bites', 'joy')), ['bite:same']);
  assert.deepEqual(ids(filterDiscover(books, bites, 'both', 'joy')), ['book:same', 'bite:same']);
});

test('search trims whitespace, ignores case and matches title, description and category', () => {
  const { filterDiscover } = library();
  const books = [book('1', 'Better Days', 'Build a calm routine', 'Mindfulness')];
  assert.equal(filterDiscover(books, [], 'books', '  CALM   days  ').length, 1);
  assert.equal(filterDiscover(books, [], 'books', 'mindfulness').length, 1);
  assert.equal(filterDiscover(books, [], 'books', 'not found').length, 0);
  assert.equal(filterDiscover(books, [], 'books', '  ').length, 1);
  assert.equal(books[0].title, 'Better Days');
});

test('Both interleaves types while retaining each catalog order', () => {
  const { filterDiscover } = library();
  assert.deepEqual(ids(filterDiscover([book('a', ''), book('b', ''), book('c', '')], [bite('a', ''), bite('b', '')], 'both', '')), ['book:a', 'bite:a', 'book:b', 'bite:b', 'book:c']);
});

test('Bites search includes later pages and deduplicates overlapping pages', async () => {
  const calls = [];
  const { fetchDiscoverBites, filterDiscover } = library(async (page, category, force) => {
    calls.push([page, category, force]);
    return page === 1 ? { items: [bite('a', 'First')], hasMore: true } : { items: [bite('a', 'First'), bite('b', 'Later match')], hasMore: false };
  });
  const items = await fetchDiscoverBites(() => true);
  assert.deepEqual(calls, [[1, 'all', true], [2, 'all', true]]);
  assert.equal(items.length, 2);
  assert.deepEqual(ids(filterDiscover([], items, 'bites', 'later')), ['bite:b']);
});

test('leaving Discover stops paging and discards an in-flight result', async () => {
  let active = true;
  let calls = 0;
  const { fetchDiscoverBites } = library(async () => {
    calls++;
    active = false;
    return { items: [bite('old', 'Old')], hasMore: true };
  });
  assert.equal((await fetchDiscoverBites(() => active)).length, 0);
  assert.equal(calls, 1);
});

test('a failed later page is reported instead of silently presenting an incomplete search', async () => {
  const { fetchDiscoverBites } = library(async page => {
    if (page === 2) throw new Error('offline');
    return { items: [bite('a', 'First')], hasMore: true };
  });
  await assert.rejects(fetchDiscoverBites(() => true), /offline/);
});

const jsx = (type, props) => ({ type, props });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return [node.props?.children].flat(Infinity).map(child => find(child, predicate)).find(Boolean);
}
test('signed-out and initializing sessions cannot enter tabs; authenticated sessions can', () => {
  let auth = { initialized: true, user: { id: 'user' } };
  const Stack = Object.assign(() => null, { Screen: 'Screen', Protected: 'Protected' });
  const { default: RootLayout } = compile('src/app/_layout.tsx', name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'expo-router') return { Stack, ThemeProvider: 'NavigationThemeProvider', DarkTheme: { dark: true, colors: {} }, DefaultTheme: { dark: false, colors: {} } };
    if (name === 'react-native') return { View: 'View', Platform: { OS: 'android' } };
    if (name === '@/providers/auth') return { useAuth: () => auth, AuthProvider: 'AuthProvider' };
    if (name === '@/providers/theme') return { useAppTheme: () => ({ dark: false }), ThemeProvider: 'ThemeProvider' };
    if (name === '@/providers/motion') return { useAppMotion: () => ({ animationsEnabled: true }), MotionProvider: 'MotionProvider' };
    return new Proxy({}, { get: (_, key) => key });
  });
  const render = () => {
    const root = find(RootLayout(), node => typeof node.type === 'function' && node.type.name === 'RootNavigator');
    return find(root.type(), node => node.type === 'Protected');
  };
  assert.equal(render().props.guard, true);
  assert.ok(find(render(), node => node.type === 'Screen' && node.props.name === '(tabs)'));
  auth = { initialized: true, user: null };
  assert.equal(render().props.guard, false);
  auth = { initialized: false, user: null };
  assert.equal(render().props.guard, false);
});

test('Discover controls keep the query when switching filters and use separate catalog requests', async () => {
  let cursor = 0, focused = false;
  const slots = [];
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useCallback: value => value,
    useMemo: fn => fn(),
  };
  const requests = [];
  const discover = library();
  const { default: Search } = compile('src/app/search.tsx', name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react-native') return { FlatList: 'FlatList', Pressable: 'Pressable', TextInput: 'TextInput', Text: 'Text', View: 'View', ActivityIndicator: 'ActivityIndicator', useWindowDimensions: () => ({ width: 390 }) };
    if (name === 'expo-router') return { router: {}, useLocalSearchParams: () => ({}), useFocusEffect: callback => { if (!focused) { focused = true; callback(); } } };
    if (name === '@/providers/app-language') return { useAppLanguage: () => ({ t: text => text }) };
    if (name === '@/providers/player') return { usePlayer: () => ({ playEpisode() {} }) };
    if (name === '@/providers/toast') return { useToast: () => ({ showToast() {} }) };
    if (name === '@/lib/api') return { apiErrorMessage: e => e.message, fetchBooks: async () => { requests.push('books'); return [book('a', 'Joy'), book('b', 'Focus')]; } };
    if (name === '@/lib/discover') return { ...discover, fetchDiscoverBites: async () => { requests.push('bites'); return [bite('c', 'Joy')]; } };
    return new Proxy({}, { get: (_, key) => key });
  });
  const render = () => { cursor = 0; return Search(); };
  render();
  await new Promise(resolve => setImmediate(resolve));
  let view = render();
  assert.deepEqual(requests, ['books', 'bites']);
  const input = () => find(view, node => node.type === 'TextInput');
  input().props.onChangeText('joy');
  view = render();
  assert.deepEqual(ids(find(view, node => node.type === 'FlatList').props.data), ['book:a', 'bite:c']);
  find(view, node => node.props?.accessibilityRole === 'tab' && node.props.accessibilityLabel === 'Bites').props.onPress();
  view = render();
  assert.equal(input().props.value, 'joy');
  assert.equal(input().props.placeholder, 'Search Happy Bites');
  assert.deepEqual(ids(find(view, node => node.type === 'FlatList').props.data), ['bite:c']);
  find(view, node => node.props?.accessibilityRole === 'tab' && node.props.accessibilityLabel === 'Books').props.onPress();
  view = render();
  assert.equal(input().props.value, 'joy');
  assert.deepEqual(ids(find(view, node => node.type === 'FlatList').props.data), ['book:a']);
  assert.equal(requests.length, 2, 'filtering a loaded catalog should not fetch on every keystroke');
});

test('tab transitions stay opaque throughout a switch and settle when motion is disabled', () => {
  let animationsEnabled = true;
  const Tabs = Object.assign(() => null, { Screen: 'Screen' });
  const { default: TabsLayout } = compile('src/app/(tabs)/_layout.tsx', name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useEffect() {} };
    if (name === 'react-native') return { View: 'View', Easing: { out: value => value, cubic: 'cubic' } };
    if (name === 'expo-router') return { Tabs };
    if (name === '@/providers/motion') return { useAppMotion: () => ({ animationsEnabled }) };
    if (name === '@/providers/theme') return { useAppTheme: () => ({ dark: true }) };
    if (name === '@/providers/books') return { useBooks: () => ({ loadCollection() {} }) };
    return new Proxy({}, { get: (_, key) => key });
  });
  const options = () => find(TabsLayout(), node => node.type === Tabs).props.screenOptions;
  const enabled = options();
  for (const progress of [-1, -0.5, 0, 0.5, 1]) {
    const style = enabled.sceneStyleInterpolator({ current: { progress: { interpolate: ({ outputRange }) => progress < 0 ? -progress * outputRange[0] : progress * outputRange[2] } } }).sceneStyle;
    assert.equal(style.opacity, 1, 'neither screen should expose the background through a fade');
    if (progress === 0) assert.equal(style.transform[0].translateX, 0);
  }
  animationsEnabled = false;
  const disabled = options();
  assert.equal(disabled.animation, enabled.animation, 'keep the native animation graph stable');
  assert.equal(disabled.transitionSpec.config.duration, 0);
  animationsEnabled = true;
  assert.ok(options().transitionSpec.config.duration > 0);
});
