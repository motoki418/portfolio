import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  inspectPdf,
  rawUris,
  linkAnnotationCount,
  fingerprintOf,
} from '../scripts/inspect-checklist-pdf.mjs';

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

/**
 * 公開している主張（数値・条件）のページ間一貫性ガード。
 *
 * 同じ事例から違う数字が出る／同じ導線で違う条件を提示する、という食い違いは
 * 画面上まったく目立たないまま本番に残り（bd katachi-fkc / katachi-5sr で実際に発生）、
 * 読者にも AI 検索エンジンにも「どちらかが誤り」と読まれる。壊れたら必ず落ちる形で固定する。
 * 換算基準の正本は docs/claims-basis.md。基準を変えるときは、正本 → このガード → 各ページの順で直す。
 */
test.describe('公開している主張の一貫性ガード', () => {
  test('実績数値の換算が正本(年48稼働週)どおりで、月換算の過大表記が復活していない', async ({ page }) => {
    await page.goto('/');
    const roi = page.locator('.pricing-roi');

    // 元数値（実測）: 週5時間 → 30分 ＝ 毎週4.5時間。年48稼働週 → 年216時間。
    await expect(roi).toContainText('週5時間');
    await expect(roi).toContainText('毎週4.5時間');
    await expect(roi).toContainText('年間216時間');
    await expect(roi, '換算基準の併記が消えると、試算値が実測値として読まれる').toContainText('年48稼働週');

    // 52週基準ですら19.5時間で、「月20時間超」はどの基準でも導けない過大表記だった
    await expect(roi).not.toContainText('月20時間');
  });

  test('無料相談の所要時間が全ページで1時間に揃っている', async ({ page }) => {
    // 「初回1時間無料相談」「まずは1時間、無料相談から」など言い回しはページごとに違ってよい。
    // 固定するのは所要時間そのもの。30分側の表記は、事例の「週5時間→30分」と衝突しないよう
    // 相談の文脈（◯分相談 / まず◯分）に限って禁止する。
    const STALE_DURATION = /30分(の)?(無料)?相談|まず30分/;

    // 所要時間を明示している面。ここから時間の記載が消えるのも劣化なので、存在を要求する。
    // リードマグネットは拡張子なしURLで公開されるが、テスト用の静的サーバは実ファイル名で配信する。
    const pagesStatingDuration = [
      '/',
      '/about/',
      '/services/ai-workflow-automation/',
      '/downloads/ai-readiness-checklist.html',
    ];
    for (const path of pagesStatingDuration) {
      await page.goto(path);
      const body = await page.locator('body').innerText();
      expect(body, `${path} に無料相談の所要時間表記が無い`).toMatch(/1時間/);
      expect(body, `${path} に旧表記の30分相談が残っている`).not.toMatch(STALE_DURATION);
    }

    // /training/ は所要時間を書かず LP の #contact へ送る設計。時間を書かないのは許容するが、
    // 書くなら1時間側でなければならない（30分表記の再流入だけを塞ぐ）。
    await page.goto('/training/');
    expect(await page.locator('body').innerText(), '/training/ に30分相談が入り込んでいる').not.toMatch(
      STALE_DURATION
    );
  });

  test('プライバシーポリシーがアクセス解析の外部送信とオプトアウトを開示している', async ({ page }) => {
    // GA4 を全ページで稼働させている以上、送信情報・送信先・利用目的・停止方法の
    // 開示が要る（電気通信事業法の外部送信規律）。診断セクションの公開前提でもある。
    await page.goto('/privacy.html');
    const body = await page.locator('body').innerText();
    expect(body, '解析ツール名が書かれていない').toContain('Googleアナリティクス4');
    expect(body, '計測IDが正本と違う／書かれていない').toContain('G-DNCMC8QGMV');
    expect(body, 'Cookieの使用が書かれていない').toContain('Cookie');
    expect(body, 'オプトアウト手段が案内されていない').toMatch(/オプトアウト|無効化/);

    const optOut = page.locator('a[href="https://tools.google.com/dlpage/gaoptout"]');
    await expect(optOut, 'オプトアウトアドオンへのリンクが無い').toHaveCount(1);
  });
});

