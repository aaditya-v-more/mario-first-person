import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit, expect } from '@playwright/test';

const url = pathToFileURL(resolve('public/mario.html')).href;
await mkdir('work/graphics', { recursive: true });

for (const [name, browserType] of Object.entries({ chromium, webkit })) {
  test(`${name}: classic/RTX rendering, progress, resize, cleanup and fallback`, { timeout: 120_000 }, async () => {
    const browser = await browserType.launch({
      headless: true,
      ...(name === 'chromium' ? { channel: 'chromium', args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] } : {}),
    });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        window.gameActions = new Map();
        Object.defineProperty(document, 'modelContext', { value: {
          registerTool(tool) { window.gameActions.set(tool.name, tool); },
        }, configurable: true });
        const textures = new Set(), proto = WebGL2RenderingContext.prototype;
        const create = proto.createTexture, remove = proto.deleteTexture;
        proto.createTexture = function () { const texture = create.call(this); if (texture) textures.add(texture); return texture; };
        proto.deleteTexture = function (texture) { textures.delete(texture); return remove.call(this, texture); };
        window.liveGraphicsTextures = () => textures.size;
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(url);
      const toggle = page.getByRole('switch', { name: 'RTX enhanced graphics' });
      await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled();
      await expect(toggle).not.toBeChecked();
      const gpu = await page.evaluate(() => {
        const gl = document.querySelector('canvas').getContext('webgl2');
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), floatTargets: !!gl.getExtension('EXT_color_buffer_float') };
      });
      console.log(`${name} GPU: ${JSON.stringify(gpu)}`);
      assert.ok(gpu.floatTargets, 'The graphics validation device must support HDR targets.');

      // Start via the real UI, move/collect, then compare a frozen course.
      await page.getByRole('button', { name: 'Let’s play' }).click();
      await page.keyboard.down('w');
      await page.waitForTimeout(900);
      await page.keyboard.up('w');
      await page.keyboard.press('p');
      await expect(page.getByRole('heading', { name: 'Take a breather.' })).toBeVisible();
      const status = () => page.evaluate(() => window.gameActions.get('get_game_status').execute({}));
      const before = await status();
      const canvas = page.locator('.world-canvas canvas');
      const screenshot = variant => canvas.screenshot({ path: `work/graphics/${name}-${variant}.png`, style: '.game-shell > :not(.world-canvas) { visibility: hidden !important; }' });
      const classic = await screenshot('classic');
      await toggle.click();
      await expect(toggle).toBeChecked({ timeout: 30_000 });
      const enhanced = await screenshot('rtx');
      assert.ok(!enhanced.equals(classic), 'RTX must visibly change the rendered scene.');
      assert.deepEqual(await status(), before, 'Enabling RTX must preserve the paused course.');
      assert.equal(await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getError()), 0);
      await toggle.click();
      await expect(toggle).not.toBeChecked();
      const restored = await screenshot('restored');
      assert.ok(restored.equals(classic), 'Disabling RTX must restore the exact original pixels.');
      assert.deepEqual(await status(), before);

      const liveTextures = await page.evaluate(() => window.liveGraphicsTextures());
      // Keyboard operation must also work without triggering a game jump.
      await toggle.focus();
      await page.keyboard.press('Space');
      await expect(toggle).toBeChecked();
      await page.keyboard.press('Space');
      await expect(toggle).not.toBeChecked();
      await status();
      assert.equal(await page.evaluate(() => window.liveGraphicsTextures()), liveTextures, 'Repeated toggles must release GPU textures.');

      await page.setViewportSize({ width: 320, height: 740 });
      const bounds = await toggle.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320, 'The toggle must fit narrow screens.');
      await toggle.click();
      await expect(toggle).toBeChecked();
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect.poll(() => canvas.evaluate(c => c.width * c.height)).toBeLessThanOrEqual(2_000_000);
      assert.equal(await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getError()), 0);
      await page.getByRole('button', { name: 'Keep playing' }).click();
      await page.keyboard.press('Space');
      await page.keyboard.press('p');
      assert.equal((await status()).status, 'paused');
      await page.getByRole('button', { name: 'Restart course' }).click();
      await page.keyboard.press('p');
      await expect(toggle).toBeChecked();
      assert.equal((await status()).lives, 3);
      await page.reload();
      await expect(toggle).not.toBeChecked();
      await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled();
      assert.deepEqual(errors, [], 'Rendering should not produce browser or shader errors.');

      // Exercise a browser without the optional capability.
      const fallback = await context.newPage();
      await fallback.addInitScript(() => {
        const original = WebGL2RenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getExtension = function (name) {
          return name === 'EXT_color_buffer_float' ? null : original.call(this, name);
        };
      });
      await fallback.goto(url);
      const fallbackToggle = fallback.getByRole('switch', { name: 'RTX enhanced graphics' });
      await expect(fallbackToggle).toBeEnabled();
      await fallbackToggle.click();
      await expect(fallback.getByRole('status')).toContainText('Classic graphics are still on.');
      await expect(fallbackToggle).not.toBeChecked();
      await expect(fallback.getByRole('button', { name: 'Let’s play' })).toBeEnabled();
      await fallback.getByRole('button', { name: 'Let’s play' }).click();
      await expect(fallback.locator('.hud')).toBeVisible();
    } finally { await browser.close(); }
  });
}
