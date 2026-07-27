#!/usr/bin/env node
/**
 * 配布PDFの中身（リンク注釈・表示テキスト）を読み出す検査用モジュール。
 *
 * 経緯: 旧PDFには「表示テキストとクリック先が別ホスト」という欠陥があった。
 * 表示は https://motoki418.github.io/portfolio/#hero（404）、実際のリンク注釈は
 * https://ai-advisory-hokkaido.pages.dev/#hero（DNSごと消滅）。後者は目視校正では
 * 原理的に見えないため3ヶ月生き残った。さらにフッターの motoki418.github.io/portfolio は
 * リンク注釈を持たないベタテキストで、注釈の列挙だけでは検出できなかった。
 * したがって「注釈のURI」「注釈の矩形内の表示テキスト」「本文テキスト全体」の3つを読む。
 *
 * 依存ゼロ（node:zlib のみ）で実装する理由: 検査は CI(ubuntu-latest)で必ず走らねばならず、
 * PyMuPDF 等を CI で pip install するのは遅く不安定なうえ、失敗時に検査が無言でスキップされる
 * （＝緑と未実行が区別できなくなる）リスクを持ち込む。ローカルの PyMuPDF は
 * scripts/verify-pdf-inspector.mjs で本モジュールの出力を突き合わせる正解データとしてのみ使う。
 *
 * 本ファイルはライブラリに徹する（実行可能なエントリを持たない）。Playwright はテストを CJS へ
 * 変換して読み込むため、import.meta を含めるとテスト側の import が SyntaxError で落ちる。
 * 動作確認・照合の実行口は scripts/verify-pdf-inspector.mjs 側に置く。
 *
 * ■ このファイルを変更したときの手順
 * 読み取り結果は scripts/checklist-pdf.manifest.json の pdfFingerprint に焼き込まれているため、
 * 抽出結果が1文字でも変わるとテストが赤になる。緑に戻す手順:
 *   1. node scripts/build-checklist-pdf.mjs   … 指紋を record し直す
 *   2. npm run test:e2e                       … 緑を確認
 * 1 は manifest を書く直前に PyMuPDF 照合（scripts/verify-pdf-inspector.mjs）を自動で通し、
 * 一致しなければ manifest を書かずに落ちる。つまり「壊れた読み取り結果で指紋を上書きして緑にする」は
 * 仕組みで塞がれており、照合を手で先に流す必要はない（単体で流したいときは
 * node scripts/verify-pdf-inspector.mjs でいつでも確認できる）。
 * PyMuPDF が無い環境では 1 が中止される。`--skip-verify` を明示すれば続行できるが、
 * それは裏取りを放棄して壊れた指紋を焼き込みうるという意味なので、常用しないこと。
 * 指紋不一致は「まず抽出が正しいかを疑え」の合図として扱う。
 */
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

/** PDFの全 "N 0 obj ..." を切り出す。この文書はオブジェクトストリーム(/ObjStm)を使わないため全objが平文で並ぶ。 */
function parseObjects(buf) {
  const src = buf.toString('latin1');
  const headers = [...src.matchAll(/(\d+)\s+\d+\s+obj\b/g)];
  const objects = new Map();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index + headers[i][0].length;
    const end = i + 1 < headers.length ? headers[i + 1].index : src.length;
    objects.set(Number(headers[i][1]), src.slice(start, end));
  }
  return objects;
}

/** オブジェクト本文のうち辞書部分（stream 開始前）だけを返す */
function dictOf(body) {
  const m = /\bstream\r?\n/.exec(body);
  return m ? body.slice(0, m.index) : body;
}

/** オブジェクトの stream を展開する（FlateDecode前提。展開できなければ null） */
function streamOf(body) {
  const m = /\bstream\r?\n/.exec(body);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = body.indexOf('endstream', start);
  if (end < 0) return null;
  const raw = Buffer.from(body.slice(start, end), 'latin1');
  for (const candidate of [raw, raw.subarray(0, raw.length - 1), raw.subarray(0, raw.length - 2)]) {
    try {
      return inflateSync(candidate);
    } catch {
      /* 次の切り詰めを試す（endstream 直前の改行はストリーム本体に含まれない） */
    }
  }
  return null;
}

