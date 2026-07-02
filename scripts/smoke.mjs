#!/usr/bin/env node
/* global console, process, fetch */
// 本番（または任意 URL）への読み取り専用スモーク。
// 「対象が壊れたら必ず落ちる観測量」を assert する（200 の数だけ数えない）。
// 使い方: node scripts/smoke.mjs [BASE_URL]（省略時 SMOKE_BASE_URL）

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL;
if (!BASE) {
  console.error("BASE_URL または SMOKE_BASE_URL を指定してください。");
  process.exit(1);
}
const base = BASE.replace(/\/$/, "");
const failures = [];

function check(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else failures.push(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

const res = await fetch(`${base}/`, {
  headers: { "user-agent": "katachi-smoke" },
  redirect: "follow",
});
const body = await res.text();

check("/ が 200", res.status === 200, `status=${res.status}`);
check(
  "/ に LP のタイトル（AI導入・AI活用支援）がある",
  /AI導入・AI活用支援/.test(body),
  "タイトル欠落（別ページ/壊れた配信の疑い）",
);
check(
  "/ に CTA 導線（お問い合わせ/相談）がある",
  /(お問い合わせ|相談)/.test(body),
  "CTA が見つからない（コンバージョン導線の欠落）",
);

console.log(`smoke: ${base}`);
if (failures.length) {
  console.error("FAILURES:");
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log("smoke: ALL PASS");