/**
 * 配布PDFと生成元HTMLのドリフト検知。
 *
 * 配布PDFは2026-04-28に手動のChrome印刷で作られたきり3ヶ月更新されず、その間にHTML側だけが
 * 改訂された。結果、公開PDFに旧表記「30分無料相談」と、既に404になった旧URL
 * （motoki418.github.io/portfolio）が残ったまま配布され続けた。2026-07-26 に
 * scripts/build-checklist-pdf.mjs を新設して現物は直したが、スクリプトを誰も呼ばなければ
 * 次にHTMLを編集した時点で同じ状態に戻る。ここで「HTMLを編集したのにPDFを再生成していない」
 * を必ず落ちる形にして閉じる。
 *
 * PDFのバイナリ同士を比較する案は採らない。PDFには生成日時が埋め込まれ、内容が同じでも
 * バイト差分が出るため常時赤になる。代わりに2つの決定論的な記録を突き合わせる:
 *   sourceSha256   … 生成元HTMLの内容ハッシュ。「HTMLだけ編集してPDF未再生成」を捕まえる。
 *   pdfFingerprint … PDFから読み取れた本文とリンクの指紋。HTMLハッシュだけだと
 *                    「スクリプトを通さず手動印刷でPDFを差し替えた」「記録だけ更新して
 *                    PDFを入れ忘れた」が素通りする（＝この経緯そのものの再発）ため、
 *                    PDF実体の側からも縛る。抽出器が劣化した場合もここで落ちる。
 */
test.describe('配布PDF — 生成元HTMLとのドリフト検知', () => {
  // npm run test:e2e も CI の step もリポジトリ直下から起動する
  const root = process.cwd();
  const sourceHtml = resolve(root, 'downloads/ai-readiness-checklist.html');
  const pdf = resolve(root, 'downloads/ai-readiness-checklist.pdf');
  const manifestPath = resolve(root, 'scripts/checklist-pdf.manifest.json');
  const REBUILD = 'node scripts/build-checklist-pdf.mjs';

  test('配布PDFが最新のHTMLから生成されている（手動印刷時代のドリフト再発ガード）', () => {
    expect(existsSync(pdf), `配布PDFが存在しない。再生成する: ${REBUILD}`).toBe(true);

    // 空ファイル・書き込み途中で壊れたPDFを弾く。ハッシュ一致は「スクリプトを走らせた」ことしか
    // 保証せず、成果物そのものの健全性は見ないため、下限サイズを別の観測量として持つ。
    // 現物は約770KB（フォント埋め込み込み）。
    const bytes = statSync(pdf).size;
    expect(bytes, `配布PDFが小さすぎる（${bytes} bytes）。壊れている可能性がある。再生成する: ${REBUILD}`)
      .toBeGreaterThan(100 * 1024);

    expect(existsSync(manifestPath), `PDFの生成記録が無い。手で作らず再生成する: ${REBUILD}`).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    expect(
      createHash('sha256').update(readFileSync(sourceHtml)).digest('hex'),
      [
        'downloads/ai-readiness-checklist.html が、配布PDFを生成した時点の内容と違う。',
        'HTMLだけを編集してPDFを取り残した状態（公開物に旧表記・死んだURLが残る事故の再発）。',
        `復旧手順: ${REBUILD} を実行し、生成された downloads/ai-readiness-checklist.pdf と`,
        'scripts/checklist-pdf.manifest.json の両方をコミットする。',
        '（記録ファイルを手で書き換えて通すのは検査の無効化なので禁止）',
      ].join('\n')
    ).toBe(manifest.sourceSha256);

    expect(
      fingerprintOf(inspectPdf(readFileSync(pdf))),
      [
        '配布PDFの中身が、記録された生成時の中身と違う。次のいずれかが起きている:',
        '  - スクリプトを通さず手動印刷などでPDFを差し替えた（この資料が3ヶ月腐った経緯そのもの）',
        '  - 記録ファイルだけ更新して、再生成したPDFをコミットし忘れた',
        '  - PDF読み取り側（scripts/inspect-checklist-pdf.mjs）が壊れて中身を読めなくなった',
        `復旧手順: ${REBUILD} を実行し、PDFと manifest の両方をコミットする。`,
        '読み取り側を疑うときは node scripts/verify-pdf-inspector.mjs で切り分ける。',
      ].join('\n')
    ).toBe(manifest.pdfFingerprint);
  });
});

