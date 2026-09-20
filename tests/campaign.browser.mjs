import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, webkit, expect } from '@playwright/test';
await mkdir('work/nes-campaign', { recursive: true });
await build({
  entryPoints: ['tests/browser-harness.ts'],
  bundle: true,
  format: 'iife',
  outfile: 'work/nes-campaign/harness.js',
});
await writeFile(
  'work/nes-campaign/harness.html',
  '<!doctype html><html><head><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="game"></div><script src="harness.js"></script></body></html>',
);
const launch = (type) =>
  type.launch({
    headless: true,
    ...(type === chromium
      ? {
          channel: 'chromium',
          args: process.platform === 'darwin' ? ['--use-angle=metal'] : [],
        }
      : {}),
  });
for (const [name, type] of Object.entries({ chromium, webkit })) {
  test(
    `${name}: all 32 courses and 63 rooms render and have safe entries`,
    { timeout: 180000 },
    async () => {
      const browser = await launch(type);
      try {
        const page = await browser.newPage({
            viewport: { width: 1120, height: 760 },
            reducedMotion: 'reduce',
          }),
          errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (e) => {
          if (e.type() === 'error') errors.push(e.text());
        });
        await page.addInitScript(() => {
          const buffers = new Set(),
            proto = WebGL2RenderingContext.prototype;
          const create = Reflect.get(proto, 'createBuffer'),
            remove = Reflect.get(proto, 'deleteBuffer');
          proto.createBuffer = function () {
            const buffer = Reflect.apply(create, this, []);
            if (buffer) buffers.add(buffer);
            return buffer;
          };
          proto.deleteBuffer = function (buffer) {
            buffers.delete(buffer);
            return Reflect.apply(remove, this, [buffer]);
          };
          window.liveBuffers = () => buffers.size;
        });
        await page.goto(
          pathToFileURL(resolve('work/nes-campaign/harness.html')).href,
        );
        await page.waitForFunction(() => !!window.testGame);
        let rooms = 0;
        const metrics = [];
        for (let index = 0; index < 32; index++) {
          const result = await page.evaluate((index) => {
            const g = window.testGame;
            g.save.unlocked = 31;
            g.selectLevel(index, false);
            const frames = [];
            for (const area of g.world.level.areas) {
              g.enterArea(area.id, area.spawn);
              g.invulnerable = 99;
              for (let f = 0; f < 24; f++) g.simulate(1 / 120);
              g.pause();
              g.loop(1000 + index * 1000 + area.id * 100);
              const p = g.player,
                height = p.height ?? 1.65;
              const embedded = g.world.boxes
                .filter(
                  (b) =>
                    b.active !== false &&
                    !b.hidden &&
                    Math.abs(p.x - b.x) < b.w / 2 + 0.33 &&
                    Math.abs(p.z - b.z) < b.d / 2 + 0.33 &&
                    p.y + height > b.y - b.h / 2 + 0.015 &&
                    p.y < b.y + b.h / 2 - 0.015,
                )
                .map((b) => b.kind);
              frames.push({
                area: area.id,
                lives: g.state.lives,
                y: p.y,
                embedded,
                error: g.renderer.getContext().getError(),
                calls: g.renderer.info.render.calls,
              });
              g.state.status = 'playing';
            }
            return { frames, level: g.state.level };
          }, index);
          assert.equal(result.level, index);
          rooms += result.frames.length;
          metrics.push(...result.frames);
          for (const room of result.frames) {
            assert.equal(room.error, 0, `World ${index} room ${room.area}`);
            assert.equal(
              room.lives,
              3,
              `World ${index} room ${room.area} spawn died`,
            );
            assert.deepEqual(
              room.embedded,
              [],
              `World ${index} room ${room.area} spawn is inside solid terrain`,
            );
          }
          if (index % 4 === 0 || [1, 5, 15, 27, 31].includes(index))
            await page.screenshot({
              path: `work/nes-campaign/${name}-${Math.floor(index / 4) + 1}-${(index % 4) + 1}.png`,
            });
        }
        assert.equal(rooms, 63);
        const ending = await page.evaluate(() => {
          const g = window.testGame;
          g.state.status = 'playing';
          g.dropBridge();
          g.enterArea(g.world.level.goalArea, g.world.level.goal);
          g.simulate(1 / 120);
          return {
            status: g.state.status,
            collapsed: g.world.bridges.every((b) => b.box.active === false),
          };
        });
        assert.deepEqual(ending, { status: 'won', collapsed: true });
        const cleanup = await page.evaluate(async () => {
          const g = window.testGame;
          g.selectLevel(0, false);
          g.pause();
          g.loop(40000);
          const before = {
            ...g.renderer.info.memory,
            buffers: window.liveBuffers(),
          };
          for (let i = 0; i < 4; i++) {
            g.restart(false);
            g.pause();
            g.loop(41000 + i * 1000);
          }
          const after = {
            ...g.renderer.info.memory,
            buffers: window.liveBuffers(),
          };
          const enabled = await g.setRtx(true);
          g.selectLevel(5, false);
          g.enterArea(1, g.world.level.areas[1].spawn);
          await new Promise((r) => setTimeout(r, 100));
          g.pause();
          g.loop(50000);
          const waterTheme = g.world.level.areas[g.area].underwater;
          await g.setRtx(false);
          const color = g.scene.background.getHexString();
          g.destroy();
          return { before, after, enabled, waterTheme, color };
        });
        assert.deepEqual(cleanup.before, cleanup.after);
        assert.equal(cleanup.enabled, true);
        assert.equal(cleanup.waterTheme, true);
        assert.equal(cleanup.color, '126ba0');
        assert.deepEqual(errors, []);
        console.log(
          `${name}: ${rooms} rooms, maximum ${Math.max(...metrics.map((m) => m.calls))} draw calls`,
        );
      } finally {
        await browser.close();
      }
    },
  );
}
test(
  'front screen lists 32 courses and unlocks one at a time, including after reload',
  { timeout: 90000 },
  async () => {
    const browser = await launch(chromium);
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      await context.addInitScript(() => {
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
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(pathToFileURL(resolve('public/mario.html')).href);
      await expect(
        page.getByRole('button', { name: 'Let’s play' }),
      ).toBeEnabled();
      const cards = page.locator('.home-scroll .level-card');
      assert.equal(await cards.count(), 32);
      assert.equal(
        await page.locator('.home-scroll .level-card:disabled').count(),
        31,
      );
      await expect(cards.first()).toBeEnabled();
      await cards.last().scrollIntoViewIfNeeded();
      await expect(cards.last()).toBeVisible();
      await expect(cards.last()).toBeDisabled();
      await page.screenshot({
        path: 'work/nes-campaign/atlas-world-eight.png',
      });
      await page.getByRole('button', { name: 'Let’s play' }).click();
      await page.keyboard.down('w');
      await page.waitForTimeout(600);
      await page.keyboard.up('w');
      await page.keyboard.press('p');
      await expect(
        page.getByRole('heading', { name: 'Take a breather.' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Open level map' }).click();
      assert.equal(await page.locator('.map-dialog .level-card').count(), 32);
      assert.equal(
        await page.locator('.map-dialog .level-card:disabled').count(),
        31,
      );
      await page.getByRole('button', { name: 'Close level map' }).click();
      await page.reload();
      assert.equal(
        await page.locator('.home-scroll .level-card:disabled').count(),
        31,
        'Playing without clearing must not unlock a course',
      );
      // A saved completion from the engine is the only record the UI reads.
      await page.evaluate(() =>
        localStorage.setItem(
          'mario-first-person.nes.v1',
          JSON.stringify({
            version: 3,
            unlocked: 1,
            records: [
              {
                cleared: true,
                stars: 0,
                score: 4200,
                bestTime: 83,
                coinMedal: false,
                speedMedal: false,
                cleanMedal: false,
              },
            ],
          }),
        ),
      );
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Continue adventure' }),
      ).toBeEnabled();
      assert.equal(
        await page.locator('.home-scroll .level-card:disabled').count(),
        30,
      );
      await expect(page.locator('.home-scroll [data-level="1"]')).toBeEnabled();
      await expect(
        page.locator('.home-scroll [data-level="2"]'),
      ).toBeDisabled();
      await page.locator('.home-scroll [data-level="0"]').click();
      await page.keyboard.press('p');
      const state = await page.evaluate(() =>
        window.gameActions.get('get_game_status').execute({}),
      );
      assert.equal(state.unlocked, 1);
      assert.equal(state.records[0].cleared, true);
      assert.equal(state.records[1].cleared, false);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
test(
  'phone atlas exposes all 32 cards and fits touch controls',
  { timeout: 90000 },
  async () => {
    const browser = await launch(chromium);
    try {
      for (const viewport of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        const context = await browser.newContext({
          viewport,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(pathToFileURL(resolve('public/mario.html')).href);
        await expect(
          page.getByRole('button', { name: 'Let’s play' }),
        ).toBeEnabled();
        assert.equal(
          await page.locator('.home-scroll .level-card').count(),
          32,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page
          .locator('.home-scroll [data-level="31"]')
          .scrollIntoViewIfNeeded();
        await expect(
          page.locator('.home-scroll [data-level="31"]'),
        ).toBeVisible();
        await page.screenshot({
          path: `work/nes-campaign/phone-${viewport.width}-atlas.png`,
        });
        await page.getByRole('button', { name: 'Let’s play' }).tap();
        await expect(
          page.getByRole('button', { name: 'Hold to sprint' }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Jump', exact: true }),
        ).toBeVisible();
        for (const selector of [
          '.toolbar',
          '.touch-pad',
          '.touch-jump',
          '.hud',
        ]) {
          const r = await page.locator(selector).boundingBox();
          assert.ok(
            r &&
              r.x >= -1 &&
              r.x + r.width <= viewport.width + 1 &&
              r.y >= -1 &&
              r.y + r.height <= viewport.height + 1,
            `${selector} exceeds ${viewport.width}×${viewport.height}: ${JSON.stringify(r)}`,
          );
        }
        await page.screenshot({
          path: `work/nes-campaign/phone-${viewport.width}-play.png`,
        });
        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
);
