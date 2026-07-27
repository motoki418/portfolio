#!/usr/bin/env node
/**
 * scripts/inspect-checklist-pdf.mjs（依存ゼロのPDF読み取り）の出力を、実績あるPDFライブラリ
 * （PyMuPDF）の読み取り結果と突き合わせて検証する開発用スクリプト。
 *
 * なぜ要るか: tests/e2e.spec.ts の配布PDF検査は自前パーサの上に乗っている。パーサが静かに壊れて
 * 空を返すと、検査は「見るものが無いので緑」になり、緑と未実行が区別できなくなる。テスト側には
 * カナリア（既知の文字列が読めること）を置いてあるが、抽出結果そのものの正しさは別途裏を取る。
 *
 * これは**ローカル専用**。PyMuPDF が要るため CI では走らせない（CIで走る検査を外部ライブラリに
 * 依存させないことが inspect-checklist-pdf.mjs を自前実装した理由そのもの）。
 *
 * 使い方: node scripts/verify-pdf-inspector.mjs [pdfパス]
 * 前提:   python3 -c "import fitz"  が通ること（PyMuPDF）
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { inspectPdf, rawUris } from './inspect-checklist-pdf.mjs';

const target = process.argv[2] || 'downloads/ai-readiness-checklist.pdf';

const GROUND_TRUTH = `
import fitz, json, sys
d = fitz.open(sys.argv[1])
links = []
for i in range(d.page_count):
    p = d[i]
    for l in p.get_links():
        if l.get("uri"):
            links.append({"page": i + 1, "uri": l["uri"], "visible": p.get_textbox(l["from"]).strip()})
print(json.dumps({
    "pageCount": d.page_count,
    "links": links,
    "pages": [{"page": i + 1, "text": d[i].get_text()} for i in range(d.page_count)],
}, ensure_ascii=False))
`;

let truth;
try {
  truth = JSON.parse(execFileSync('python3', ['-c', GROUND_TRUTH, target], { encoding: 'utf-8' }));
} catch (e) {
  console.error('PyMuPDF で正解データを取得できなかった（このスクリプトはローカル専用）:', e.message);
  process.exit(2);
}

const buf = readFileSync(target);
const mine = inspectPdf(buf);
const failures = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'OK  ' : 'NG  '} ${label}`);
  if (!ok) failures.push(`${label}\n  自前: ${JSON.stringify(actual)}\n  正解: ${JSON.stringify(expected)}`);
};

check('ページ数', mine.pageCount, truth.pageCount);
check(
  'リンク注釈のURI一覧',
  mine.links.map((l) => `p${l.page} ${l.uri}`),
  truth.links.map((l) => `p${l.page} ${l.uri}`)
);
check(
  'リンク注釈の矩形内テキスト',
  mine.links.map((l) => l.visible.replace(/\s+/g, '')),
  truth.links.map((l) => l.visible.replace(/\s+/g, ''))
);
check('生バイト列から見えるURI', rawUris(buf).sort(), truth.links.map((l) => l.uri).sort());

// 本文テキストは「並び順の完全一致」では比較しない。PyMuPDF はコンテンツストリームの
// ブロック順で返し、こちらは座標（y降順→x昇順）で組み直すため、段組みのある面では
// ブロックの出現順が正当に食い違う。またフォントの ToUnicode が中黒を U+2027 に
// 写像しており、PyMuPDF はグリフ名から U+30FB へ補正する。どちらも検査対象（ASCIIのドメイン）に
// 影響しない差なので、テストが実際に依存している次の2点だけを検証する。
const normalize = (s) => s.replace(/\s+/g, '').replace(/‧/g, '・');

// (1) 文字が1つも欠けていないこと。欠落すると検査3が「見えないので緑」になる。
for (const page of truth.pages) {
  const ours = mine.pages.find((p) => p.page === page.page);
  const bag = (s) => [...normalize(s)].sort().join('');
  check(`p${page.page} の本文（文字の集合・欠落なし）`, bag(ours ? ours.text : ''), bag(page.text));
}

// (2) URLらしき連続文字列が分断されずに繋がっていること。分断されると検査3の正規表現が当たらない。
const urlTokens = [
  ...new Set(
    truth.pages
      .flatMap((p) => p.text.match(/(?:https?:\/\/)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/\S*)?/g) || [])
      .map((t) => t.trim())
      .filter((t) => t.length > 8)
  ),
];
check(
  `URL連続文字列がそのまま読めること (${urlTokens.length}件)`,
  urlTokens.filter((t) => normalize(mine.text).includes(normalize(t))).sort(),
  urlTokens.sort()
);

if (failures.length > 0) {
  console.error(`\n${failures.length} 件不一致:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('\n全一致: 依存ゼロの読み取りは PyMuPDF と同じ結果を返している');