/**
 * 配布PDFの中身（リンク先・表示テキスト）の検査。
 *
 * ハッシュ照合は「PDFがHTMLより古い」しか捕まえない。旧PDFの実害はそれとは別軸だった:
 *  - p4: 表示テキストは https://motoki418.github.io/portfolio/#hero（404）なのに、リンク注釈の
 *    実際の飛び先は https://ai-advisory-hokkaido.pages.dev/#hero（DNSごと消滅）。
 *    クリック先は目視校正では原理的に見えないため、3ヶ月そのまま配布された。
 *  - p1: フッターの motoki418.github.io/portfolio はリンク注釈を持たないベタテキスト。
 *    文書全体でリンク注釈は1個しか無く、注釈の列挙だけでは原理的に検出できなかった。
 *
 * よって3本立てで見る（1本でも欠けると上のどちらかを取りこぼす）。
 * 検査は node:zlib だけで完結する scripts/inspect-checklist-pdf.mjs で行う。CI(ubuntu-latest)に
 * PDFライブラリを入れずに必ず走らせるためで、ローカルの PyMuPDF は
 * scripts/verify-pdf-inspector.mjs での照合（正解データ）にのみ使う。
 */
test.describe('配布PDF — リンク先と表示テキストの検査', () => {
  const pdfPath = resolve(process.cwd(), 'downloads/ai-readiness-checklist.pdf');

  // 正規のURL。ここ以外へのリンクを増やすときは、意図的な追加としてこの配列を編集する
  // （検査を消すのではなく、許可先を明示的に足す）。
  const ALLOWED_ORIGINS = ['https://katachi-ai.com/'];

  // 過去に公開物へ残っていた死んだホストと、正規でない自社ホスト。
  // スキーム無しのベタ書き（motoki418.github.io/portfolio には https:// が付いていなかった）でも
  // 必ず当たるよう、`https?://` を前提にしない。
  // github.io / pages.dev は広めに取ってある。この配布物は katachi-ai.com 以外を指す理由が無いため、
  // 第三者のホスティングURLが紛れ込むこと自体を異常として扱う。将来それを正当に引用する必要が出たら、
  // この正規表現を緩めるのではなく、その1件だけを許可する形で明示的に足すこと（検査の無効化を避ける）。
  const DEAD_HOST_PATTERN = /motoki418|github\.io|pages\.dev|ai-advisory|katachi-ai\.jp|www\.katachi-ai\.com/i;

  const isUrlShaped = (text: string) => /:\/\//.test(text) || /[a-z0-9-]+(\.[a-z0-9-]+)+\/\S/i.test(text);
  const normalizeUrl = (url: string) => url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  // 抽出器が静かに壊れて空を返すと、以下3本は「見るものが無いので緑」になり、合格と未実行の
  // 区別がつかなくなる。実際、初版のカナリアには次の3つの穴があった（レビューで実測）:
  //   - 注釈URIの突き合わせを rawUris() と inspectPdf() で行っていたが、両者は同じ /URI 正規表現に
  //     依存しており、URIの書き方が想定外だと揃って空になり [] === [] で通った
  //   - 表示テキストが空でも検査2は「URLの形をしていない」として continue するだけで通った
  //   - 既知文字列の検査が文書全体の連結テキスト相手だったため、p2/p3 が丸ごと空でも通った
  // よって以下は「中身の正しさ」ではなく「抽出器が生きていること」を独立した観測量で先に要求する。
  const load = () => {
    const buf = readFileSync(pdfPath);
    const result = inspectPdf(buf);
    const DIAGNOSE = 'node scripts/verify-pdf-inspector.mjs で抽出器の生死を切り分ける。';

    expect(
      result.pageCount,
      `PDFのページ数が想定と違う。抽出器が壊れた可能性が高い（${DIAGNOSE}）\n` +
        '資料を増減してページ数が本当に変わったのなら、この期待値の更新が正しい直し方。'
    ).toBe(4);

    // 床1: ページごとに本文が読めていること。全体の連結で見ると、空のページが他ページの
    // 文字数に隠れて素通りする（検査3はページ単位で回るため、空ページは無検査になる）。
    // 現物は p1:221 / p2:407 / p3:327 / p4:252 文字。
    for (const { page, text } of result.pages) {
      expect(text.length, `p${page} の本文が読めていない（${text.length}文字）。${DIAGNOSE}`).toBeGreaterThan(
        100
      );
    }

    // 床2: リンク注釈が拾えていること。件数は /URI とは無関係な /Subtype /Link から数えるので、
    // URIの書き方が想定外で inspectPdf と rawUris が揃って空になっても、ここで捕まる。
    const annotCount = linkAnnotationCount(buf);
    expect(annotCount, `PDFにリンク注釈が1つも無い。${DIAGNOSE}`).toBeGreaterThan(0);
    expect(
      result.links.length,
      `リンク注釈は${annotCount}個あるのに、URIを解析できたのは${result.links.length}個。\n` +
        `URIの書かれ方が想定外（hex文字列・エスケープ・間接参照）の可能性がある。${DIAGNOSE}`
    ).toBe(annotCount);
    expect(result.links.map((l) => l.uri).sort(), '生バイト列から見える /URI と解析結果が食い違う').toEqual(
      rawUris(buf).sort()
    );

    // 床3: 各リンクの矩形内テキストが取れていること。空だと検査2が「URLの形をしていない」として
    // 素通りし、表示とクリック先の食い違い（今回の事故そのもの）を検出できなくなる。
    for (const link of result.links) {
      expect(
        link.visible.trim().length,
        `p${link.page} のリンク(${link.uri})の表示テキストが取れていない。座標フィルタの破損が疑われる。${DIAGNOSE}`
      ).toBeGreaterThan(0);
    }

    // ここから先は抽出器の生死ではなく「内容が想定どおりか」。古い版のPDFを掴んでいる場合もここで落ちる。
    for (const marker of ['katachi-ai.com', 'AI導入チェックリスト', '中村元揮']) {
      expect(
        result.text,
        `PDFに既知の文字列「${marker}」が無い。抽出器は動いているので、PDFの中身が想定と違う（古い版の可能性）。`
      ).toContain(marker);
    }

    return result;
  };

  test('1) リンク注釈の飛び先が正規URLだけを指す（消滅した旧ドメインの再流入ガード）', () => {
    const { links } = load();

    for (const link of links) {
      expect(
        DEAD_HOST_PATTERN.test(link.uri),
        `p${link.page} のリンクが死んだ旧ドメインを指している: ${link.uri}`
      ).toBe(false);

      expect(
        ALLOWED_ORIGINS.some((origin) => link.uri.startsWith(origin)),
        `p${link.page} のリンクが正規URL(${ALLOWED_ORIGINS.join(' / ')})の外を指している: ${link.uri}\n` +
          '外部サイトへのリンクを意図して増やしたのなら、この検査の ALLOWED_ORIGINS に\n' +
          'その行き先を明示的に足すのが正しい直し方（検査ごと外すのは不可）。'
      ).toBe(true);
    }
  });

  test('2) リンク注釈の飛び先と、その矩形内の表示テキストが一致する（目視で見えない食い違いのガード）', () => {
    const { links } = load();

    for (const link of links) {
      // 「詳しくはこちら」のようなラベルは対象外。URLの形で見せている箇所だけを対象にする。
      if (!isUrlShaped(link.visible)) continue;

      expect(
        normalizeUrl(link.visible),
        `p${link.page} で、紙面に見えているURLとクリック先が違う。読者は飛び先を目視で確認できない。\n` +
          `  表示テキスト: ${link.visible}\n  実際の飛び先: ${link.uri}`
      ).toBe(normalizeUrl(link.uri));
    }
  });

  test('3) 本文テキストに死んだ旧ドメインが1文字も出てこない（リンクでないベタ書きも含む）', () => {
    const { pages } = load();

    for (const { page, text } of pages) {
      const hit = DEAD_HOST_PATTERN.exec(text);
      expect(
        hit ? `p${page}: ${text.slice(Math.max(0, hit.index - 40), hit.index + 60)}` : null,
        `p${page} の本文に死んだ旧ドメインが書かれている（リンク注釈を持たない表示だけのテキストも配布物では同じ実害）`
      ).toBeNull();
    }
  });
});