const refIn = (dict, key) => {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  return m ? Number(m[1]) : null;
};

/** UTF-16BE の16進文字列を JS 文字列にする */
function hexToText(hex) {
  let out = '';
  for (let i = 0; i + 3 < hex.length + 1; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    if (!Number.isNaN(code)) out += String.fromCharCode(code);
  }
  return out;
}

/** ToUnicode CMap を「フォント内コード → Unicode文字列」の対応表にする */
function parseCMap(cmapText) {
  const map = new Map();
  let codeBytes = 1;
  const cs = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(cmapText);
  if (cs) {
    const first = /<([0-9A-Fa-f]+)>/.exec(cs[1]);
    if (first) codeBytes = Math.max(1, first[1].length / 2);
  }

  for (const block of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(pair[1], 16), hexToText(pair[2]));
    }
  }

  for (const block of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    // <lo> <hi> [ <dst> <dst> ... ] と <lo> <hi> <dst> の2形式が混在しうるので順に舐める
    const token = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[([\s\S]*?)\]|<([0-9A-Fa-f]+)>)/g;
    for (const m of block[1].matchAll(token)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (m[4] !== undefined) {
        const items = [...m[4].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => hexToText(x[1]));
        items.forEach((text, i) => map.set(lo + i, text));
      } else {
        const base = m[5];
        for (let code = lo; code <= hi && code - lo < 65536; code++) {
          const shifted = (parseInt(base, 16) + (code - lo)).toString(16).padStart(base.length, '0');
          map.set(code, hexToText(shifted));
        }
      }
    }
  }
  return { map, codeBytes };
}

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];

