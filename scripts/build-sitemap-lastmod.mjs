#!/usr/bin/env node
/**
 * sitemap.xml の <lastmod> を、生成元HTMLの内容が変わったURLだけ今日の日付へ更新し、
 * 内容ハッシュを記録ファイル（scripts/sitemap-lastmod.manifest.json）へ書き出す。
 *
 * 使い方: node scripts/build-sitemap-lastmod.mjs
 *   HTML を編集したら実行し、sitemap.xml と manifest の両方をコミットする。
 *   実行を忘れると tests/e2e.spec.ts が落ちる（それが検査の目的）。
 *
 * 依存なし（Node 標準ライブラリのみ）。CI は生成せず照合するだけなので、CI へは波及しない。
 *
 * 設計メモ:
 *  - 日付は「このスクリプトを走らせた日」を書く。HTML の実際の編集日とは最大で数日ずれるが、
 *    <lastmod> はクロール予定を組むためのヒントであって監査記録ではないため、
 *    「実態より古い」を消すことのほうが重要と判断した。
 *  - 「日付だけ据え置いてハッシュを記録し直す」抜け道（--keep-dates 相当）は意図的に用意しない。
 *    それを許すと、内容を変えたのに lastmod を古いまま緑にできてしまい、検査の意味が消える。
 *  - 内容が変わっていない URL の lastmod は触らない。無関係なURLの日付まで毎回今日に
 *    書き換えると、Google に対して嘘の更新申告を繰り返すことになる。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { SITEMAP_SOURCES, parseSitemap, hashOf, DATE_PATTERN } from './inspect-sitemap.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sitemapPath = path.join(root, 'sitemap.xml');
const manifestPath = path.join(root, 'scripts', 'sitemap-lastmod.manifest.json');

/**
 * UTC の YYYY-MM-DD。
 *
 * ローカル日付にしてはいけない。tests/e2e.spec.ts の未来日チェックは toISOString()＝UTC 基準で
 * 上限を取るため、ローカル日付で書くと日本時間 00:00〜08:59（UTC はまだ前日）に生成した瞬間、
 * 中身は正しいのに「未来日」で CI が赤くなる。しかも 09:00 JST を過ぎると勝手に緑へ戻るため、
 * 原因が分からないまま「検査を緩める」方向の対処を次の人に誘発する。書く側と見る側で
 * 時刻の基準を揃えることでしか塞げない。
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * git が知っている、そのファイルの最終変更日（YYYY-MM-DD）。
 *
 * 初回作成（--init）のときだけ使う。記録が無い状態では全URLが「変更あり」と判定されるため、
 * 実行日で一律に刻印すると、実際には数日前に変わったページまで同じ日付で並ぶ。5URLが同一日付で
 * 並ぶのは機械的な一括スタンプに見え、Google が lastmod を信用する条件（実際の更新と突き合わせて
 * 検証できること）から遠ざかる。git のコミット日は内容が変わった日そのものなので、
 * 「内容を変えたのに古い日付を維持する」用途には使えない＝洗浄経路にはならない。
 *
 * 生成はローカル専用でCIからは呼ばれないため、CI の浅いチェックアウトには影響しない。
 * 履歴が取れない環境では実行日へ素直に落とす。
 */
function gitLastModified(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      cwd: root,
      encoding: 'utf-8',
    }).trim();
    return DATE_PATTERN.test(out) && out <= today() ? out : null;
  } catch {
    return null;
  }
}

