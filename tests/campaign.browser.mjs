import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, webkit, expect } from '@playwright/test';
await mkdir('work/campaign', { recursive: true });
await build({
  entryPoints: ['tests/browser-harness.ts'],
  bundle: true,
  format: 'iife',
  outfile: 'work/campaign/harness.js',
});
await writeFile(
  'work/campaign/harness.html',
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
    `${name}: all 24 courses render, advance, persist, and release their resources`,
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
        await page.goto(
          pathToFileURL(resolve('work/campaign/harness.html')).href,
        );
        await page.waitForFunction(() => !!window.testGame);
        const stats = [];
        for (let level = 0; level < 24; level++) {
          stats.push(
            await page.evaluate((level) => {
              const g = window.testGame;
              g.save.unlocked = 23;
              g.selectLevel(level, false);
              g.loop(1000 + level * 1000);
              return {
                level: g.state.level,
                meshes: g.renderer.info.memory.geometries,
                textures: g.renderer.info.memory.textures,
                drawCalls: g.renderer.info.render.calls,
                checkpoints: g.world.checkpoints.length,
                stars: g.world.coins.filter((c) => c.star !== undefined).length,
                glError: g.renderer.getContext().getError(),
              };
            }, level),
          );
          if (level % 4 === 0)
            await page.screenshot({
              path: `work/campaign/${name}-world-${Math.floor(level / 4) + 1}.png`,
            });
          assert.equal(stats.at(-1).level, level);
          assert.equal(stats.at(-1).glError, 0);
          assert.equal(stats.at(-1).stars, 3);
          assert.equal(stats.at(-1).checkpoints, 4);
        }
        const graphics = await page.evaluate(async () => {
          const g = window.testGame;
          g.pause();
          const color = g.scene.background.getHexString();
          const enabled = await g.setRtx(true);
          g.loop(30000);
          await g.setRtx(false);
          return {
            enabled,
            color,
            restored: g.scene.background.getHexString(),
          };
        });
        assert.equal(graphics.enabled, true);
        assert.equal(graphics.color, graphics.restored);
        const completion = await page.evaluate(() => {
          const g = window.testGame;
          g.state.status = 'playing';
          g.world.boss.hurt = 0;
          g.hitBoss();
          g.world.boss.hurt = 0;
          g.hitBoss();
          g.world.boss.hurt = 0;
          g.hitBoss();
          Object.assign(g.player, g.world.level.goal);
          g.simulate(1 / 120);
          g.loop(31000);
          return {
            status: g.state.status,
            gate: g.world.gateBox.active,
            record: g.save.records[23].cleared,
          };
        });
        assert.deepEqual(completion, {
          status: 'won',
          gate: false,
          record: true,
        });
        const cleanup = await page.evaluate(async () => {
          const g = window.testGame;
          g.selectLevel(0, false);
          g.pause();
          g.loop(32000);
          const before = { ...g.renderer.info.memory };
          for (let i = 0; i < 5; i++) {
            g.restart(false);
            g.pause();
            g.loop(33000 + i * 1000);
          }
          const after = { ...g.renderer.info.memory };
          await g.setRtx(true);
          g.nextLevel(false);
          g.restart(false);
          await new Promise((r) => setTimeout(r, 100));
          g.pause();
          g.loop(40000);
          const active = !!g.rtx;
          await g.setRtx(false);
          g.destroy();
          return { before, after, active };
        });
        assert.deepEqual(
          cleanup.after,
          cleanup.before,
          'Restarts must not accumulate textures/geometries',
        );
        assert.equal(
          cleanup.active,
          true,
          'Restart must retain the graphics preference',
        );
        assert.deepEqual(errors, []);
        console.log(
          `${name}: ${JSON.stringify({ maximumDrawCalls: Math.max(...stats.map((s) => s.drawCalls)), textures: Math.max(...stats.map((s) => s.textures)), geometries: Math.max(...stats.map((s) => s.meshes)) })}`,
        );
      } finally {
        await browser.close();
      }
    },
  );
}
test(
  'standalone menus, saved map, native controls, and narrow touch screens',
  { timeout: 120000 },
  async () => {
    const browser = await launch(chromium);
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(pathToFileURL(resolve('public/mario.html')).href);
      await expect(
        page.getByRole('button', { name: 'Let’s play' }),
      ).toBeEnabled();
      await page.getByRole('button', { name: 'Open level map' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      assert.equal(await page.locator('.level-card').count(), 4);
      assert.equal(await page.locator('.level-card:disabled').count(), 3);
      await page.getByRole('button', { name: /06 Bowser/ }).click();
      assert.equal(await page.locator('.level-card:disabled').count(), 4);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('button', { name: 'Let’s play' }).click();
      await page.keyboard.down('w');
      await page.waitForTimeout(850);
      await page.keyboard.up('w');
      await page.keyboard.press('p');
      await expect(
        page.getByRole('heading', { name: 'Take a breather.' }),
      ).toBeVisible();
      assert.equal(await page.locator('.game-notice').count(), 0);
      await page.screenshot({ path: 'work/campaign/desktop-pause.png' });
      await page.getByRole('button', { name: 'Keep playing' }).click();
      await page.keyboard.press('Space');
      await page.keyboard.press('p');
      await expect(
        page.getByRole('heading', { name: 'Take a breather.' }),
      ).toBeVisible();
      await page.evaluate(() => {
        localStorage.setItem(
          'mario-first-person.campaign.v2',
          JSON.stringify({
            version: 2,
            unlocked: 1,
            records: [
              {
                cleared: true,
                stars: 5,
                score: 9000,
                bestTime: 222,
                coinMedal: true,
                speedMedal: true,
                cleanMedal: false,
              },
            ],
          }),
        );
      });
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Continue adventure' }),
      ).toBeEnabled();
      await page.getByRole('button', { name: 'Open level map' }).click();
      await expect(
        page.getByRole('button', { name: 'World 1–2, The Long Way Up' }),
      ).toBeEnabled();
      assert.equal(
        await page.locator('.level-card .star-slots .collected').count(),
        2,
      );
      await page
        .getByRole('button', { name: 'World 1–2, The Long Way Up' })
        .click();
      await page.keyboard.press('p');
      await expect(
        page.getByRole('heading', { name: 'Take a breather.' }),
      ).toBeVisible();
      assert.deepEqual(errors, []);
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
      const phone = await mobile.newPage();
      await phone.goto(pathToFileURL(resolve('public/mario.html')).href);
      await expect(
        phone.getByRole('button', { name: 'Let’s play' }),
      ).toBeEnabled();
      await phone.screenshot({ path: 'work/campaign/mobile-home.png' });
      await phone.getByRole('button', { name: 'Let’s play' }).tap();
      await expect(
        phone.getByRole('button', { name: 'Hold to sprint' }),
      ).toBeVisible();
      await expect(
        phone.getByRole('button', { name: 'Jump', exact: true }),
      ).toBeVisible();
      await phone.screenshot({ path: 'work/campaign/mobile-play.png' });
      await phone.getByRole('button', { name: 'Pause game' }).tap();
      await phone.getByRole('button', { name: 'Open level map' }).tap();
      await phone.screenshot({ path: 'work/campaign/mobile-map.png' });
      const overflow = await phone.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false);
    } finally {
      await browser.close();
    }
  },
);
