import { test, expect } from '@playwright/test';

/**
 * 主要導線の機能E2E（OS非依存・CIで毎回回す確実な回帰ネット）。
 * 注意: 問い合わせフォームは実送信しない。submit すると web3forms に
 * 本物の問い合わせが飛ぶため、存在・必須属性の確認に留める。
 */
test.describe('katachi-ai LP — 主要導線E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('トップページが読み込まれ、タイトルとヒーローが表示される', async ({ page }) => {
    await expect(page).toHaveTitle(/中村元揮|AI/);
    await expect(page.locator('.hero')).toBeVisible();
  });

  test('開発セクションの価格が正しい（価格改定の恒久ガード）', async ({ page }) => {
    const dev = page.locator('#development');
    await expect(dev.locator('.pricing-card', { hasText: 'Web制作・LP制作' })).toContainText('25万円〜');
    await expect(dev.locator('.pricing-card', { hasText: 'AIを組み込んだシステム開発' })).toContainText('120万円〜');
    await expect(dev.locator('.pricing-card', { hasText: '業務システム・ツール開発' })).toContainText('150万円〜');
    await expect(dev.locator('.pricing-card', { hasText: 'アプリ開発' })).toContainText('150万円〜');
  });

  test('伴走プランの価格が表示される', async ({ page }) => {
    const pricing = page.locator('#pricing');
    await expect(pricing).toContainText('月15万円');
    await expect(pricing).toContainText('月25万円');
    await expect(pricing).toContainText('40万円');
  });

  test('伴走プランに実装枠が明示される（2026-07 商品改訂の恒久ガード）', async ({ page }) => {
    const pricing = page.locator('#pricing');
    await expect(pricing.locator('.pricing-card', { hasText: 'ライト伴走' })).toContainText('実装枠 月5時間');
    await expect(pricing.locator('.pricing-card', { hasText: '集中伴走' })).toContainText('実装枠 月10時間');
    await expect(pricing.locator('.pricing-card', { hasText: '集中伴走' })).toContainText('AI利用ルールの整備');
  });

  test('FAQアコーディオンがクリックで開く', async ({ page }) => {
    const firstItem = page.locator('.faq-item').first();
    const firstQ = firstItem.locator('.faq-q');
    await expect(firstItem).not.toHaveClass(/open/);
    await firstQ.click();
    await expect(firstItem).toHaveClass(/open/);
    await expect(firstQ).toHaveAttribute('aria-expanded', 'true');
  });

  test('問い合わせフォームが必須項目を備えている（送信はしない）', async ({ page }) => {
    const form = page.locator('#contactForm');
    await expect(form.locator('#cf-name')).toHaveJSProperty('required', true);
    await expect(form.locator('#cf-company')).toHaveJSProperty('required', true);
    await expect(form.locator('#cf-email')).toHaveJSProperty('required', true);
    await expect(form.locator('#cf-message')).toHaveJSProperty('required', true);
  });

  test('「相談する」CTAが問い合わせセクションへ遷移する', async ({ page }) => {
    await page.locator('a.nav-cta[href="#contact"]').first().click();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.locator('#contact')).toBeVisible();
  });
});
