#!/usr/bin/env node
/**
 * sitemap.xml の読み取り側。tests/e2e.spec.ts と scripts/build-sitemap-lastmod.mjs の両方が使う。
 *
 * 経緯: 2026-07-28 に Search Console を実測したところ、sitemap 掲載5URLのうちインデックス
 * 登録済みはトップの1件だけで、残り4件は「検出 - インデックス未登録（前回のクロール: 該当なし）」
 * だった。調査中に、sitemap.xml の <lastmod> が全5URLで実際の更新日より最大18日古いことが
 * 判明した（例: index.html は 2026-07-27 に更新されているのに lastmod は 2026-07-09）。
 * <lastmod> は Google がクロール予定を組むときのヒントであり、古いまま放置すると
 * 「この URL は変わっていない」と申告し続けることになる。
 *
 * 日付は手で書く限り必ず腐る（PDF が3ヶ月腐ったのと同じ構造）ため、HTML の内容ハッシュを
 * 記録ファイル（manifest）に残し、「HTML を変えたのに lastmod を更新していない」状態を
 * テストで落とす。日付そのものの正しさは検証しようがないので、代わりに
 * 「内容が変わったことに気づかず放置する」経路を塞ぐ。
 *
 * 記録ファイルを scripts/ に置く理由は配布PDFの manifest と同じ。
 * scripts/build-cloudflare-pages.sh は公開対象ディレクトリを dist/ へコピーするため、
 * 公開対象の中に置くとビルド内部の記録が配信物として出ていってしまう。
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/**
 * sitemap.xml の <loc> と、その URL を実際に配信している生成元HTMLの対応表。
 *
 * ここが sitemap の URL 集合とずれると検査範囲が黙って狭まる（URL を1つ足したのに
 * 対応表に書き忘れると、その URL だけ永久に検査されない）。ずれたら落ちるように
 * tests/e2e.spec.ts 側で両者の集合一致を固定している。
 *
 * 拡張子なしURLと実ファイル名が違う点に注意: /downloads/ai-readiness-checklist は
 * downloads/ai-readiness-checklist.html が配信元（Cloudflare Workers の static assets が
 * .html を落とした正規URLへ301する）。
 */
export const SITEMAP_SOURCES = [
  { loc: 'https://katachi-ai.com/', file: 'index.html' },
  { loc: 'https://katachi-ai.com/downloads/ai-readiness-checklist', file: 'downloads/ai-readiness-checklist.html' },
  { loc: 'https://katachi-ai.com/training/', file: 'training/index.html' },
  { loc: 'https://katachi-ai.com/services/ai-workflow-automation/', file: 'services/ai-workflow-automation/index.html' },
  { loc: 'https://katachi-ai.com/about/', file: 'about/index.html' },
];

/**
 * sitemap.xml から <url> ブロックを取り出す。
 *
 * 意図的に「1件も取れなかったら例外」にしている。抽出が0件のまま返すと、呼び出し側の
 * for ループや every() が空集合に対して真を返し、検査が素通りする（＝空振りの緑）。
 * 配布PDF検査のレビューで実際に3経路の空振りが見つかっているので、入口で殺す。
 */
export function parseSitemap(xml) {
  if (typeof xml !== 'string' || xml.length === 0) {
    throw new Error('sitemap.xml の内容が空。読み取りに失敗している');
  }

  const entries = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1];
    if (!loc) {
      throw new Error(`sitemap.xml に <loc> を持たない <url> ブロックがある:\n${block}`);
    }
    entries.push({ loc, lastmod: lastmod ?? null });
  }

  if (entries.length === 0) {
    throw new Error('sitemap.xml から <url> を1件も抽出できなかった。書式が変わったか、読み取り側が壊れている');
  }
  return entries;
}

/**
 * 実XMLパーサ（python3 の xml.etree）で sitemap.xml を読む。
 *
 * なぜ2通りの読み方を持つか: 上の parseSitemap は生テキストに正規表現を当てているだけで、
 * XML の意味論と一致しない。Google は実XMLパーサで読むため、次の3つを検査が見逃す。
 *   - <url> ブロックを <!-- --> で囲むと、Google からは1URL消えるのに正規表現は拾い続ける
 *   - コメント化した <lastmod> を実物の前に置くと、正規表現は最初の一致＝コメント側を読み、
 *     Google は実物側を読む（6年古い日付を申告しても緑にできる）
 *   - 整形式でない XML（マージ衝突マーカーの残骸など）は Google が sitemap 全体を拒否するが、
 *     正規表現は何事もなく通る
 * どれも「検査は緑なのに Google への申告内容は壊れている」状態を作れる。両者の読みが一致
 * することを要求すれば、この3経路が1つのアサーションで閉じる。
 *
 * python3 を使う理由: playwright.config.ts の webServer が python3 -m http.server なので、
 * ローカルにも CI にも既に必須依存として存在する。新規の npm 依存を増やさずに済む。
 */
export function parseSitemapStrict(xmlPath) {
  const script = `
import sys, json, xml.etree.ElementTree as ET
NS = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
root = ET.parse(sys.argv[1]).getroot()
out = []
for u in root.iter(NS + 'url'):
    loc, lm = u.find(NS + 'loc'), u.find(NS + 'lastmod')
    out.append({'loc': loc.text.strip() if loc is not None and loc.text else None,
                'lastmod': lm.text.strip() if lm is not None and lm.text else None})
print(json.dumps(out))
`;
  let raw;
  try {
    raw = execFileSync('python3', ['-c', script, xmlPath], { encoding: 'utf-8' });
  } catch (e) {
    throw new Error(
      'sitemap.xml が整形式XMLでない。Google はこの状態の sitemap を丸ごと拒否し、' +
        `掲載中の全URLがカバレッジを失う:\n${e.stderr ?? e.message}`
    );
  }
  const entries = JSON.parse(raw);
  if (entries.length === 0) {
    throw new Error('実XMLパーサで <url> を1件も取得できなかった');
  }
  return entries;
}

/** 生成元HTMLの内容ハッシュ。「内容を変えたのに lastmod を据え置いた」を捕まえるための観測量。 */
export function hashOf(buffer) {
  if (buffer.length === 0) {
    throw new Error('ハッシュ対象が空。ファイルの読み取りに失敗している');
  }
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * HTML の自己参照 canonical を取り出す。
 *
 * SITEMAP_SOURCES の loc→file 対応そのものを裏取りするために使う。上の集合一致検査は
 * loc 側しか見ておらず、file 側を取り違えても（例: /about/ に index.html を割り当てる）
 * 検知できない。その状態で manifest を再生成すると、/about/ の lastmod が index.html の
 * 変更に追随する誤った検査が「緑」で固定される（＝洗浄経路）。
 *
 * canonical は各HTMLが自分で名乗っている正規URLであり、対応表とは独立した情報源なので、
 * 両者の一致を要求すれば取り違えを外側から捕まえられる。
 */
export function canonicalOf(html) {
  if (typeof html !== 'string' || html.length === 0) {
    throw new Error('canonical 抽出の対象が空。ファイルの読み取りに失敗している');
  }
  const tag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
  if (!tag) {
    throw new Error('rel="canonical" が見つからない');
  }
  const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
  if (!href) {
    throw new Error(`rel="canonical" に href が無い: ${tag}`);
  }
  return href;
}

/** YYYY-MM-DD。sitemap の <lastmod> はこの書式で統一する（W3C Datetime の日付のみ形式）。 */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
