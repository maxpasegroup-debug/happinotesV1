const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function compile(file, imports) {
  const code = ts.transpileModule(readFileSync(join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  } });
  return exports;
}
const jsx = (type, props) => ({ type, props });
function runtime() {
  let cursor = 0;
  const slots = [], effects = [];
  return {
    reset: () => { cursor = 0; },
    flush: () => { while (effects.length) effects.shift()(); },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
    hooks: {
      createContext: () => ({ Provider: 'Provider' }),
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], next => { slots[index] = next; }];
      },
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useMemo: fn => fn(), useCallback: fn => fn,
      useEffect(fn, deps) {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
          effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
        }
      },
    },
  };
}
function nodes(tree) {
  return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

test('notification refresh bypasses the loaded cache, deduplicates requests, and preserves items after failure', async () => {
  const state = runtime(), requests = [];
  const { NotificationsProvider } = compile('src/providers/notifications.tsx', {
    react: state.hooks, 'react/jsx-runtime': { jsx },
    '@/lib/api': {
      parseNotification: item => item, apiErrorMessage: error => error.message,
      request: (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })),
    },
  });
  const render = () => { state.reset(); return NotificationsProvider({ children: null }).props.value; };
  const initial = render().load();
  await render().load(true);
  assert.equal(requests.length, 1);
  requests[0].resolve({ notifications: [{ id: 'first' }] }); await initial;
  await render().load();
  assert.equal(requests.length, 1);
  const refresh = render().load(true);
  assert.equal(render().loading, true);
  assert.equal(requests[1].path, '/notifications');
  assert.equal(requests[1].options.cache, 'no-store');
  requests[1].resolve({ notifications: [{ id: 'new' }] }); await refresh;
  assert.equal(render().items[0].id, 'new');
  const failed = render().load(true);
  requests[2].reject(new Error('Offline')); await failed;
  assert.equal(render().items[0].id, 'new');
  assert.equal(render().error, 'Offline');
  assert.equal(render().loading, false);
});

test('bell follows the drag, rings while loading, and stops when motion is disabled or unmounted', () => {
  const state = runtime();
  let enabled = true, distance = 0, repeats = 0, cancels = 0;
  const { BellPullSurface } = compile('src/components/ui/bell-pull-surface.tsx', {
    react: state.hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
    '@/providers/motion': { useAppMotion: () => ({ animationsEnabled: enabled }) },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' }, ReduceMotion: { System: 'system' },
      useSharedValue(initial) { return state.hooks.useRef({ get: () => initial, set: value => { initial = value; } }).current; },
      useAnimatedStyle: callback => callback(), cancelAnimation: () => { cancels++; },
      withTiming: value => value, withSequence: () => 0, withRepeat: () => { repeats++; return 0; },
    },
  });
  const motion = { gesture: {}, pullDistance: { get: () => distance } };
  const render = refreshing => { state.reset(); const tree = BellPullSurface({ motion, refreshing, children: 'list' }); state.flush(); return nodes(tree).filter(node => node.type === 'AnimatedView'); };
  assert.equal(render(false)[0].props.style[1].opacity, 0);
  distance = 28;
  assert.equal(render(false)[0].props.style[1].opacity, 0.5);
  distance = 56;
  assert.equal(render(true)[0].props.style[1].opacity, 1);
  assert.equal(repeats, 1);
  enabled = false;
  const staticViews = render(true);
  assert.equal(repeats, 1);
  assert.equal(staticViews[0].props.style[1].transform[2].rotateZ, '0deg');
  assert.equal(staticViews[1].props.style[1].transform[0].translateY, 56);
  assert.equal(render(false)[1].props.style[1].transform[0].translateY, 0);
  const before = cancels;
  state.unmount();
  assert.ok(cancels > before);
});

test('notification screen exposes pull and button refresh, with errors visible over existing items', async () => {
  const state = runtime(), calls = [];
  let onPull;
  const feed = { items: [{ id: '1', title: 'A new book' }], loading: false, error: 'Offline', load: async force => { calls.push(force); } };
  const { default: Screen } = compile('src/app/notifications.tsx', {
    react: state.hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable',
      Animated: { View: 'AnimatedView', Value: class { setValue() {} } },
      PanResponder: { create: () => ({ panHandlers: {} }) }, useWindowDimensions: () => ({ height: 800 }),
    },
    'expo-image': { Image: 'Image' }, 'expo-router': { router: {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/providers/app-language': { useAppLanguage: () => ({ t: text => text }) },
    '@/providers/motion': { useAppMotion: () => ({ animationsEnabled: true }) },
    '@/providers/books': { useBooks: () => ({}) },
    '@/providers/notifications': { useNotifications: () => feed },
    '@/lib/app-environment': { USE_NATIVE_DRIVER: true }, '@/lib/format': {},
    '@/components/ui/bell-pull-surface': { BellPullSurface: 'BellPullSurface' },
    '@/components/ui/pull-scrollables': { PullScrollView: 'PullScrollView' },
    '@/hooks/use-elastic-refresh': { useElasticRefresh: (_loading, callback) => { onPull = callback; return { scrollProps: { testScroll: true } }; } },
    'react-native-reanimated': { View: 'AnimatedView' },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
    '@/hooks/use-sheet-dismiss': { useSheetDismiss: () => ({ dismiss() {}, style: {}, gesture: 'sheetGesture' }) },
  });
  const render = () => { state.reset(); const tree = Screen(); state.flush(); return nodes(tree); };
  let tree = render();
  assert.ok(tree.some(node => node.type === 'GestureDetector' && node.props.gesture === 'sheetGesture'));
  assert.deepEqual(calls, [true]);
  await onPull();
  tree.find(node => node.props?.accessibilityLabel === 'Refresh notifications').props.onPress();
  assert.deepEqual(calls, [true, true, true]);
  assert.ok(tree.some(node => node.props?.notification?.id === '1'));
  assert.ok(tree.some(node => node.props?.children === 'Offline'));
  assert.ok(tree.find(node => node.type === 'PullScrollView').props.testScroll);
  feed.loading = true;
  tree = render();
  assert.equal(tree.find(node => node.type === 'BellPullSurface').props.refreshing, true);
  assert.equal(tree.find(node => node.props?.accessibilityLabel === 'Refresh notifications').props.disabled, true);
});
