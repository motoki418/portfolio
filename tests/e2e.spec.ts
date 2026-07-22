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

  test('ヘッダーナビから新規ページ（研修）へ遷移できる', async ({ page, isMobile }) => {
    test.skip(isMobile, 'モバイルはヘッダーナビ非表示の既存仕様（.header-nav a:not(.nav-cta) { display: none }）');
    await page.locator('.header-nav a[href="/training/"]').click();
    await expect(page).toHaveURL(/\/training\/$/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('本文・フッターから新規ページ（サービス/運営者情報）へ遷移できる', async ({ page }) => {
    await page.locator('#development a[href="/services/ai-workflow-automation/"]').click();
    await expect(page).toHaveURL(/\/services\/ai-workflow-automation\/$/);
    await expect(page.locator('h1')).toBeVisible();

    await page.goto('/');
    await page.locator('.profile-links a[href="/about/"]').click();
    await expect(page).toHaveURL(/\/about\/$/);
    await expect(page.locator('h1')).toBeVisible();
  });
});

/**
 * 新規ページ（研修/サービス/運営者情報）の主要導線E2E。
 * トップと同様、フォームは実送信しない。
 */
test.describe('katachi-ai LP — 新規ページE2E（training / services / about）', () => {
  const newPages: Array<{ path: string; canonical: string }> = [
    { path: '/training/', canonical: 'https://katachi-ai.com/training/' },
    { path: '/services/ai-workflow-automation/', canonical: 'https://katachi-ai.com/services/ai-workflow-automation/' },
    { path: '/about/', canonical: 'https://katachi-ai.com/about/' },
  ];

  for (const { path, canonical } of newPages) {
    test(`${path} — H1が1つ・canonicalが自己参照・CTAリンクが存在する`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
      await expect(page.locator('a.btn-primary').first()).toBeVisible();
    });

    test(`${path} — モバイル幅(390px)で横スクロールが発生しない`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(hasHorizontalScroll).toBe(false);
    });
  }
});
