const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/hooks/use-keyboard-form.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function mount(platform = 'android', screenY = 0) {
  let visible = false, frameId = 0;
  const frames = new Map(), scrolls = [], cleanups = [], api = {};
  runInNewContext(code, {
    exports: api,
    requestAnimationFrame: callback => { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    require(name) {
      if (name === 'react') return { useRef: current => ({ current }), useCallback: fn => fn, useEffect: fn => cleanups.push(fn()) };
      if (name === 'react-native') return { Keyboard: { isVisible: () => visible }, Platform: { OS: platform } };
      throw new Error(name);
    },
  });
  const hook = api.useKeyboardForm();
  hook.ref.current = { measureInWindow: callback => callback(0, screenY, 400, 500), scrollResponderScrollNativeHandleToKeyboard: (...args) => scrolls.push(args) };
  return { hook, scrolls, frames, show: () => { visible = true; hook.onKeyboardDidShow(); }, hide: () => { visible = false; hook.onKeyboardDidHide(); }, flush: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); }, unmount: () => cleanups.forEach(fn => fn?.()) };
}
const focus = (target = 42) => ({ target, nativeEvent: { target: typeof target === 'number' ? target : 42 } });

test('initial autofocus waits for the keyboard and then reveals the input with space above it', () => {
  const app = mount();
  app.hook.onFocus(focus()); app.flush();
  assert.equal(app.scrolls.length, 0);
  app.show(); app.flush();
  assert.deepEqual(app.scrolls, [[42, 24, true]]);
});
test('switching fields with the keyboard open reveals the latest focused native instance', () => {
  const app = mount('ios'), input = { measureLayout() {} };
  app.show();
  app.hook.onFocus(focus(1));
  app.hook.onFocus(focus(input)); app.flush();
  assert.equal(app.scrolls.length, 1);
  assert.equal(app.scrolls[0][0], input);
});
test('form headers and dialog position are included in the keyboard clearance', () => {
  const app = mount('android', 160);
  app.hook.onFocus(focus()); app.show(); app.flush();
  assert.deepEqual(app.scrolls, [[42, 184, true]]);
});
test('keyboard resize and content changes recheck focus after layout, without stacking callbacks', () => {
  const app = mount(); app.show(); app.hook.onFocus(focus()); app.flush();
  app.hook.onLayout(); app.hook.onContentSizeChange();
  assert.equal(app.frames.size, 1);
  app.flush();
  assert.equal(app.scrolls.length, 2);
});
test('blur, keyboard dismissal and unmount cancel queued scrolling', () => {
  for (const cancel of [app => app.hook.onBlur(), app => app.hide(), app => app.unmount()]) {
    const app = mount(); app.show(); app.hook.onFocus(focus()); cancel(app); app.flush();
    assert.equal(app.scrolls.length, 0);
  }
});
test('unfocused forms do not scroll in response to another screen keyboard', () => {
  const app = mount(); app.show(); app.hook.onLayout(); app.flush();
  assert.equal(app.scrolls.length, 0);
});
test('web retains browser focus scrolling and does not call native measurement APIs', () => {
  const app = mount('web'); app.hook.onFocus(focus()); app.show(); app.flush();
  assert.equal(app.scrolls.length, 0);
  assert.equal(app.frames.size, 0);
});