/** コンテンツストリームを走査し、描画された文字を1つずつ座標つきで取り出す */
function extractGlyphs(content, fonts) {
  const glyphs = [];
  const tokens = content.match(/<[0-9A-Fa-f\s]*>|\((?:\\.|[^\\)])*\)|\[|\]|\/[^\s/[\]<>()]+|[-+.\d]+|[A-Za-z'"*]+/g) || [];

  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let tm = [1, 0, 0, 1, 0, 0];
  let tlm = tm;
  let font = null;
  let size = 0;
  let leading = 0;
  const operands = [];

  const show = (hex) => {
    if (!font) return;
    const clean = hex.replace(/\s+/g, '');
    const step = font.codeBytes * 2;
    for (let i = 0; i + step <= clean.length; i += step) {
      const code = parseInt(clean.slice(i, i + step), 16);
      const text = font.map.get(code);
      if (!text) continue;
      const trm = mul(mul([size, 0, 0, size, 0, 0], tm), ctm);
      glyphs.push({ text, x: trm[4], y: trm[5] });
    }
  };

  for (const tk of tokens) {
    if (/^[-+.\d]/.test(tk)) {
      operands.push(Number(tk));
      continue;
    }
    if (tk.startsWith('/') || tk === '[' || tk === ']') {
      if (tk.startsWith('/')) operands.push(tk);
      continue;
    }
    if (tk.startsWith('<')) {
      operands.push({ hex: tk.slice(1, -1) });
      continue;
    }
    if (tk.startsWith('(')) {
      operands.push({ literal: tk.slice(1, -1) });
      continue;
    }

    const n = (i) => Number(operands[operands.length - i]) || 0;
    switch (tk) {
      case 'q':
        stack.push(ctm);
        break;
      case 'Q':
        ctm = stack.pop() || ctm;
        break;
      case 'cm':
        ctm = mul([n(6), n(5), n(4), n(3), n(2), n(1)], ctm);
        break;
      case 'BT':
        tm = tlm = [1, 0, 0, 1, 0, 0];
        break;
      case 'Tf': {
        size = n(1);
        const name = operands[operands.length - 2];
        font = typeof name === 'string' ? fonts.get(name.slice(1)) || null : null;
        break;
      }
      case 'TL':
        leading = n(1);
        break;
      case 'Tm':
        tm = tlm = [n(6), n(5), n(4), n(3), n(2), n(1)];
        break;
      case 'Td':
        tm = tlm = mul([1, 0, 0, 1, n(2), n(1)], tlm);
        break;
      case 'TD':
        leading = -n(1);
        tm = tlm = mul([1, 0, 0, 1, n(2), n(1)], tlm);
        break;
      case 'T*':
        tm = tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
        break;
      case 'Tj':
      case "'":
      case '"': {
        const last = operands[operands.length - 1];
        if (last && last.hex !== undefined) show(last.hex);
        break;
      }
      case 'TJ': {
        for (const item of operands) if (item && item.hex !== undefined) show(item.hex);
        break;
      }
      default:
        break;
    }
    operands.length = 0;
  }
  return glyphs;
}

/** 同じ行の文字を x 昇順で連結し、読み順のテキストにする */
function glyphsToText(glyphs, lineTolerance = 3) {
  const lines = [];
  for (const g of [...glyphs].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((l) => Math.abs(l.y - g.y) <= lineTolerance);
    if (line) line.items.push(g);
    else lines.push({ y: g.y, items: [g] });
  }
  return lines
    .map((l) =>
      l.items
        .sort((a, b) => a.x - b.x)
        .map((g) => g.text)
        .join('')
    )
    .join('\n');
}

/** 配布PDFのリンク注釈と表示テキストを読み出す */
export function inspectPdf(buf) {
  const objects = parseObjects(buf);

  // ページを Kids の並び順に取る（/Type /Page を走査順に拾うと文書順と一致しないことがある）
  let pageIds = [];
  for (const [, body] of objects) {
    const dict = dictOf(body);
    if (/\/Type\s*\/Pages\b/.test(dict) && /\/Kids/.test(dict)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(dict);
      if (kids) pageIds = [...kids[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));
    }
  }
  if (pageIds.length === 0) {
    pageIds = [...objects.entries()]
      .filter(([, body]) => /\/Type\s*\/Page\b/.test(dictOf(body)))
      .map(([id]) => id);
  }

  const pages = [];
  const links = [];

  for (const [index, pageId] of pageIds.entries()) {
    const pageDict = dictOf(objects.get(pageId) || '');
    const pageNo = index + 1;

    // フォント表（/Resources は直書きと間接参照の両方がありうる）
    const resId = refIn(pageDict, 'Resources');
    const resDict = resId != null ? dictOf(objects.get(resId) || '') : pageDict;
    const fonts = new Map();
    const fontBlock = /\/Font\s*<<([\s\S]*?)>>/.exec(resDict);
    if (fontBlock) {
      for (const m of fontBlock[1].matchAll(/\/([^\s/]+)\s+(\d+)\s+\d+\s+R/g)) {
        const fontDict = dictOf(objects.get(Number(m[2])) || '');
        const toUnicodeId = refIn(fontDict, 'ToUnicode');
        if (toUnicodeId == null) continue;
        const cmap = streamOf(objects.get(toUnicodeId) || '');
        if (cmap) fonts.set(m[1], parseCMap(cmap.toString('latin1')));
      }
    }

    // 本文（/Contents は単一参照と配列の両方がありうる）
    const contentIds = [];
    const single = refIn(pageDict, 'Contents');
    if (single != null) contentIds.push(single);
    const arr = /\/Contents\s*\[([^\]]*)\]/.exec(pageDict);
    if (arr) for (const m of arr[1].matchAll(/(\d+)\s+\d+\s+R/g)) contentIds.push(Number(m[1]));

    let glyphs = [];
    for (const cid of contentIds) {
      const content = streamOf(objects.get(cid) || '');
      if (content) glyphs = glyphs.concat(extractGlyphs(content.toString('latin1'), fonts));
    }
    pages.push({ page: pageNo, text: glyphsToText(glyphs) });

    // リンク注釈
    const annots = /\/Annots\s*\[([^\]]*)\]/.exec(pageDict);
    if (!annots) continue;
    for (const m of annots[1].matchAll(/(\d+)\s+\d+\s+R/g)) {
      const annotDict = dictOf(objects.get(Number(m[1])) || '');
      const uri = /\/URI\s*\((.*?)\)\s*(?:\/|>>)/s.exec(annotDict);
      if (!uri) continue;
      const rectMatch = /\/Rect\s*\[([^\]]*)\]/.exec(annotDict);
      const rect = rectMatch ? rectMatch[1].trim().split(/\s+/).map(Number) : null;
      let visible = '';
      if (rect) {
        const [x0, y0, x1, y1] = [
          Math.min(rect[0], rect[2]),
          Math.min(rect[1], rect[3]),
          Math.max(rect[0], rect[2]),
          Math.max(rect[1], rect[3]),
        ];
        // 文字の原点が矩形内に入るものを表示テキストとみなす（下端は原点がわずかに外へ出るため緩める）
        visible = glyphsToText(
          glyphs.filter((g) => g.x >= x0 - 1 && g.x <= x1 + 1 && g.y >= y0 - 3 && g.y <= y1 + 3)
        );
      }
      links.push({ page: pageNo, uri: uri[1], rect, visible });
    }
  }

  return { pageCount: pageIds.length, pages, links, text: pages.map((p) => p.text).join('\n') };
}

