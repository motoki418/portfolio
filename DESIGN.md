# DESIGN.md — 中村元揮 LP デザインシステム

このファイルはClaudeへの指示を兼ねる**デザインの正本**です。置き場所は `apps/katachi-ai-lp/DESIGN.md`。
`katachi-ai-lp/index.html`（`<style>` タグ内）を変更するとき、このファイルに定義された値・ルールを優先します。

---

## 1. 使い方のルール（Claude へ）

- カラー・タイポグラフィ・スペーシングは必ず下記トークンを使う。数値・HEXをハードコードした新規プロパティの追加は禁止
- 新しい UI パターンを追加する前に「5. コンポーネントパターン」に類似のものがないか確認し、あれば流用する
- セクションを追加する場合は「6. セクション解剖」の label → title → lead → content の順序を守る
- モバイルファーストで書き、`max-width: 680px` と `max-width: 768px` のブレークポイントに必ず対応する
- アニメーションを追加するときは `@media (prefers-reduced-motion: reduce)` で無効化する

---

## 2. カラートークン

`:root` に定義済み。**値を直接書かずトークン名を使う。**

### インク（テキスト）

| トークン | 値 | 用途 |
|---|---|---|
| `--ink` | `#1f262c` | 見出し・最重要テキスト |
| `--ink-soft` | `#3b4752` | ボディテキスト（body の `color` デフォルト） |
| `--ink-muted` | `#68747e` | サブテキスト・補足・リード文 |
| `--ink-faint` | `#98a3ab` | プレースホルダー・注意書き・日付 |

### サーフェス（背景）

| トークン | 値 | 用途 |
|---|---|---|
| `--surface` | `#fffdf9` | ページ背景（body） |
| `--surface-warm` | `#f5efe6` | 交互セクション背景・warm 系コンテナ |
| `--surface-soft` | `#efe7dc` | より濃い warm 背景 |
| `--surface-raised` | `#ffffff` | カード・フォーム・モーダル背景 |
| `--surface-tint` | `#e7ddd0` | ボーダー近辺の装飾 |

### アクセント・バリエーション

| トークン | 値 | 用途 |
|---|---|---|
| `--accent` | `#52687d` | **機能色**：リンク・faq-q hover。装飾（カラーバー等）には使わない |
| `--accent-hover` | `#3e5366` | リンク hover・btn-primary / contact-submit hover 背景 |
| `--accent-soft` | `#e7edf2` | （予約・未使用）旧 hero 装飾放射円。2026-06-18 の視覚簡素化で撤去 |
| `--warm` | `#a46d3d` | **主アクセント（ブランド・装飾専用）**: nav-cta 背景・ドット・focus リング・入力フォーカス枠・OGP。**テキストには使わない**。※カード上辺のカラーバーは 2026-06-18 に撤去 |
| `--warm-text` | `#8b5c34` | **暖色のテキスト専用**（section-label / hero-label / case-industry / pricing-card-label / required-pill / 番号サークル / nav-cta hover 背景）。`--warm` は小さい文字で WCAG AA 未達（3.6〜4.3:1）のため、色相・彩度を保ち明度だけ下げた文字用トークン。全 warm 背景・surface 背景で 4.66:1 以上を確保 |
| `--warm-soft` | `#f4e8d8` | warm の薄い背景・バッジ背景 |
| `--olive` | `#67715d` | （予約・未使用）旧 case/pricing カード3枚目のカラーバー。2026-06-18 にカラーバー撤去で未使用化。**再導入しない** |
| `--olive-soft` | `#eaede6` | （予約・未使用） |
| `--brick` | `#8a6158` | `.contact-error` のエラー表示テキスト（意味的な赤系）。**旧 nav-cta hover 用途は `--warm-text` に統一して廃止** |
| `--brick-soft` | `#f1e8e5` | （予約・未使用） |

### ボーダー・シャドウ