/**
 * 公開HTMLへの死んだ旧ドメイン混入ガード。
 *
 * 配布PDFには同種の検査を入れたが（上の「配布PDF」describe）、そちらが見るのはPDF1本だけで、
 * HTML側に同じ旧ドメインが混入しても何も言わない状態だった。実際に3ヶ月配布され続けた
 * motoki418.github.io/portfolio（404）と ai-advisory-hokkaido.pages.dev（DNSごと消滅）は、
 * どちらもドメイン移行時にHTMLだけを対象に置換した結果PDFに取り残されたもので、
 * 逆向き（HTMLに混入する）も同じ確率で起こる。
 */
test.describe('公開HTML — 死んだ旧ドメインの混入ガード', () => {
  // 公開対象のHTML。scripts/build-cloudflare-pages.sh が dist へコピーするもののうち HTML だけ。
  // 公開物が増えたときにこの配列を更新し忘れると検査範囲が黙って狭まるため、下の本数検査で固定する。
  const PUBLIC_HTML = [
    'index.html',
    'privacy.html',
    'about/index.html',
    'training/index.html',
    'services/ai-workflow-automation/index.html',
    'downloads/ai-readiness-checklist.html',
    'samples/bonesetter/index.html',
    'samples/clinic/index.html',
    'samples/restaurant/index.html',
  ];

  /**
   * 死んだ・使ってはいけないホスト。
   *
   * github\.io と github\.com を取り違えないこと。JSON-LD の sameAs にある
   * https://github.com/motoki418 は本人アカウントで正常な値であり、
   * 2026-07-25 の監査で実際に誤検知しかけている。
   * ここを広げるときは「github」で雑に引っ掛けず、ホスト単位で足す。
   */
  const DEAD_HOSTS = [
    { pattern: /motoki418\.github\.io/i, why: '旧ポートフォリオ。2026-07 時点で404' },
    { pattern: /\bai-advisory-hokkaido\.pages\.dev/i, why: '旧Cloudflare Pages。DNSごと消滅（NXDOMAIN）' },
    { pattern: /\bwww\.katachi-ai\.com/i, why: '正規URLは www なし' },
    { pattern: /katachi-ai\.jp/i, why: 'ブランド保護用。301先であってコンテンツを置く先ではない' },
  ];

  test('公開HTMLの列挙が実態と一致する（増えたページが検査から漏れるのを防ぐ）', () => {
    const root = process.cwd();
    for (const file of PUBLIC_HTML) {
      expect(existsSync(resolve(root, file)), `${file} が存在しない。列挙が実態とずれている`).toBe(true);
    }
    const distHtml = [
      'index.html',
      'privacy.html',
      ...['about', 'training'].map((d) => `${d}/index.html`),
      'services/ai-workflow-automation/index.html',
      'downloads/ai-readiness-checklist.html',
      ...['bonesetter', 'clinic', 'restaurant'].map((d) => `samples/${d}/index.html`),
    ];
    expect([...PUBLIC_HTML].sort(), '公開HTMLの列挙が実態と食い違う').toEqual(distHtml.sort());
  });

  for (const file of PUBLIC_HTML) {
    test(`${file} に死んだ旧ドメインが無い`, () => {
      const content = readFileSync(resolve(process.cwd(), file), 'utf-8');
      // 抽出器の生死を先に確認する。空ファイルを読んでいると以下の検査は素通りする。
      expect(content.length, `${file} が空。読み取りに失敗している`).toBeGreaterThan(500);

      for (const { pattern, why } of DEAD_HOSTS) {
        const hit = content.match(pattern);
        expect(
          hit,
          `${file} に使ってはいけないホストがある: ${hit?.[0]}（${why}）\n` +
            '正規URLは https://katachi-ai.com/ 。移行漏れの可能性が高い。'
        ).toBeNull();
      }
    });
  }

  test('本人のGitHubアカウント(github.com/motoki418)を誤検知しない', () => {
    // github.io を弾く正規表現が github.com まで巻き込むと、正常な sameAs を消す方向の
    // 「修正」を誘発する。実在する正常値で、検査が誤検知しないことを固定する。
    const content = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(content, 'sameAs から本人のGitHubが消えている').toContain('https://github.com/motoki418');
    for (const { pattern } of DEAD_HOSTS) {
      expect(
        'https://github.com/motoki418'.match(pattern),
        `正常な本人アカウントが ${pattern} に誤検知されている`
      ).toBeNull();
    }
  });
});
