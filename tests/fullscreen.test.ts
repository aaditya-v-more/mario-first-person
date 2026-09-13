import test from 'node:test';
import assert from 'node:assert/strict';
import { FullscreenSession, type FullscreenState } from '../app/game/fullscreen';

function fixture(legacy = false) {
  const document = Object.assign(new EventTarget(), {
    fullscreenElement: null as unknown,
    webkitFullscreenElement: null as unknown,
    fullscreenEnabled: !legacy,
    webkitFullscreenEnabled: legacy,
  });
  let requests = 0, exits = 0;
  const states: FullscreenState[] = [];
  const element: Record<string, unknown> = {};
  const event = legacy ? 'webkitfullscreenchange' : 'fullscreenchange';
  const key = legacy ? 'webkitFullscreenElement' : 'fullscreenElement';
  const enter = () => {
    requests++;
    document[key] = element;
    document.dispatchEvent(new Event(event));
  };
  element[legacy ? 'webkitRequestFullscreen' : 'requestFullscreen'] = legacy ? enter : async () => enter();
  Object.assign(document, {
    [legacy ? 'webkitExitFullscreen' : 'exitFullscreen']: () => {
      document[key] = null;
      document.dispatchEvent(new Event(event));
    },
  });
  const session = new FullscreenSession(document as unknown as Document, element as unknown as HTMLElement, state => states.push(state), () => exits++);
  return { document, element, session, states, requests: () => requests, exits: () => exits, event, key };
}

void test('gesture enters synchronously; a native exit pauses and opts out until manual entry', async () => {
  const f = fixture();
  const entering = f.session.enter(true);
  assert.equal(f.requests(), 1, 'Do not defer the request beyond the user gesture.');
  await entering;
  assert.equal(f.states.at(-1)?.active, true);
  f.document.fullscreenElement = null;
  f.document.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(f.exits(), 1);
  await f.session.enter(true);
  assert.equal(f.requests(), 1, 'Resume must respect the player leaving fullscreen.');
  await f.session.toggle();
  assert.equal(f.requests(), 2);
  await f.session.toggle();
  assert.equal(f.states.at(-1)?.active, false);
  await f.session.enter(true);
  assert.equal(f.requests(), 2);
  f.session.destroy();
});

void test('denied fullscreen keeps the page usable and does not repeat automatic requests', async () => {
  const f = fixture();
  let attempts = 0;
  f.element.requestFullscreen = () => { attempts++; return Promise.reject(new Error('Denied')); };
  await f.session.enter(true);
  assert.match(f.states.at(-1)?.message ?? '', /keep playing in this tab/);
  assert.equal(f.states.at(-1)?.active, false);
  await f.session.enter(true);
  assert.equal(attempts, 1);
  await f.session.toggle();
  assert.equal(attempts, 2, 'An explicit fullscreen button can retry.');
  f.session.destroy();
});

void test('missing API and synchronous errors produce a safe in-tab fallback', async () => {
  const f = fixture();
  delete f.element.requestFullscreen;
  await f.session.enter(true);
  assert.equal(f.states.at(-1)?.supported, false);
  assert.match(f.states.at(-1)?.message ?? '', /play in this tab/);
  f.element.requestFullscreen = () => { throw new Error('Unavailable'); };
  await f.session.toggle();
  assert.match(f.states.at(-1)?.message ?? '', /keep playing in this tab/);
  f.session.destroy();
});

void test('legacy WebKit void-returning methods preserve enter/exit behavior', async () => {
  const f = fixture(true);
  assert.equal(f.states.at(-1)?.supported, true);
  await f.session.enter(true);
  assert.equal(f.states.at(-1)?.active, true);
  await f.session.toggle();
  assert.equal(f.states.at(-1)?.active, false);
  assert.equal(f.exits(), 1);
  await f.session.enter(true);
  assert.equal(f.requests(), 1);
  f.session.destroy();
});

void test('unmount removes listeners and suppresses pending request updates', async () => {
  const f = fixture();
  let complete!: () => void;
  f.element.requestFullscreen = () => new Promise<void>(resolve => { complete = resolve; });
  const pending = f.session.enter(true);
  f.session.destroy();
  const count = f.states.length;
  f.document.fullscreenElement = f.element;
  f.document.dispatchEvent(new Event('fullscreenchange'));
  complete();
  await pending;
  assert.equal(f.states.length, count);
  assert.equal(f.exits(), 0);
});