| トークン | 値 | 用途 |
|---|---|---|
| `--line` | `#d7ccbe` | カード・セクションの通常ボーダー |
| `--line-strong` | `#c6b9a7` | 強調ボーダー（progress steps の接続線） |
| `--shadow-card` | `0 16px 40px rgba(31,38,44,.06)` | ホバー時のカードシャドウ |
| `--shadow-soft` | `0 8px 24px rgba(31,38,44,.04)` | カード・フォームの常時シャドウ |
| `--shadow-header` | `0 1px 0 rgba(31,38,44,.05)` | ヘッダー下ライン |
| `--header-bg` | `rgba(255,253,249,0.94)` | ヘッダー背景（blur と組み合わせ） |

### 形状

| トークン | 値 | 用途 |
|---|---|---|
| `--radius` | `18px` | カード・フォームグループ |
| `--radius-sm` | `10px` | 小カード・インプット・小パネル |
| `--radius-lg` | `24px` | 大型コンテナ（profile-card・contact-form・contact-success） |
| `--ease` | `cubic-bezier(0.22,1,0.36,1)` | 全トランジションのイージング |

---

## 3. タイポグラフィ

### フォントファミリー

```css
--font-body:    "Noto Sans JP", sans-serif   /* ボディ・UI テキスト全般 */
--font-display: "Sora", "Noto Sans JP", sans-serif  /* 見出し・数字・ラベル */
```

- `font-display` は `section-label`・`hero-title`・数値表示・英字ラベルで使う
- `font-body` はそれ以外すべて

### テキストスケール

| 用途 | サイズ | ウェイト | line-height | letter-spacing |
|---|---|---|---|---|
| Hero H1 | 50px（→900px: 40px →768px: 32px） | 900 | 1.2 | -0.045em |
| Section title | 34px（→768px: 27px）※ | 900 | 1.35 | -0.03em |
| Contact headline | 30px（→680px: 25px） | 900 | 1.45 | -0.03em |
| Service card h3 | 22px | 900 | 1.4 | — |
| Profile name | 22px | 900 | — | — |
| Pricing card h3 | 22px | 900 | 1.4 | — |
| Process step h3 | 17px | 900 | 1.45 | — |
| Section lead | 15px | 400 | 1.9 | — |
| Body default | 15.5px | 400 | 1.9 | — |
| Hero sub | 16px | 400 | 1.85 | — |
| Card body | 14px | 400 | 1.9 | — |
| FAQ answer | 14px | 400 | 1.9 | — |
| Section label | 11px | 600–700 | — | 0.16em |
| Nav link | 14.5px | 600 | — | — |
| Note / meta | 12–13px | 400–600 | — | — |

※ 長文タイトルの例外: `<br>` で意図した行割りが狭い画面で崩れる場合のみ、そのセクションに限定して `clamp(18px, 6vw, 27px)` で縮小してよい（適用例: concerns の「何から始めればいいか分からない」14文字）。

### 見出し階層ルール

```
h1  → hero のみ（ページに1つ）
h2  → 各セクションタイトル（contact-headline も h2）
h3  → FAQカテゴリ見出し・カード内見出し
h4  → 必要に応じてカード内サブ見出し
```

**禁止:** 見出しレベルをスキップすること（h1 の次に h3 など）

---

## 4. レイアウト・スペーシング

### コンテナ

```css
.container { max-width: 1060px; margin: 0 auto; padding: 0 28px; }
/* モバイル */
@media (max-width: 768px) { .container { padding: 0 20px; } }
```

### セクション縦余白

```css
section { padding: 104px 0; }
@media (max-width: 768px) { section { padding: 72px 0; } }
```

### ブレークポイント

| 幅 | 用途 |
|---|---|
| `max-width: 900px` | Hero タイトル縮小・ヘッダーナビ簡略化 |
| `max-width: 768px` | モバイル基準（ヘッダー最小化・グリッド1列・セクション余白縮小） |
| `max-width: 680px` | カード2列 → 1列（concerns）。3列グリッド（cases / pricing）は 768px で1列 |

### グリッドパターン

