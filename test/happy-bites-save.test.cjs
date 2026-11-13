const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function compile(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, __DEV__: false, URL, URLSearchParams, setTimeout, clearTimeout, AbortController, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  } });
  return exports;
}
const access = compile('src/lib/happy-bite-access.ts');
const biteId = '507f1f77bcf86cd799439011';
const bite = access.parseHappyBite({ _id: biteId, title: 'A happy thought', audioUrl: '/bite.mp3', published: true });
const biteBook = access.happyBiteAsBook(bite);
const rawBook = { _id: '507f1f77bcf86cd799439012', title: 'An audiobook', status: 'live', introAudioUrl: '/book.mp3' };
const jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function backend() {
  const saved = new Set(), calls = [];
  let fail = false, holdWrite, holdRead;
  const api = compile('src/lib/api.ts', {
    'expo-secure-store': { getItemAsync: async () => 'test-token' },
    'react-native': { Platform: { OS: 'android' } },
    './happy-bite-access': access,
  }, {
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.test' } },
    fetch: async (url, options) => {
      const path = new URL(url).pathname, method = options.method ?? 'GET';
      calls.push({ path, method, options });
      let payload;
      if (method === 'GET') {
        payload = { collection: [rawBook], happyBites: saved.has(biteId) ? [bite] : [] };
        if (holdRead) await holdRead.promise;
      } else {
        if (holdWrite) await holdWrite.promise;
        if (fail) return { ok: false, status: 500, json: async () => ({ message: 'Save failed' }) };
        if (path.includes('/happy-bites/')) method === 'POST' ? saved.add(biteId) : saved.delete(biteId);
        payload = { success: true };
      }
      return { ok: true, status: 200, json: async () => payload };
    },
  });
  return { api, calls, saved, fail: () => { fail = true; }, holdWrite: () => holdWrite = deferred(), holdRead: () => holdRead = deferred() };
}
function mount(api) {
  const slots = []; let cursor = 0;
  const provider = compile('src/providers/books.tsx', {
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
      useCallback: fn => fn, useMemo: fn => fn(),
    },
    'react/jsx-runtime': { jsx }, '@/lib/api': api,
  });
  return () => { cursor = 0; return provider.BooksProvider({ children: null }).props.value; };
}

test('Happy Bite saves use real IDs on their own endpoint and survive a fresh provider', async () => {
  const server = backend(), render = mount(server.api);
  assert.equal(await render().addToCollection(biteBook), null);
  assert.equal(server.calls[0].path, `/collection/happy-bites/${biteId}`);
  assert.equal(server.calls[0].method, 'POST');
  assert.equal(render().library[0].happyBiteId, biteId);
  const restarted = mount(server.api);
  await restarted().loadCollection();
  assert.equal(restarted().library.length, 2);
  const restored = restarted().library.find(item => item.happyBiteId);
  assert.equal(restored.id, biteBook.id);
  assert.equal(restored.audioUrl, '/bite.mp3');
  assert.equal(await restarted().toggleCollection(restored), null);
  assert.equal(server.calls.at(-1).method, 'DELETE');
  assert.equal(server.calls.at(-1).path, `/collection/happy-bites/${biteId}`);
  await restarted().loadCollection(true);
  assert.equal(restarted().library.length, 1);
  assert.equal(restarted().library[0].id, rawBook._id);
});

test('ordinary audiobook saves retain their existing endpoint', async () => {
  const server = backend(), render = mount(server.api);
  const book = server.api.parseBook(rawBook);
  await render().addToCollection(book);
  await render().removeFromCollection(book);
  assert.deepEqual(server.calls.map(call => [call.method, call.path]), [['POST', `/collection/${rawBook._id}`], ['DELETE', `/collection/${rawBook._id}`]]);
});

test('duplicate taps issue one request and failed saves never mark a bite as saved', async () => {
  const server = backend(), render = mount(server.api), hold = server.holdWrite();
  const saving = render().addToCollection(biteBook);
  assert.ok(render().savingIds.includes(biteBook.id));
  assert.equal(await render().addToCollection(biteBook), 'Working…');
  await flush();
  assert.equal(server.calls.length, 1);
  server.fail(); hold.resolve();
  assert.equal(await saving, 'Save failed');
  assert.equal(render().library.length, 0);
  assert.equal(render().savingIds.length, 0);
});

