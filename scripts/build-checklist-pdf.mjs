#!/usr/bin/env node
/**
 * downloads/ai-readiness-checklist.html から配布用PDFを生成する。
 *
 * 経緯: PDFは2026-04-28に手動のChrome印刷で作られたきり更新されておらず、HTML側だけが
 * 改訂され続けた結果、公開PDFに旧表記（30分無料相談）と死んだ旧URL（motoki418.github.io/
 * portfolio、現在404）が残っていた。手動印刷に戻すと同じドリフトが再発するため、
 * HTMLを唯一の正としてスクリプトから再生成する。
 *
 * 生成と同時に、次の2つを記録ファイル（manifest）へ書き出す。tests/e2e.spec.ts が突き合わせる。
 *   sourceSha256   … 生成元HTMLの内容ハッシュ。「HTMLだけ編集してPDFを取り残した」を捕まえる。
 *   pdfFingerprint … 生成したPDFから読み取れた本文とリンクの指紋。HTMLハッシュだけでは
 *                    「スクリプトを通さず手動印刷でPDFを差し替えた」「記録だけ更新してPDFを
 *                    入れ忘れた」が素通りするため、PDF実体の側からも縛る。
 *
 * 記録ファイルを downloads/ でなく scripts/ に置く理由: scripts/build-cloudflare-pages.sh は
 * downloads ディレクトリを丸ごと dist/ へコピーするため、downloads/ に置くとビルド内部の
 * 記録が公開物として配信される。ビルドスクリプト側に除外グロブを足す案は採らない —
 * 記録ファイルを改名した瞬間に除外が静かに外れ、何も落ちないまま公開物が増えるため。
 *
 * 使い方: node scripts/build-checklist-pdf.mjs
 * 前提（ローカル専用。どちらも欠けると manifest を更新せずに落ちる）:
 *   - devDependencies の @playwright/test（chromium）がインストール済みであること
 *   - python3 と PyMuPDF が使えること（`python3 -c "import fitz"` が通る。無ければ
 *     `python3 -m pip install pymupdf`）。manifest を書く直前に読み取りの正しさを裏取りするため。
 *     どうしても用意できない環境では `--skip-verify` を明示する（裏取りを放棄するので常用しない）。
 *
 * ■ 実行の場所について
 * PDFの生成（このスクリプト）はローカル専用で、CIからは呼ばれない。CI側は生成済みのPDFと
 * manifest を読んで照合するだけで、PDF生成のための Chromium 起動は要求しない
 * （tests/e2e.spec.ts が import するのは node:zlib だけで動く inspect-checklist-pdf.mjs のみ）。
 * 読み取り側を変更したときの手順は scripts/inspect-checklist-pdf.mjs の冒頭を参照。
 */
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { inspectPdf, fingerprintOf } from './inspect-checklist-pdf.mjs';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'downloads', 'ai-readiness-checklist.html');
const output = path.join(root, 'downloads', 'ai-readiness-checklist.pdf');
const manifestPath = path.join(root, 'scripts', 'checklist-pdf.manifest.json');
const verifyScript = path.join(root, 'scripts', 'verify-pdf-inspector.mjs');

/**
 * manifest を書く直前に、読み取り側（inspect-checklist-pdf.mjs）が正しいことを PyMuPDF で裏取りする。
 *
 * なぜ書き込みの直前にゲートを置くか: 指紋は読み取り結果から作るため、抽出器が微細に劣化した
 * （1グリフ化ける・1文字落ちる等）状態のまま再生成すると、壊れた結果が manifest に焼き込まれて
 * テストが緑に戻ってしまう。床やマーカー検査は粗い破壊しか捕まえられないので、これが最後の穴だった。
 * 「手順書に verify を先に実行と書く」だけでは実行を強制できないため、記録を上書きする瞬間だけを
 * 仕組みで塞ぐ。生成はローカル専用（Chromium必須）なので、この依存追加はCIには波及しない。
 */
function verifyExtractionOrExit() {
  if (process.argv.includes('--skip-verify')) {
    console.warn('');
    console.warn('!!! 警告: --skip-verify が指定されたため、PDF読み取りの正しさを裏取りせずに記録します。');
    console.warn('!!! 抽出器が壊れていても、その壊れた結果が manifest に焼き込まれて検査が緑になります。');
    console.warn('!!! PyMuPDF が使える環境で、フラグ無しでの再生成をやり直してください。');
    console.warn('');
    return;
  }

  const result = spawnSync(process.execPath, [verifyScript, output], { encoding: 'utf-8' });
  if (result.status === 0) {
    console.log('verified: PDF読み取りは PyMuPDF と一致（manifest を更新します）');
    return;
  }

  console.error(result.stdout || '');
  console.error(result.stderr || '');
  if (result.status === 2) {
    throw new Error(
      'PyMuPDF が使えないため、PDF読み取りの正しさを裏取りできませんでした。manifest は更新していません。\n' +
        '  対処1（推奨）: python3 -m pip install pymupdf を入れてから再実行する\n' +
        '  対処2: どうしても裏取りできない環境なら node scripts/build-checklist-pdf.mjs --skip-verify\n' +
        '        （検査の裏取りを放棄することになるので、常用しないこと）'
    );
  }
  throw new Error(
    'PDF読み取り（scripts/inspect-checklist-pdf.mjs）が PyMuPDF と一致しませんでした。manifest は更新していません。\n' +
      '壊れた読み取り結果を指紋として焼き込むと検査が無効化されるため、ここで止めています。\n' +
      '上の NG 行を見て読み取り側を直してから、再度このスクリプトを実行してください。'
  );
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // 計測タグを生成時に実行させない。HTMLは file:// で実ロードされるため、素通しすると
  // PDFを再生成するたび page_location が file:///… の page_view がGA4へ飛び、
  // まさに計測したい配布ページのレポートを汚す。表示にもPDFにも影響しないので落とす。
  await page.route('**://*.googletagmanager.com/**', (route) => route.abort());
  await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: output,
    // HTML側の @page { size: A4; margin: 16mm } をそのまま使う（印刷レイアウトの正本はCSS）
    preferCSSPageSize: true,
    printBackground: true,
  });
  // ハッシュはHTMLの生バイトから取る。CSS や @page の変更も印刷結果を変えるため、
  // 本文テキストだけを見る正規化ハッシュにすると素通りする種類のドリフトが残る。
  const sourceSha256 = createHash('sha256').update(readFileSync(source)).digest('hex');
  // 指紋は「今まさに書き出したPDF」を読み直して取る。生成物そのものを縛るのが目的なので、
  // メモリ上の中間結果ではなくディスク上の実体から計算する。
  const pdfFingerprint = fingerprintOf(inspectPdf(readFileSync(output)));

  // 記録を上書きする前に、読み取りが正しいことを裏取りする（失敗時はここで例外＝manifest は書かれない）
  verifyExtractionOrExit();
  writeFileSync(manifestPath, `${JSON.stringify({ sourceSha256, pdfFingerprint }, null, 2)}\n`);

  console.log(`generated: ${path.relative(root, output)}`);
  console.log(`source sha256:  ${sourceSha256}`);
  console.log(`pdf fingerprint: ${pdfFingerprint}`);
} finally {
  await browser.close();
}