```css
/* 2カラム（concerns cards） */
grid-template-columns: repeat(2, 1fr);  gap: 16–20px;
→ 680px 以下で 1fr

/* 3カラム（cases / pricing cards） */
grid-template-columns: repeat(3, 1fr);  gap: 18px;
→ 768px 以下で 1fr（3カラムは 680px では狭すぎるため 768px で切り替える）

/* 4カラム（process steps） */
grid-template-columns: repeat(4, 1fr);
→ モバイルで grid-template-columns: 1fr; gap: 32px;
```

---

## 5. コンポーネントパターン

### section-label（セクション上部ラベル）

```css
display: inline-block;
font-family: var(--font-display);
font-size: 11px; font-weight: 600;
letter-spacing: 0.16em; text-transform: uppercase;
color: var(--warm);
margin-bottom: 14px;
```

**使い方:** セクション見出し（h2）の直上に置く。日本語 or 英語 OK。

### badge-pill（ヒーローラベル・ナビCTA以外の小バッジ）

```css
display: inline-block;
font-family: var(--font-display);
font-size: 11px; font-weight: 700;
letter-spacing: 0.18em; text-transform: uppercase;
color: var(--warm); background: var(--warm-soft);
padding: 5px 14px; border-radius: 999px;
```

### btn-primary（メインCTA）

```css
display: inline-flex; align-items: center; justify-content: center;
padding: 16px 28px; border-radius: 999px;
background: var(--ink); color: var(--surface);
font-size: 15px; font-weight: 800;
border: 1px solid var(--ink);
transition: transform 0.2s var(--ease), background 0.2s var(--ease);
/* hover */
background: var(--accent-hover); transform: translateY(-1px);
/* モバイルでフル幅 */
@media (max-width: 768px) { width: 100%; }
```

### nav-cta（ヘッダーCTAボタン）

```css
padding: 11px 22px; background: var(--warm); color: var(--surface);
border-radius: 12px; font-size: 13.5px; font-weight: 800;
/* hover */ background: var(--warm-text);  /* 暖色系に統一（旧 --brick から変更, 2026-06-18） */
```

### card（標準カード）

```css
border: 1px solid var(--line);
border-radius: var(--radius);  /* 18px */
background: var(--surface-raised);
box-shadow: var(--shadow-soft);
padding: 28–32px 24–28px;
/* hover（任意）*/
transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease);
transform: translateY(-2px); box-shadow: var(--shadow-card);
```

### case-card / pricing-card のカラーバー（2026-06-18 撤去）

旧仕様ではカード上辺に 3px のマルチカラーバー（accent → warm → olive）を付けていたが、
視覚的な静けさ（HermesAgent 流のミニマル）を優先して **撤去した**。
case-card / pricing-card は標準カード（border + shadow + hover lift）のみで構成する。
業種・プランの区別はカード内のバッジ（warm-soft）と見出しで行う。
**色帯・複数色相の装飾を再導入しない。**

### case-card（導入事例カード）

```css
/* 標準カード（border + shadow）に以下を組み合わせる。カラーバーは無し */
.case-industry { /* badge-pill と同形。font-size 11px; color: var(--warm-text); background: var(--warm-soft); border-radius: 999px; */ }
.case-metric {
  font-family: var(--font-display);
  font-size: 23px; font-weight: 700;
  color: var(--ink); letter-spacing: -0.02em;
  border-bottom: 1px solid var(--line);  /* 下に区切り線 */
}
.case-desc { font-size: 14px; color: var(--ink-muted); line-height: 1.9; }
```

**使い方:** 業種バッジ → h3（対象業務）→ 成果数値 → 説明文の順。成果数値は実際の支援で出た値のみ記載する（推定値・誇張禁止）。

### profile-facts（プロフィールの経歴ハイライト）

```css
.profile-facts { list-style: none; display: grid; gap: 8px; margin-top: 16px; }
.profile-facts li { display: flex; gap: 8px; font-size: 13.5px; color: var(--ink-soft); line-height: 1.7; }
/* li::before に warm のドット（5px・1行目中央に margin-top で位置合わせ） */
```

**使い方:** プロフィール本文の直下に置く。職務経歴書に基づく事実のみ記載する（誇張禁止）。

### num-badge（番号付きサークル）

