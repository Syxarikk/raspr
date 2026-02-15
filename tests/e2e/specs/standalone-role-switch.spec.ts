import { expect, test } from '@playwright/test';

import { installApiMock } from './mockApi';

test.describe('Standalone role switch', () => {
  test('operator password login -> logout -> promoter telegram login', async ({ page }) => {
    await installApiMock(page);

    await page.goto('/');

    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.locator('.role-badge')).toContainText('operator');

    await page.locator('[data-action="logout"]').click();
    await expect(page.getByRole('heading', { name: 'Вход в рабочее пространство' })).toBeVisible();

    await page.locator('[data-action="set-auth-mode"][data-mode="telegram"]').click();
    await page.locator('textarea[name="initData"]').fill('mock-init-data-role-switch');
    await page.getByRole('button', { name: 'Войти через Telegram' }).click();

    await expect(page.locator('.role-badge')).toContainText('promoter');
    await page.locator('[data-action="switch-tab"][data-tab="profile"]').first().click();
    await expect(page.getByRole('heading', { name: 'Профиль сессии' })).toBeVisible();
  });
});
