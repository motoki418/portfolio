import { test, expect, type Page } from '@playwright/test';

/**
 * ビジュアル回帰（崩れ検出）。フルページ + 重要セクションを撮り、
 * 変更前後でレイアウトが崩れていないかを比較する。
 * ベースライン更新は `npm run update-snapshots`。
 */

// アニメーション・遅延描画を止めて決定論的に撮る
async function freeze(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { transition: none !important; animation: none !important; }
      .reveal { opacity: 1 !important; transform: none !important; }
    `,
  });
  // Webフォント読み込み完了を待つ（テキスト描画のちらつき防止）
  await page.evaluate(() => document.fonts.ready);
}

test.describe('katachi-ai LP — ビジュアル回帰', () => {
  test('フルページ', async ({ page }) => {
    await page.goto('/');
    await freeze(page);
    await expect(page).toHaveScreenshot('full-page.png', { fullPage: true });
  });

  test('開発セクション（料金カード）', async ({ page }) => {
    await page.goto('/#development');
    await freeze(page);
    await expect(page.locator('#development')).toHaveScreenshot('development.png');
  });

  test('料金プラン（伴走）', async ({ page }) => {
    await page.goto('/#pricing');
    await freeze(page);
    await expect(page.locator('#pricing')).toHaveScreenshot('pricing.png');
  });

  test('研修概要セクション（新設）', async ({ page }) => {
    await page.goto('/#training-intro');
    await freeze(page);
    await expect(page.locator('#training-intro')).toHaveScreenshot('training-intro.png');
  });

  test('法人向けAI研修ページ フルページ', async ({ page }) => {
    await page.goto('/training/');
    await freeze(page);
    await expect(page).toHaveScreenshot('training-full-page.png', { fullPage: true });
  });

  test('AI業務自動化サービスページ フルページ', async ({ page }) => {
    await page.goto('/services/ai-workflow-automation/');
    await freeze(page);
    await expect(page).toHaveScreenshot('services-ai-workflow-automation-full-page.png', { fullPage: true });
  });

  test('運営者情報ページ フルページ', async ({ page }) => {
    await page.goto('/about/');
    await freeze(page);
    await expect(page).toHaveScreenshot('about-full-page.png', { fullPage: true });
  });
});