test('an older library response cannot undo a completed save or remove', async () => {
  const server = backend(), render = mount(server.api);
  const first = server.holdRead();
  const loading = render().loadCollection();
  await flush();
  await render().addToCollection(biteBook);
  first.resolve(); await loading;
  assert.equal(render().library.length, 2);
  const second = server.holdRead();
  const refresh = render().loadCollection(true);
  await flush();
  await render().removeFromCollection(biteBook);
  second.resolve(); await refresh;
  assert.equal(render().library.length, 1);
  assert.equal(render().library[0].id, rawBook._id);
});

test('logout/reset prevents an in-flight save from repopulating another session', async () => {
  const server = backend(), render = mount(server.api), hold = server.holdWrite();
  const pending = render().addToCollection(biteBook);
  await flush(); render().reset(); hold.resolve(); await pending;
  assert.equal(render().library.length, 0);
  assert.equal(render().savingIds.length, 0);
});

test('Happy Bite card bookmark stops playback taps and reflects saved/busy state', async () => {
  let toggled = 0, stopped = 0;
  const books = { library: [], savingIds: [], toggleCollection: async book => { assert.equal(book.happyBiteId, biteId); toggled++; return null; } };
  const { HappyBiteCard } = compile('src/components/happy-bite-card.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator' },
    'expo-image': { Image: 'Image' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/providers/app-language': { useAppLanguage: () => ({ t: text => text }) },
    '@/providers/motion': { useAppMotion: () => ({ animationsEnabled: true }) },
    '@/providers/auth': { useAuth: () => ({ user: null }) },
    '@/providers/player': { usePlayer: () => ({ loadingHappyBiteId: null }) },
    '@/providers/books': { useBooks: () => books },
    '@/providers/toast': { useToast: () => ({ showToast() {} }) },
    '@/lib/happy-bite-access': access, '@/lib/format': { clockTime: () => '0:55' },
  });
  const render = () => nodes(HappyBiteCard({ bite, onPress() { throw new Error('Bookmark must not play'); } }));
  const bookmark = render().find(node => node.props?.accessibilityLabel === 'Save {{title}} to library');
  bookmark.props.onPress({ stopPropagation() { stopped++; } }); await flush();
  assert.equal(stopped, 1); assert.equal(toggled, 1);
  books.library = [biteBook]; books.savingIds = [biteBook.id];
  const saved = render().find(node => node.props?.accessibilityLabel === 'Remove {{title}} from library');
  assert.equal(saved.props.disabled, true);
  assert.equal(saved.props.accessibilityState.selected, true);
});

test('library opens saved Happy Bites through the access-checking player and books through book details', async () => {
  const played = [], routes = [];
  const { default: Library } = compile('src/app/(tabs)/library.tsx', {
    react: { useEffect() {}, useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', useWindowDimensions: () => ({ width: 400 }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-router': { router: { push: route => routes.push(route) } },
    '@/providers/app-language': { useAppLanguage: () => ({ t: text => text }) },
    '@/providers/books': { useBooks: () => ({ library: [biteBook], savingIds: [], collectionLoaded: true }) },
    '@/providers/player': { usePlayer: () => ({ playBook: async book => played.push(book) }) },
    '@/providers/toast': { useToast: () => ({ showToast() {} }) },
    '@/components/ui/book-visuals': { BookCard: 'BookCard' }, '@/components/ui/skeleton': {},
    '@/components/ui/book-pull-surface': { BookPullSurface: 'BookPullSurface' },
    '@/hooks/use-elastic-refresh': { useElasticRefresh: () => ({ scrollProps: {} }) },
    '@/components/ui/pull-scrollables': { PullFlatList: 'PullFlatList' },
    '@/lib/happy-bite-access': access, '@/lib/api': { apiErrorMessage: error => error.message },
  });
  const list = nodes(Library()).find(node => node.type === 'PullFlatList');
  list.props.renderItem({ item: biteBook }).props.onPress(); await flush();
  assert.equal(played[0].happyBiteId, biteId);
  assert.equal(routes[0], '/player');
  list.props.renderItem({ item: { id: rawBook._id } }).props.onPress();
  assert.equal(routes[1].pathname, '/book/[id]');
  assert.equal(routes[1].params.id, rawBook._id);
});
