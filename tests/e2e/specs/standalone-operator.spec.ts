import { expect, test } from '@playwright/test';

import { installApiMock } from './mockApi';

test.describe('Standalone operator flow', () => {
  test('login -> create order -> review photo -> payout status', async ({ page }) => {
    await installApiMock(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Вход в рабочее пространство' })).toBeVisible();
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page.getByRole('heading', { name: 'Дашборд' })).toBeVisible();

    await page.locator('[data-action="switch-tab"][data-tab="orders"]').first().click();
    await expect(page.getByRole('heading', { name: 'Наряды workspace' })).toBeVisible();

    await page.locator('[data-action="create-order"]').click();
    await expect(page.locator('.notice.ok')).toContainText('Наряд #');

    await page.locator('button[data-action="select-order"]').first().click();
    await page.locator('button[data-action="review-photo"][data-review-status="accepted"]').first().click();

    await expect(page.locator('.notice.ok')).toContainText('Фото принято');

    await page.locator('[data-action="switch-tab"][data-tab="payouts"]').first().click();
    await expect(page.getByRole('heading', { name: 'Выплаты по команде' })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toContainText('to_pay');
  });
});
