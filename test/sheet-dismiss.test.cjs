const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const source = readFileSync(join(__dirname, '../src/hooks/use-sheet-dismiss.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function mount(enabled = true, canClose = true) {
  const slots = [], effects = [], animations = [], scheduled = [], failed = [], springs = [];
  let cursor = 0, closed = 0, keyboard = 0, stopped = 0;
  const api = {};
  const changed = (old, deps) => !deps || !old || deps.some((dep, index) => dep !== old.deps?.[index]);
  runInNewContext(code, { exports: api, require(name) {
    if (name === 'react') return {
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
      useCallback(fn, deps) { const i = cursor++; if (changed(slots[i], deps)) slots[i] = { deps, fn }; return slots[i].fn; },
      useEffect(fn, deps) {
        const i = cursor++, previous = slots[i];
        if (changed(previous, deps)) effects.push(() => {
          previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
        });
      },
    };
    if (name === 'react-native') return { Keyboard: { dismiss() { keyboard++; } } };
    if (name === 'react-native-gesture-handler') return {
      usePanGesture: config => ({ config }),
      GestureStateManager: { fail: tag => failed.push(tag) },
    };
    if (name === 'react-native-worklets') return { scheduleOnRN: (fn, ...args) => scheduled.push(() => fn(...args)) };
    if (name === 'react-native-reanimated') return {
      ReduceMotion: { System: 'system' },
      cancelAnimation() { stopped++; },
      useSharedValue(initial) {
        const i = cursor++;
        if (!slots[i]) {
          let current = initial;
          slots[i] = { get: () => current, set(value) {
            if (value?.animation) { animations.push(value); current = value.target; }
            else current = value;
          } };
        }
        return slots[i];
      },
      withTiming: (target, config, callback) => ({ animation: true, target, config, callback }),
      withSpring: target => { springs.push(target); return target; },
      useAnimatedStyle: fn => fn,
    };
    if (name === '@/providers/motion') return { useAppMotion: () => ({ animationsEnabled: enabled }) };
    throw new Error(name);
  } });
  const render = (visible = true) => {
    cursor = 0; const hook = api.useSheetDismiss(visible, canClose ? () => { closed++; } : undefined, 600);
    while (effects.length) effects.shift()(); return hook;
  };
  const hook = render();
  return { hook, render, animations, scheduled, failed, springs, flush: () => { while (scheduled.length) scheduled.shift()(); }, closed: () => closed, keyboard: () => keyboard, stopped: () => stopped, unmount: () => slots.forEach(slot => slot?.cleanup?.()) };
}
const event = (translationY, extra = {}) => ({ translationY, translationX: 0, velocityY: 0, numberOfPointers: 1, handlerTag: 7, canceled: false, ...extra });
const scroll = y => ({ nativeEvent: { contentOffset: { y } } });
function release(config, distance, extra) { config.onDeactivate(event(distance, extra)); config.onFinalize(); }

test('native gestures recognize downward single-finger movement and share the list scroll', () => {
  const { hook } = mount();
  for (const gesture of [hook.gesture, hook.contentGesture]) {
    assert.equal(gesture.config.activeOffsetY, 6);
    assert.equal(gesture.config.failOffsetY, -6);
    assert.deepEqual(Array.from(gesture.config.failOffsetX), [-20, 20]);
    assert.equal(gesture.config.maxPointers, 1);
    assert.equal(gesture.config.enabled, true);
  }
  assert.equal(hook.scrollProps.simultaneousWith, hook.contentGesture);
  assert.equal(hook.scrollProps.disallowInterruption, false);
  assert.equal(hook.scrollProps.bounces, false);
});

test('list drags only dismiss from the top; the header works at every scroll position', () => {
  const app = mount(), list = app.hook.contentGesture.config, header = app.hook.gesture.config;
  app.hook.scrollProps.onScroll(scroll(100));
  list.onBegin(event(0));
  assert.equal(app.failed.length, 1);
  header.onBegin(event(0));
  assert.equal(app.failed.length, 1);
  app.hook.scrollProps.onScroll(scroll(0));
  list.onBegin(event(0));
  assert.equal(app.failed.length, 1);
  list.onActivate(event(8));
  list.onUpdate(event(45));
  assert.equal(app.hook.style().transform[0].translateY, 45);
  assert.equal(app.closed(), 0);
  release(list, 45);
  assert.equal(app.hook.style().transform[0].translateY, 0);
  assert.equal(app.springs.at(-1), 0);
});

test('long drag follows the finger and locks until the close animation finishes', () => {
  const app = mount(), pan = app.hook.gesture.config;
  pan.onActivate(event(8));
  pan.onUpdate(event(100));
  assert.equal(app.hook.style().transform[0].translateY, 100);
  release(pan, 100);
  pan.onBegin(event(0));
  assert.equal(app.failed.length, 1);
  assert.equal(app.closed(), 0);
  app.flush();
  const close = app.animations.at(-1);
  assert.equal(close.target, 600);
  assert.equal(app.closed(), 0);
  close.callback(true);
  app.flush();
  assert.equal(app.closed(), 1);
  app.hook.dismiss();
  assert.equal(app.closed(), 1);
});

test('cancelled drags and additional fingers restore the sheet without closing', () => {
  const app = mount(), pan = app.hook.contentGesture.config;
  pan.onActivate(event(8));
  pan.onUpdate(event(100));
  release(pan, 100, { canceled: true });
  app.flush();
  assert.equal(app.closed(), 0);
  assert.equal(app.hook.style().transform[0].translateY, 0);
  pan.onUpdate(event(40, { numberOfPointers: 2 }));
  assert.equal(app.failed.length, 1);
  pan.onFinalize();
  assert.equal(app.closed(), 0);
});

test('fast swipes and close buttons work with animations disabled, including after reopening', () => {
  const app = mount(false);
  release(app.hook.gesture.config, 25, { velocityY: 900 });
  app.flush();
  assert.equal(app.closed(), 1);
  assert.equal(app.animations.length, 0);
  app.render(false);
  const reopened = app.render(true);
  assert.equal(reopened.style().transform[0].translateY, 0);
  reopened.dismiss();
  reopened.dismiss();
  assert.equal(app.closed(), 2);
});

test('old close callbacks cannot dismiss a reopened or unmounted sheet', () => {
  const app = mount();
  app.hook.dismiss();
  const old = app.animations.at(-1);
  app.render(false); app.render(true);
  old.callback(true); app.flush();
  assert.equal(app.closed(), 0);
  app.hook.dismiss();
  const close = app.animations.at(-1);
  close.callback(false); app.flush();
  assert.equal(app.closed(), 0);
  app.unmount();
  close.callback(true); app.flush();
  assert.equal(app.closed(), 0);
  assert.ok(app.stopped() > 0);
});

test('non-dismissible sheets do not enable either gesture', () => {
  const app = mount(true, false);
  assert.equal(app.hook.gesture.config.enabled, false);
  assert.equal(app.hook.contentGesture.config.enabled, false);
  app.hook.dismiss();
  assert.equal(app.closed(), 0);
  assert.equal(app.animations.length, 0);
});
