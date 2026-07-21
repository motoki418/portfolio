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

check(
  "/ の最終URLが正規トップ(<base>/)と一致",
  res.url === `${base}/`,
  `res.url=${res.url}`,
);

const canonicalMatch = body.match(
  /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i,
);
check(
  "/ の canonical が最終URLと一致",
  !!canonicalMatch && canonicalMatch[1] === res.url,
  canonicalMatch
    ? `canonical=${canonicalMatch[1]} res.url=${res.url}`
    : "canonical タグが見つからない",
);

// sitemap.xml: 全 <loc> が redirect を挟まず 200 を返すことを確認する。
const sitemapRes = await fetch(`${base}/sitemap.xml`, {
  headers: { "user-agent": "katachi-smoke" },
  redirect: "follow",
});
const sitemapBody = await sitemapRes.text();
check("sitemap.xml が 200", sitemapRes.status === 200, `status=${sitemapRes.status}`);
const locs = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check("sitemap.xml に <loc> が1件以上ある", locs.length > 0, `body=${sitemapBody.slice(0, 200)}`);
for (const loc of locs) {
  const locRes = await fetch(loc, {
    headers: { "user-agent": "katachi-smoke" },
    redirect: "follow",
  });
  check(
    `sitemap: ${loc} が200かつ無リダイレクト`,
    locRes.status === 200 && locRes.url === loc,
    `status=${locRes.status} res.url=${locRes.url}`,
  );
}

// robots.txt が Sitemap 行を含むこと。
const robotsRes = await fetch(`${base}/robots.txt`, {
  headers: { "user-agent": "katachi-smoke" },
  redirect: "follow",
});
const robotsBody = await robotsRes.text();
check("robots.txt が 200", robotsRes.status === 200, `status=${robotsRes.status}`);
check(
  "robots.txt に Sitemap: 行がある",
  /^Sitemap:/m.test(robotsBody),
  "Sitemap: 行が見つからない",
);

// 存在しないパスが 404 を返し、soft-redirect（200でトップと同一内容を返す誤設定）でないこと。
const notFoundRes = await fetch(`${base}/__not-exist-smoke__`, {
  headers: { "user-agent": "katachi-smoke" },
  redirect: "follow",
});
const notFoundBody = await notFoundRes.text();
check(
  "存在しないパスが404を返す",
  notFoundRes.status === 404,
  `status=${notFoundRes.status}`,
);
check(
  "404ページがトップと同一内容でない（soft redirect検出）",
  notFoundBody !== body,
  "404の本文がトップページと同一（soft 404/soft redirectの疑い）",
);

console.log(`smoke: ${base}`);
if (failures.length) {
  console.error("FAILURES:");
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log("smoke: ALL PASS");
