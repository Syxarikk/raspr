import { expect, test } from '@playwright/test';

import { installApiMock } from './mockApi';

test.describe('Standalone promoter flow', () => {
  test('telegram login -> upload photo -> see payout', async ({ page }) => {
    await installApiMock(page);

    await page.goto('/');

    await page.locator('[data-action="set-auth-mode"][data-mode="telegram"]').click();
    await page.locator('textarea[name="initData"]').fill('mock-init-data');
    await page.getByRole('button', { name: 'Войти через Telegram' }).click();

    await expect(page.getByRole('heading', { name: 'Дашборд' })).toBeVisible();

    await page.locator('[data-action="switch-tab"][data-tab="upload"]').first().click();
    await expect(page.getByRole('heading', { name: 'Отправить фото-отчет' })).toBeVisible();

    await page.setInputFiles('input[data-action="upload-file"]', {
      name: 'report.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([255, 216, 255, 217]),
    });

    await page.getByRole('button', { name: 'Загрузить фото' }).click();
    await expect(page.locator('.notice.ok')).toContainText('Фото загружено');

    await page.locator('[data-action="switch-tab"][data-tab="my_payouts"]').first().click();
    await expect(page.locator('.toolbar h1')).toHaveText('Мои выплаты');
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });
});
