# テスト（Playwright）

このディレクトリは LP の **E2E + ビジュアル回帰テスト**。サイト本体（`index.html` ほか）は
素のHTML/CSS/JSのまま。テスト基盤だけを `tests/` と `package.json` に隔離している。

## セットアップ（初回のみ）

```bash
npm ci                              # 依存（@playwright/test）を入れる
npx playwright install chromium webkit   # ブラウザ本体を入れる
```

## 実行

```bash
npm run test:e2e        # 機能E2E（導線・価格ガード・FAQ・フォーム）。OS非依存
npm run test:visual     # ビジュアル回帰（崩れ検出）。ローカルmacの基準と比較
npm test                # 両方
npm run report          # 直近の結果をHTMLレポートで開く
```

## 構成

- `e2e.spec.ts` — 主要導線の機能テスト。**開発価格(40/120/150/150万円〜)の恒久ガード**を含む。
  問い合わせフォームは実送信しない（web3formsに本物の問い合わせが飛ぶため、存在・必須属性のみ確認）。
- `visual.spec.ts` — フルページ + 開発/料金セクションのスクショ差分。
- プロジェクトは `desktop-chromium`(1280幅) と `mobile-safari`(iPhone 13 = WebKit) の2つ。

## ビジュアル基準画像（baseline）の運用

- スクショ基準は **OS接尾辞付き**（`*-darwin.png` = mac、`*-linux.png` = CI）で別管理される。
- 表示を意図的に変えたら `npm run update-snapshots` で mac 基準を撮り直してコミットする。
- **CIでビジュアル比較も回したい場合**: GitHub Actions の「Update visual baselines (Linux)」を
  1回手動実行すると Linux 基準が生成・コミットされる。以後 CI でも比較可能。
- 現状 CI（`e2e.yml`）は **機能E2Eのみ**を毎回実行（OS非依存で確実）。

## 注意（既知の癖）

- `--window-size` 等の素のヘッドレス撮影と違い、Playwright は本物の WebKit でモバイルを描画する。
  ただし実機 iPhone Safari と完全一致ではない（flex-wrap/gap で稀に差）。重要セクションは
  ときどき実機でも目視する。