```css
width: 38px; height: 38px; border-radius: 50%;
background: var(--warm-soft); color: var(--warm);
display: flex; align-items: center; justify-content: center;
font-family: var(--font-display); font-size: 12px; font-weight: 700;
```

### hero-stat（ヒーロー右カラムの実績カード）

```css
/* hero は >900px で grid 2カラム（1.2fr 0.8fr）。右カラムに縦積みで配置 */
.hero-stat {
  display: grid; gap: 2px;
  padding: 16px 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
}
.hero-stat-meta  { font-size: 12px; font-weight: 600; color: var(--ink-muted); }  /* 業種｜業務名 */
.hero-stat-value { font-family: var(--font-display); font-size: 21px; font-weight: 700; color: var(--ink); white-space: nowrap; }
/* ≤900px: 3カラム横並び ／ ≤680px: 1カラム・meta と value を左右配置（value 17px） */
```

**使い方:** `<a href="#cases">` で事例セクションへリンクする。数値は cases セクションと必ず一致させる。

### chip（タグ・ラベル chip）

```css
display: inline-flex; align-items: center; gap: 7px;
padding: 7px 14px; border: 1px solid var(--line);
border-radius: 999px; background: var(--surface-raised);
color: var(--ink-soft); font-size: 13px; font-weight: 600;
/* ドット */
::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: var(--warm); flex: 0 0 auto; }
```

### faq-item（アコーディオン）

```html
<div class="faq-item">
  <button class="faq-q" aria-expanded="false" aria-controls="faq-a-{id}">
    質問テキスト
    <span class="faq-icon" aria-hidden="true"></span>
  </button>
  <div class="faq-a" id="faq-a-{id}" role="region">
    <p class="faq-a-inner">回答テキスト</p>
  </div>
</div>
```

JS: `.faq-item.open` で `aria-expanded="true"` と `max-height: scrollHeight + 'px'` を切り替える。同一 `.faq-list` 内は排他制御（1つ開いたら他を閉じる）。

### reveal（スクロールアニメーション）

```css
.reveal { opacity: 0; transform: translateY(10px); transition: opacity 0.5s var(--ease), transform 0.5s var(--ease); }  /* 2026-06-18 に 20px/0.55s から控えめ化 */
.reveal.visible { opacity: 1; transform: none; }
.reveal-delay-1 { transition-delay: 0.1s; }
.reveal-delay-2 { transition-delay: 0.2s; }
.reveal-delay-3 { transition-delay: 0.3s; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }
```

JS: `IntersectionObserver` で `.visible` を付与。スクロールイベントで全走査するリスナーは追加しない（性能劣化）。

---

## 6. セクション解剖

すべてのセクションはこの構造を基本とする：

```html
<section class="{name}-section" id="{name}">
  <div class="container">
    <div class="text-center">            <!-- ラベルとタイトルはセンタリング -->
      <span class="section-label reveal">{英語ラベル}</span>
      <h2 class="section-title reveal">{見出し}</h2>
    </div>
    <p class="section-lead text-center mx-auto reveal">{リード文}</p>
    <!-- コンテンツ -->
  </div>
</section>
```

**交互背景:**
- 奇数セクション: `var(--surface)` （白に近い）
- 偶数セクション: `var(--surface-warm)` （warm ベージュ）

現在の順序: hero(gradient) → why(surface) → concerns(warm) → cases(surface) → process(warm) → pricing(surface) → development(warm) → subsidy(surface) → faq(warm) → profile(surface) → contact(warm)

---

## 7. DO / DON'T

### カラー

- ✅ `color: var(--ink-muted)` のようにトークン経由で指定する
- ✅ warm の**装飾**（ドット・ボーダー強調・フォーカス枠・nav-cta 背景）は `--warm` を使う
- ✅ warm の**テキスト**（ラベル・バッジ文字・番号）は `--warm-text` を使う（`--warm` は小さい文字で AA 未達）
- ✅ warm 背景（`--surface-warm`）の上に乗せる注記テキストは `--ink-muted` だと AA 未達（4.19:1）→ `--ink-soft` を使う
- ❌ `color: #68747e` のように HEX を直接書かない
- ❌ 暖色のテキストに `--warm` を使わない（装飾専用）。`--warm-text` を使う
- ❌ `--ink`（最暗）をボディテキストに使わない。見出しのみ

