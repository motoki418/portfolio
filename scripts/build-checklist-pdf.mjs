#!/usr/bin/env node
/**
 * downloads/ai-readiness-checklist.html から配布用PDFを生成する。
 *
 * 経緯: PDFは2026-04-28に手動のChrome印刷で作られたきり更新されておらず、HTML側だけが
 * 改訂され続けた結果、公開PDFに旧表記（30分無料相談）と死んだ旧URL（motoki418.github.io/
 * portfolio、現在404）が残っていた。手動印刷に戻すと同じドリフトが再発するため、
 * HTMLを唯一の正としてスクリプトから再生成する。
 *
 * 使い方: node scripts/build-checklist-pdf.mjs
 * 前提: devDependencies の @playwright/test（chromium）がインストール済みであること。
 */
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'downloads', 'ai-readiness-checklist.html');
const output = path.join(root, 'downloads', 'ai-readiness-checklist.pdf');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: output,
    // HTML側の @page { size: A4; margin: 16mm } をそのまま使う（印刷レイアウトの正本はCSS）
    preferCSSPageSize: true,
    printBackground: true,
  });
  console.log(`generated: ${path.relative(root, output)}`);
} finally {
  await browser.close();
}
