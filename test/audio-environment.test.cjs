const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function compile(file, imports) {
  const source = readFileSync(join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }});
  return exports;
}
function environment(platform, expoGo) {
  return compile('src/lib/app-environment.ts', {
    expo: { isRunningInExpoGo: () => expoGo },
    'react-native': { Platform: { OS: platform } },
  });
}
const episode = { title: 'A small thought', audioUrl: 'https://example.test/bite.mp3', order: 0 };
const biteBook = { id: 'happy-bite-1', happyBiteId: '1', title: 'Happy Bite', audioUrl: episode.audioUrl, episodes: [episode], coverImageUrl: '' };
function mount(platform, expoGo, { locked = false } = {}) {
  const calls = { play: 0, pause: 0, lock: 0, clear: 0, fetch: 0, replace: [], modes: [] };
  const status = { playing: false };
  let value;
  const player = {
    replace: source => calls.replace.push(source),
    play: () => { calls.play++; }, pause: () => { calls.pause++; },
    seekTo: async () => {},
    setActiveForLockScreen: () => { calls.lock++; },
    clearLockScreenControls: () => { calls.clear++; },
  };
  class HappyBiteAccessError extends Error {}
  const jsx = (type, props) => { if (type === 'Provider') value = props.value; };
  const provider = compile('src/providers/player.tsx', {
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useState: initial => [initial, () => {}],
      useRef: current => ({ current }),
      useCallback: callback => callback,
      useMemo: callback => callback(),
      useEffect: effect => effect(),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-audio': {
      useAudioPlayer: () => player,
      useAudioPlayerStatus: () => status,
      setAudioModeAsync: async mode => { calls.modes.push(mode); },
    },
    'expo-router': { router: { push() {} } },
    '@/components/ui/confirmation-modal': { ConfirmationModal() {} },
    '@/lib/happy-bites': {
      fetchHappyBite: async () => { calls.fetch++; return { locked, title: biteBook.title, audioUrl: biteBook.audioUrl }; },
      happyBiteAsBook: () => biteBook, HappyBiteAccessError,
    },
    '@/lib/api': { apiErrorMessage: error => error.message },
    '@/lib/app-environment': environment(platform, expoGo),
    '@/providers/auth': { useAuth: () => ({ user: null }) },
    '@/providers/toast': { useToast: () => ({ showToast() {} }) },
  });
  provider.PlayerProvider({ children: null });
  return { actions: value, calls };
}
test('Expo Go plays Happy Bites in-app without attempting the native playback service', async () => {
  for (const platform of ['android', 'ios']) {
    const app = mount(platform, true);
    assert.equal(app.calls.modes[0].shouldPlayInBackground, false);
    await app.actions.playEpisode(biteBook, episode);
    assert.equal(app.calls.fetch, 1);
    assert.equal(app.calls.play, 1);
    assert.equal(app.calls.lock, 0);
    app.actions.togglePlayback();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.calls.fetch, 2); // Resume still rechecks access.
    assert.equal(app.calls.play, 2);
    assert.equal(app.calls.lock, 0);
    await app.actions.stop();
    assert.equal(app.calls.clear, 0);
    assert.equal(app.calls.pause, 1);
  }
});
test('installed builds retain background playback and lock-screen controls', async () => {
  for (const platform of ['android', 'ios']) {
    const app = mount(platform, false);
    assert.equal(app.calls.modes[0].shouldPlayInBackground, true);
    await app.actions.playEpisode(biteBook, episode);
    assert.equal(app.calls.play, 1);
    assert.equal(app.calls.lock, 1);
    await app.actions.stop();
    assert.equal(app.calls.clear, 1);
  }
});
test('web keeps browser media controls without requesting native background mode', async () => {
  const app = mount('web', false);
  assert.equal(app.calls.modes[0].shouldPlayInBackground, false);
  await app.actions.playEpisode(biteBook, episode);
  assert.equal(app.calls.play, 1);
  assert.equal(app.calls.lock, 1);
});
test('the environment guard never bypasses Happy Bite access checks', async () => {
  for (const expoGo of [true, false]) {
    const app = mount('android', expoGo, { locked: true });
    await assert.rejects(app.actions.playEpisode(biteBook, episode));
    assert.equal(app.calls.play, 0);
    assert.equal(app.calls.lock, 0);
    assert.equal(app.calls.replace.length, 0);
  }
});
test('audiobooks retain ordinary playback in Expo Go and installed builds', async () => {
  for (const expoGo of [true, false]) {
    const app = mount('android', expoGo);
    await app.actions.playBook({ ...biteBook, happyBiteId: undefined });
    assert.equal(app.calls.fetch, 0);
    assert.equal(app.calls.play, 1);
    assert.equal(app.calls.lock, expoGo ? 0 : 1);
  }
});