function fail(...lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

const xml = readFileSync(sitemapPath, 'utf-8');
const entries = parseSitemap(xml);

// 対応表と sitemap の URL 集合がずれたまま走ると、書き漏れたURLが黙って検査対象から外れる。
const inSitemap = [...entries.map((e) => e.loc)].sort();
const inSources = [...SITEMAP_SOURCES.map((s) => s.loc)].sort();
if (JSON.stringify(inSitemap) !== JSON.stringify(inSources)) {
  fail(
    'sitemap.xml のURL集合と scripts/inspect-sitemap.mjs の対応表が一致しない。',
    `  sitemap.xml : ${JSON.stringify(inSitemap, null, 2)}`,
    `  対応表      : ${JSON.stringify(inSources, null, 2)}`,
    'URLを増減したら SITEMAP_SOURCES も更新すること。'
  );
}

/**
 * 記録ファイルが読めないときに黙って「初回」へ倒さない。
 *
 * 倒すと previous が空になって全URLが「変更あり」判定になり、HTML を1文字も変えていないのに
 * 全部が今日の日付へ書き換わる。これはこのスクリプト自身が上の設計メモで禁じている
 * 「無関係なURLの日付まで今日に書き換えて Google に嘘の更新申告をする」そのものであり、
 * 同時に `rm manifest && node build` の2手であらゆるドリフトの赤を消せる洗浄経路にもなる。
 * 本当に新規作成したいときだけ --init を明示させる。
 */
let previous = null;
try {
  previous = JSON.parse(readFileSync(manifestPath, 'utf-8')).urls ?? null;
} catch {
  /* 下で判定する */
}

const isInit = previous === null;
if (isInit) {
  if (!process.argv.includes('--init')) {
    fail(
      '記録ファイルが読めない（scripts/sitemap-lastmod.manifest.json）。',
      'この状態で再生成すると、内容が変わっていないURLまで今日の日付でスタンプし、',
      'Google に嘘の更新申告をすることになる。まず git から記録ファイルを復元すること。',
      '本当に新規作成する場合のみ --init を付ける。'
    );
  }
  previous = {};
  console.log('--init: 記録ファイルを新規作成する。日付は git の最終変更日から起こす。');
}

const stamp = today();
const manifestUrls = {};
const changed = [];

for (const { loc, file } of SITEMAP_SOURCES) {
  const sha256 = hashOf(readFileSync(path.join(root, file)));
  const before = previous[loc];
  const current = entries.find((e) => e.loc === loc);

  if (!current.lastmod || !DATE_PATTERN.test(current.lastmod)) {
    fail(`${loc} の <lastmod> が YYYY-MM-DD 形式でない: ${current.lastmod}`);
  }

  const isChanged = !before || before.sha256 !== sha256;
  // 初回だけは git の最終変更日を使う。実行日で5URLを一律に刻印すると、実際の更新日と
  // 数日ずれた同一日付が並び、Google が lastmod を信用する条件から遠ざかるため。
  const lastmod = isChanged ? (isInit ? (gitLastModified(file) ?? stamp) : stamp) : before.lastmod;
  if (isChanged) changed.push({ loc, from: current.lastmod, to: lastmod });

  manifestUrls[loc] = { file, sha256, lastmod };
}

// <url> ブロック単位で書き換える。URL文字列を正規表現へ埋め込むと、記号のエスケープを
// 1つ間違えただけで「1件も置換できないまま静かに成功する」ため、埋め込み自体をやめている。
const updatedXml = xml.replace(/<url>[\s\S]*?<\/url>/g, (block) => {
  const loc = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
  const target = manifestUrls[loc];
  if (!target) return block;
  return block.replace(/(<lastmod>)[^<]*(<\/lastmod>)/, `$1${target.lastmod}$2`);
});

writeFileSync(sitemapPath, updatedXml);
writeFileSync(manifestPath, `${JSON.stringify({ urls: manifestUrls }, null, 2)}\n`);

// 書いた結果を読み直して、意図した日付が本当に入ったかを確認する。
// String.replace は1件も置換できなくても例外を投げないため、書きっぱなしにすると
// 記録側だけ更新されて sitemap が据え置かれた状態で緑になる（＝洗浄経路）。
const verify = parseSitemap(readFileSync(sitemapPath, 'utf-8'));
for (const [loc, { lastmod }] of Object.entries(manifestUrls)) {
  const actual = verify.find((e) => e.loc === loc)?.lastmod;
  if (actual !== lastmod) {
    fail(
      `書き込み後の検証に失敗: ${loc} の lastmod が ${actual}（期待 ${lastmod}）。`,
      'sitemap.xml の書式が想定と違う可能性がある。手で直さず、置換処理を修正すること。'
    );
  }
}

if (changed.length === 0) {
  console.log('生成元HTMLに変更なし。lastmod は据え置き。');
} else {
  console.log(`lastmod を更新した ${changed.length} 件:`);
  for (const c of changed) console.log(`  ${c.loc}\n    ${c.from} -> ${c.to}`);
}
console.log('sitemap.xml と scripts/sitemap-lastmod.manifest.json の両方をコミットすること。');
