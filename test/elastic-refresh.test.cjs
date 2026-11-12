const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const source = readFileSync(join(__dirname, '../src/hooks/use-elastic-refresh.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function mount({ enabled = true, refreshing = false, onRefresh = async () => {} } = {}) {
  const helpers = {};
  const springs = [];
  const cleanups = [];
  const values = [];
  const scheduled = [];
  const failed = [];
  const sequences = [];
  let requests = 0;
  let gesture;
  runInNewContext(code, {
    exports: helpers,
    require(name) {
      if (name === 'react') return {
        useCallback: (callback) => callback,
        useRef: (current) => ({ current }),
        useEffect: (effect) => cleanups.push(effect()),
      };
      if (name === 'react-native-gesture-handler') return {
        usePanGesture: (config) => { gesture = { config }; return gesture; },
        GestureStateManager: { fail: (tag) => failed.push(tag) },
      };
      if (name === 'react-native-worklets') return { scheduleOnRN: (callback) => scheduled.push(callback) };
      if (name === '@/providers/motion') return { useAppMotion: () => ({ animationsEnabled: enabled }) };
      if (name === 'react-native-reanimated') return {
        ReduceMotion: { System: 'system' },
        cancelAnimation() {},
        useSharedValue: (initial) => {
          let current = initial;
          const shared = { get: () => current, set: (value) => {
            if (value?.sequence) {
              sequences.push({ steps: value.sequence, shared });
            } else current = value;
          } };
          values.push(shared);
          return shared;
        },
        withSpring: (target) => { springs.push(target); return target; },
        withTiming: (target, config, callback) => ({ target, config, callback }),
        withSequence: (_reduceMotion, ...sequence) => ({ sequence }),
        useAnimatedStyle: (callback) => callback,
      };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const hook = helpers.useElasticRefresh(refreshing, () => { requests++; return onRefresh(); });
  return {
    ...hook, callbacks: gesture.config, offset: () => values[0].get(), requests: () => requests,
    scheduled, failed, springs, sequences,
    finishShake: () => {
      const sequence = sequences.at(-1);
      sequence.shared.set(0);
      sequence.steps.at(-1).callback(true);
    },
    unmount: () => cleanups.forEach((cleanup) => { if (cleanup) cleanup(); }),
  };
}
const event = (translationY, extra = {}) => ({ translationY, translationX: 0, numberOfPointers: 1, handlerTag: 7, canceled: false, ...extra });
const scroll = (y) => ({ nativeEvent: { contentOffset: { y } } });
function begin(app) {
  app.callbacks.onBegin(event(0));
  assert.equal(app.failed.length, 0);
  app.callbacks.onActivate(event(8));
}
function release(app, distance, canceled = false) {
  app.callbacks.onDeactivate(event(distance, { canceled }));
  app.callbacks.onFinalize(event(distance, { canceled }));
}

test('native scroll and native pan share a simultaneous relationship', () => {
  const app = mount();
  assert.equal(app.scrollProps.simultaneousWith, app.gesture);
  assert.equal(app.scrollProps.disallowInterruption, false);
  assert.equal(app.callbacks.activeOffsetY, 6);
  assert.equal(app.callbacks.failOffsetY, -6);
  assert.equal(app.callbacks.maxPointers, 1);
  assert.equal(app.callbacks.failOffsetX[0], -16);
  assert.equal(app.callbacks.failOffsetX[1], 16);
});

test('hand follows native updates before release without scheduling JS or springs', () => {
  const app = mount();
  begin(app);
  const before = app.springs.length;
  app.callbacks.onUpdate(event(30));
  const first = app.offset();
  app.callbacks.onUpdate(event(70));
  assert.ok(app.offset() > first && app.offset() < 72);
  assert.equal(app.handStyle().opacity, 1);
  assert.equal(app.scheduled.length, 0);
  assert.equal(app.springs.length, before);
  release(app, 70);
  assert.equal(app.offset(), 0);
});

test('release locks on the UI thread before JS receives the refresh request', async () => {
  const app = mount();
  begin(app);
  app.callbacks.onUpdate(event(140));
  release(app, 140);
  assert.equal(app.scheduled.length, 1);
  assert.equal(app.requests(), 0);
  assert.equal(app.offset(), 56);
  app.callbacks.onBegin(event(0));
  assert.equal(app.failed.length, 1);
  await app.scheduled.shift()();
  assert.equal(app.requests(), 1);
  assert.equal(app.offset(), 56);
  app.finishShake();
  assert.equal(app.offset(), 0);
});

test('pulls starting below the top or during refresh fail before activation', () => {
  const app = mount();
  app.scrollProps.onScroll(scroll(100));
  app.callbacks.onBegin(event(0));
  assert.equal(app.failed.length, 1);
  const busy = mount({ refreshing: true });
  busy.callbacks.onBegin(event(0));
  assert.equal(busy.failed.length, 1);
});

test('cancellation, multi-touch and reversed pulls never request refresh', () => {
  const app = mount();
  begin(app);
  app.callbacks.onUpdate(event(140));
  release(app, 140, true);
  assert.equal(app.scheduled.length, 0);
  begin(app);
  app.callbacks.onUpdate(event(140, { numberOfPointers: 2 }));
  release(app, 140, true);
  assert.equal(app.scheduled.length, 0);
  assert.equal(app.offset(), 0);
  const reversed = mount();
  begin(reversed);
  reversed.callbacks.onUpdate(event(140));
  reversed.callbacks.onUpdate(event(20));
  release(reversed, 20);
  assert.equal(reversed.scheduled.length, 0);
});

test('refresh works with animations off and failure releases the pending state', async () => {
  const app = mount({ enabled: false, onRefresh: async () => { throw new Error('offline'); } });
  begin(app);
  app.callbacks.onUpdate(event(140));
  release(app, 140);
  await app.scheduled.shift()();
  assert.equal(app.requests(), 1);
  assert.equal(app.offset(), 0);
  assert.equal(app.springs.length, 0);
  assert.equal(app.sequences.length, 0);
  begin(app);
});

test('unmount prevents late request completion from updating animation values', async () => {
  let finish;
  const app = mount({ onRefresh: () => new Promise((resolve) => { finish = resolve; }) });
  begin(app);
  release(app, 140);
  const request = app.scheduled.shift()();
  app.unmount();
  const count = app.springs.length;
  finish();
  await request;
  assert.equal(app.springs.length, count);
});

test('completion shakes the hand and page together before releasing the page', async () => {
  const app = mount();
  begin(app);
  release(app, 140);
  assert.equal(app.sequences.length, 0);
  await app.scheduled.shift()();
  assert.equal(app.sequences.length, 1);
  const shake = app.sequences[0];
  for (const step of shake.steps) {
    shake.shared.set(step.target);
    const pageX = app.animatedStyle().transform.find((value) => 'translateX' in value).translateX;
    assert.equal(pageX, app.handStyle().transform[0].translateX);
    assert.equal(app.offset(), 56);
  }
  assert.ok(shake.steps.reduce((duration, step) => duration + step.config.duration, 0) < 400);
  app.finishShake();
  assert.equal(app.offset(), 0);
  begin(app);
});

test('failed refresh skips the completion shake', async () => {
  const app = mount({ onRefresh: async () => { throw new Error('offline'); } });
  begin(app);
  release(app, 140);
  await app.scheduled.shift()();
  assert.equal(app.sequences.length, 0);
  assert.equal(app.offset(), 0);
});