### 視覚的トーン（静けさ — 2026-06-18 方針）

参照基準は HermesAgent 級のミニマル。**色相は warm（ブランド）/ accent（機能色）の2系統に保つ。**

- ✅ 装飾は warm を主アクセント、accent はリンク等の機能色に限定する
- ✅ カードは border + shadow + hover lift のみで構成し、区別はバッジと見出しで付ける
- ❌ カード上辺のカラーバー・hero の装飾放射円など、複数色相の装飾を新規追加しない（2026-06-18 撤去。虹色化は視覚ノイズになる）
- ❌ `--olive` /（装飾用途の）`--brick` / `--accent-soft` を再投入しない（`--brick` はエラー表示専用）

### ボタン

- ✅ メインCTAは `.btn-primary` のスタイルを踏襲する（角丸 999px・ink 背景）
- ✅ ヘッダーCTAは `.nav-cta` の角丸 12px・warm 背景を維持する
- ❌ ボタンに `border: none` だけ指定して `border: 1px solid var(--ink)` を消さない（`.btn-primary` は bordered）

### カード

- ✅ カードの `border-radius` は `var(--radius)` (18px) を使う
- ✅ 小パネルは `var(--radius-sm)` (10px)
- ❌ `border-radius: 12px` などハードコードしない

### アニメーション

- ✅ CSS トランジションは `var(--ease)` を使う
- ✅ `prefers-reduced-motion` の対応を忘れない
- ❌ `transition: all` は使わない（意図しないプロパティへの波及を避ける）

### アクセシビリティ

- ✅ インタラクティブな `<button>` には `aria-expanded` を付与する
- ✅ フォームの `<label>` は `for` 属性で対応する `input` と紐付ける
- ✅ アイコンのみの要素には `aria-hidden="true"` を付与する
- ❌ `<div>` や `<span>` をクリック可能にするときは `<button>` に変更する

### レスポンシブ

- ✅ グリッドは `repeat(2, 1fr)` → `680px` 以下で `1fr` に切り替える
- ✅ ヒーロータイトルは 900px で縮小、768px でさらに縮小する
- ❌ 固定幅（`width: 420px` など）を付けて画面幅に依存する要素を作らない

---

## 8. フォーム規約

Web3Forms（`action="https://api.web3forms.com/submit"`）を使用。

必須の hidden fields:
```html
<input type="hidden" name="access_key" value="fa0c4986-834c-439c-bb39-e36f5be2f3c3">
<input type="hidden" name="subject" value="...">
<input type="hidden" name="from_name" value="...">
<input type="checkbox" name="botcheck" style="display:none">
```

フォームフィールドのラベルは `display: flex; align-items: center; gap: 8px;` で `.required-pill` を横に並べる。

送信後は `contactForm.style.display = 'none'` と `contactSuccess.style.display = 'block'` で完了画面を表示する（ページ遷移なし）。

---

## 9. 構造化データ（JSON-LD）

`<head>` 内に `ProfessionalService` スキーマを維持する：

```json
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "中村元揮｜AI推進パートナー",
  "description": "AI導入・AI活用を現場で使われる形にする…",
  "url": "https://katachi-ai.com/",
  "image": "https://katachi-ai.com/profile.png",
  "areaServed": "日本（札幌・北海道拠点、オンライン全国対応）",
  "founder": { "@type": "Person", "name": "中村元揮", "jobTitle": "AI推進パートナー" }
}
```

サービス内容・肩書きが変わったときはここも更新する。

---

## 10. 更新ルール

- `index.html` の `:root` のトークン値を変えたら、このファイルの「2. カラートークン」も必ず同期する
- 新しいコンポーネントを追加したら「5. コンポーネントパターン」に追記する
- このファイルが正本。リモート（Claude Code on the web）で katachi-ai-lp を作業させる場合は、このファイルの内容をプロンプトに渡すか、一時的にリポジトリへコピーして参照させる
