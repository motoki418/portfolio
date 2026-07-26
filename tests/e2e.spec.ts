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

/**
 * 構造化データ（JSON-LD）のエンティティ整合ガード。
 *
 * 検索エンジンとAIに「中村元揮＝この事業」を一つの実体として読ませるための錠前。
 * インラインJSONの手編集はカンマ1つで全滅するうえ、@id の参照切れや sameAs の
 * コピー間ドリフトは画面上まったく見えないため、壊れたら必ず落ちる形で固定する。
 */
const ENTITY_PAGES = ['/', '/about/', '/training/', '/services/ai-workflow-automation/'];
const PERSON_ID = 'https://katachi-ai.com/#person';
const BUSINESS_ID = 'https://katachi-ai.com/#business';

type JsonLdNode = Record<string, any>;

/** @graph をほどいてノードの配列にする（@graph を持たない単体JSON-LDも許容） */
function flattenGraph(docs: JsonLdNode[]): JsonLdNode[] {
  return docs.flatMap((doc) => (Array.isArray(doc['@graph']) ? doc['@graph'] : [doc]));
}

/** 再帰的に走査し、{"@id": "..."} だけのオブジェクト（＝他ノードへの参照）を集める */
function collectRefs(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, found);
  } else if (value && typeof value === 'object') {
    const obj = value as JsonLdNode;
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === '@id' && typeof obj['@id'] === 'string') {
      found.push(obj['@id']);
    } else {
      for (const child of Object.values(obj)) collectRefs(child, found);
    }
  }
  return found;
}

async function readNodes(page: import('@playwright/test').Page, path: string): Promise<JsonLdNode[]> {
  await page.goto(path);
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length, `${path} に JSON-LD ブロックが無い`).toBeGreaterThan(0);
  const docs = blocks.map((text, i) => {
    try {
      return JSON.parse(text) as JsonLdNode;
    } catch (e) {
      throw new Error(`${path} の JSON-LD[${i}] がパースできない: ${(e as Error).message}`);
    }
  });
  return flattenGraph(docs);
}

test.describe('構造化データ — エンティティ整合ガード', () => {
  for (const path of ENTITY_PAGES) {
    test(`${path} — JSON-LDがパースでき、@id参照が全て同一ページ内で解決する`, async ({ page }) => {
      const nodes = await readNodes(page, path);
      const definedIds = new Set(
        nodes.filter((n) => typeof n['@id'] === 'string' && n['@type']).map((n) => n['@id'] as string)
      );
      const dangling = [...new Set(collectRefs(nodes))].filter((id) => !definedIds.has(id));
      expect(
        dangling,
        `参照先が未定義の @id（provider や isPartOf が実体に解決できず、誰が提供する何かが機械可読にならない）`
      ).toEqual([]);
    });
  }

  test('#person と #business が全ページで同じ @type・同じ sameAs を持つ', async ({ page }) => {
    const typeById = new Map<string, string>();
    const sameAsById = new Map<string, string>();

    for (const path of ENTITY_PAGES) {
      for (const node of await readNodes(page, path)) {
        const id = node['@id'];
        if (typeof id !== 'string' || !node['@type']) continue;

        const type = String(node['@type']);
        const knownType = typeById.get(id);
        if (knownType === undefined) typeById.set(id, type);
        else expect(type, `${id} の @type が ${path} で食い違う`).toBe(knownType);

        if (node.sameAs) {
          const sameAs = JSON.stringify(node.sameAs);
          const knownSameAs = sameAsById.get(id);
          if (knownSameAs === undefined) sameAsById.set(id, sameAs);
          else expect(sameAs, `${id} の sameAs が ${path} で食い違う`).toBe(knownSameAs);
        }
      }
    }

    expect(typeById.get(PERSON_ID), '#person の @type が Person でない').toBe('Person');
    expect(typeById.get(BUSINESS_ID), '#business の @type が ProfessionalService でない').toBe(
      'ProfessionalService'
    );

    const personSameAs = sameAsById.get(PERSON_ID);
    const businessSameAs = sameAsById.get(BUSINESS_ID);
    expect(personSameAs, '#person に sameAs が無い').toBeTruthy();
    expect(businessSameAs, '#business に sameAs が無い').toBeTruthy();
    expect(businessSameAs, '#person と #business の sameAs が不一致（片方だけ更新したドリフト）').toBe(
      personSameAs
    );
  });

  test('肩書が全ページ・全導線で正本と一致する（3種類に分裂していた経緯の再発ガード）', async ({ page }) => {
    // 名乗りの正本は「AI推進パートナー」。2026-07-25 時点でサイトのJSON-LDだけが
    // 「AI導入支援・エンジニア」を名乗り、X表示名・問い合わせメールと食い違っていた。
    // これに検索・AI回答で拾われる語として「AI導入支援」を併記する（2026-07-26 オーナー判断）。
    // 順序まで固定するのは、ページ間で並びが割れると同一人物の肩書が2通りに見えるため。
    const JOB_TITLES = ['AI推進パートナー', 'AI導入支援'];

    for (const path of ['/', '/about/']) {
      const person = (await readNodes(page, path)).find((n) => n['@id'] === PERSON_ID);
      expect(person?.jobTitle, `${path} の jobTitle が正本と違う`).toEqual(JOB_TITLES);
    }

    // 問い合わせメールの送信者名は、主たる名乗りと一致している必要がある（受信側から見た名乗りの一致）
    await page.goto('/');
    const fromName = await page.locator('input[name="from_name"]').getAttribute('value');
    expect(fromName, '問い合わせフォームの送信者名に正本の肩書が入っていない').toContain(JOB_TITLES[0]);
  });

  test('sameAs が本人所有のプロフィールだけを指す（他人アカウント混入の恒久ガード）', async ({ page }) => {
    const nodes = await readNodes(page, '/');
    const person = nodes.find((n) => n['@id'] === PERSON_ID);
    const sameAs = (person?.sameAs ?? []) as string[];

    // 本人アカウント（origin remote が motoki418/katachi-ai-lp であることが所有の根拠）
    expect(sameAs).toContain('https://github.com/motoki418');
    // github.com/MotokiNakamura は別人のアカウント。氏名が一致するため混入しやすい
    expect(
      sameAs.some((url) => /github\.com\/MotokiNakamura/i.test(url)),
      '別人の GitHub アカウント(MotokiNakamura)が sameAs に混入している'
    ).toBe(false);
  });
});
