const { test, expect } = require('playwright/test');
const path = require('node:path');
const { TeacherService } = require('../lib/teacher-service');
const { SetService } = require('../lib/set-service');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4030';
const DATA_DIR = process.env.WORKSPACE_TEST_DATA;
test.skip(!DATA_DIR || !/^http:\/\/127\.0\.0\.1:/.test(BASE_URL), 'Needs isolated local data and server.');
test.use({ baseURL: BASE_URL, serviceWorkers: 'block', locale: 'de-DE' });
const password = 'Workspace-Test2026!';
let fixture, sets;
test.beforeAll(async () => {
  const teachers = new TeacherService({ dataDir: DATA_DIR, seedPath: path.resolve('data/teachers.seed.json') });
  for (const credential of await teachers.provisionInitialPasswords()) {
    if (credential.id === 'julius') await teachers.changePassword({ teacherId: credential.id, currentPassword: credential.initialPassword, newPassword: password });
  }
  sets = new SetService({ dataDir: DATA_DIR });
  fixture = await sets.createSet('julius', { title: 'Workspace stable mode height', sidePreset: 'languages', sourceLabel: 'Deutsch', targetLabel: 'Englisch', sourceLanguage: 'de', targetLanguage: 'en', cards: [{ front: 'vorübergehend', back: 'temporarily' }, { front: 'krank', back: 'sick' }] });
});
test.afterAll(async () => { if (fixture) await sets.deleteOwnedSet('julius', fixture.id); });

for (const mode of ['light', 'dark']) {
  test(`${mode}: all four launch modes keep one height during transitions and viewport changes`, async ({ page }, info) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => localStorage.setItem('lerndeck-teacher-appearance-v1', JSON.stringify({mode})), mode);
    expect((await page.request.post('/api/teacher/session', { data: { teacherId: 'julius', password } })).ok()).toBeTruthy();
    await page.goto(`/index.html?teacherPractice=${fixture.id}&teacherPracticeTab=1`);
    await expect(page.locator('#launch-mode-modal')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.launch-mode-modal__mode-card')).toHaveCount(4);
    for (const width of [1440, 1024, 768, 390, 320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(450);
      const panel = page.locator('.launch-mode-modal__panel');
      const initial = await panel.boundingBox();
      for (const key of ['sentence', 'practice', 'test', 'write', 'sentence', 'practice']) {
        await page.locator(`[data-mode-key="${key}"].launch-mode-modal__mode-card`).click();
        for (const delay of [0, 170, 240]) {
          if (delay) await page.waitForTimeout(delay);
          const bounds = await panel.boundingBox();
          expect(Math.abs(bounds.height - initial.height)).toBeLessThan(1);
          expect(Math.abs(bounds.y - initial.y)).toBeLessThan(1);
        }
        expect(await page.locator('#launch-mode-detail-stage').evaluate(stage => {
          const content = stage.querySelector('.is-current');
          return content && content.offsetHeight <= stage.clientHeight && content.scrollWidth <= stage.clientWidth;
        })).toBeTruthy();
      }
      if (width === 1440 || width === 320) await panel.screenshot({path: info.outputPath(`${mode}-${width}.png`)});
    }
    // Interrupted transitions and reduced motion retain the same reserved space.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const baseline = await page.locator('.launch-mode-modal__panel').boundingBox();
    for (const key of ['sentence', 'practice', 'sentence', 'write']) {
      await page.locator(`[data-mode-key="${key}"].launch-mode-modal__mode-card`).click();
      const bounds = await page.locator('.launch-mode-modal__panel').boundingBox();
      expect(Math.abs(bounds.height - baseline.height)).toBeLessThan(1);
    }
    await page.waitForTimeout(450);
    await page.locator('#launch-mode-start').click();
    await expect(page.locator('#launch-settings-modal')).toBeVisible();
    await page.locator('#launch-settings-back').click();
    await expect(page.locator('#launch-mode-modal')).toBeVisible();
    await page.waitForTimeout(450);
    expect(Math.abs((await page.locator('.launch-mode-modal__panel').boundingBox()).height - baseline.height)).toBeLessThan(1);
    expect(errors).toEqual([]);
  });
}