/** 生バイト列から /URI を直接拾う保険。注釈の構造解析が壊れても URI の見落としだけは起こさない。 */
export function rawUris(buf) {
  return [...buf.toString('latin1').matchAll(/\/URI\s*\((.*?)\)\s*(?:\/|>>)/gs)].map((m) => m[1]);
}

/**
 * 外部リンク注釈の個数を、URIの値を読む正規表現とは別のトークン（/S /URI）から数える。
 *
 * なぜ別経路が要るか: rawUris() と inspectPdf() は同じ `/URI (…)` 正規表現に依存しているため、
 * URIの書かれ方が想定外（hex文字列・エスケープ入り・間接参照）だと両方そろって空になり、
 * 突き合わせが「[] と [] が一致」で通ってしまう。注釈が1個しかない文書では、それは
 * 検査対象ゼロを意味する。/S /URI は値の書き方に依存しないので、この独立性を保てる。
 *
 * /Subtype /Link を数えないのは、目次や href="#..." の内部アンカーもLink注釈になるため。
 * それらは /URI を持たないので「注釈はN個あるのにURIはM個しか読めない」と誤検知し、
 * 「URIの書かれ方が想定外」という見当違いの原因を指す赤になる（実測で再現済み）。
 * 原因を誤誘導する赤は、検査を緩めようという圧力になるので避ける。
 */
export function linkAnnotationCount(buf) {
  return [...buf.toString('latin1').matchAll(/\/S\s*\/URI\b/g)].length;
}

/**
 * PDFから読み取れた中身（本文テキストとリンク）の指紋。
 *
 * PDFの生バイトには生成日時が埋まるため直接比較できないが、読み取った中身は決定論。
 * これを生成時に記録しておくと、(1)スクリプトを通さず手動印刷でPDFを差し替えた
 * (2)記録だけ更新してPDFを入れ忘れた (3)抽出器が劣化して読める内容が変わった、
 * のいずれも指紋の不一致として落ちる。
 */
export function fingerprintOf(result) {
  const canonical = JSON.stringify({
    pageCount: result.pageCount,
    pages: result.pages.map((p) => ({ page: p.page, text: p.text })),
    links: result.links.map((l) => ({ page: l.page, uri: l.uri, visible: l.visible })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}
