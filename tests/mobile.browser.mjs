import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const url = pathToFileURL(resolve('public/mario.html')).href;
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
]) {
  test(
    `phone ${viewport.width}×${viewport.height}: menus, touch targets, cancellation and fullscreen fallback`,
    { timeout: 45_000 },
    async () => {
      const browser = await chromium.launch({
        headless: true,
        channel: 'chromium',
        args: process.platform === 'darwin' ? ['--use-angle=metal'] : [],
      });
      try {
        const context = await browser.newContext({
          viewport,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 1,
        });
        await context.addInitScript(() => {
          window.fullscreenAttempts = 0;
          Element.prototype.requestFullscreen = function () {
            window.fullscreenAttempts++;
            return Promise.reject(
              new DOMException('Denied for fallback test', 'NotAllowedError'),
            );
          };
          window.gameActions = new Map();
          Object.defineProperty(document, 'modelContext', {
            value: {
              registerTool(tool) {
                window.gameActions.set(tool.name, tool);
              },
            },
            configurable: true,
          });
        });
        const page = await context.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(url);
        await expect(
          page.getByRole('button', { name: 'Let’s play' }),
        ).toBeEnabled();
        const fits = async (locator, label) => {
          const b = await locator.boundingBox();
          assert(
            b &&
              b.x >= -1 &&
              b.y >= -1 &&
              b.x + b.width <= viewport.width + 1 &&
              b.y + b.height <= viewport.height + 1,
            `${label} outside viewport: ${JSON.stringify(b)}`,
          );
        };
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await fits(page.locator('.game-shell'), 'game');
        await fits(page.locator('.toolbar'), 'toolbar');
        await fits(page.locator('.home-scroll'), 'scrollable start menu');
        for (const name of ['Website', 'GitHub', 'LinkedIn']) {
          const link = page
            .locator('.intro [data-creator-links]')
            .getByRole('link', { name, exact: true });
          await link.scrollIntoViewIfNeeded();
          await fits(link, `start ${name}`);
        }
        await page.getByRole('button', { name: 'Let’s play' }).tap();
        await expect(page.locator('.touch-controls'))
          .toBeVisible()
          .catch(async (error) => {
            console.error(
              await page.evaluate(() => {
                const e = document.querySelector('.touch-controls');
                const s = e && getComputedStyle(e);
                return {
                  classes: document.querySelector('main').className,
                  touch: navigator.maxTouchPoints,
                  coarse: matchMedia('(pointer:coarse)').matches,
                  display: s?.display,
                  visibility: s?.visibility,
                  rect: e?.getBoundingClientRect().toJSON(),
                };
              }),
            );
            throw error;
          });
        await expect(page.locator('[data-creator-links]')).toHaveCount(0);
        await fits(page.locator('.hud'), 'HUD');
        await fits(page.locator('.touch-pad'), 'joystick');
        await fits(page.locator('.touch-jump'), 'jump');
        assert.equal(await page.evaluate(() => window.fullscreenAttempts), 1);
        const status = () =>
          page.evaluate(() =>
            window.gameActions.get('get_game_status').execute({}),
          );
        const pad = await page.locator('.touch-pad').boundingBox();
        const client = await context.newCDPSession(page);
        const before = (await status()).progress;
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: pad.x + pad.width / 2, y: pad.y + 16, id: 1 }],
        });
        await page.waitForTimeout(250);
        assert(
          (await status()).progress > before,
          'Holding the joystick should move forward.',
        );
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchCancel',
          touchPoints: [],
        });
        await page.waitForTimeout(350);
        const stopped = (await status()).progress;
        await page.waitForTimeout(250);
        assert(
          Math.abs((await status()).progress - stopped) < 0.0002,
          'Cancelled touch must not leave the joystick moving.',
        );
        await page.getByRole('button', { name: 'Pause game' }).tap();
        await expect(
          page.getByRole('heading', { name: 'Take a breather.' }),
        ).toBeVisible();
        for (const name of ['Website', 'GitHub', 'LinkedIn']) {
          const link = page
            .locator('.state-card [data-creator-links]')
            .getByRole('link', { name, exact: true });
          await link.scrollIntoViewIfNeeded();
          await fits(link, `pause ${name}`);
        }
        await page.getByRole('button', { name: 'Keep playing' }).tap();
        await expect(page.locator('.touch-controls'))
          .toBeVisible()
          .catch(async (error) => {
            console.error(
              await page.evaluate(() => {
                const e = document.querySelector('.touch-controls');
                const s = e && getComputedStyle(e);
                return {
                  classes: document.querySelector('main').className,
                  touch: navigator.maxTouchPoints,
                  coarse: matchMedia('(pointer:coarse)').matches,
                  display: s?.display,
                  visibility: s?.visibility,
                  rect: e?.getBoundingClientRect().toJSON(),
                };
              }),
            );
            throw error;
          });
        assert.equal(
          await page.evaluate(() => window.fullscreenAttempts),
          1,
          'Resume must not repeat a denied fullscreen request.',
        );
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    },
  );
}
