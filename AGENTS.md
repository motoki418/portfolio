# katachi-ai-lp — プロジェクト固有指示

## このディレクトリの境界

**役割: 対外公開の営業LP とサンプルサイト**。Cloudflare Workers（static assets）で公開する本番資材のみ置く。

> 判定基準: 見込み顧客が直接見る公開物か？
>
> - ビジネスロジック・エージェント → `~/work/ai-biz`
> - 個人ライフログ → `~/life`
> - 学習・プロトタイプ → `~/dev`

## 概要

中村元揮（札幌・エンジニア）の個人ビジネスポートフォリオサイト。
札幌でWeb制作・Web予約・AI業務改善を提供するサービスのLP。

- 本番URL: https://katachi-ai.com/ （正規URL。SNS・名刺・QR・メール署名など外部掲載はすべてこれに統一）
- katachi-ai.jp / www.katachi-ai.jp はブランド保護用。Cloudflare の Redirect Rule で https://katachi-ai.com へ 301 リダイレクト（パス・クエリ保持）。.jp 側にコンテンツは置かない
- 旧URL https://ai-advisory-hokkaido.pages.dev/ は移行前の Cloudflare Pages のデフォルトドメイン（残存。新規掲載には使わない）
- 配信: Cloudflare Workers（static assets）。設定は `wrangler.jsonc`。`main` への push を `.github/workflows/deploy.yml`（`wrangler deploy`）が拾って本番反映する。手動デプロイは `npx wrangler deploy`
- ビルド: `wrangler deploy` が `wrangler.jsonc` の `build.command`（`sh scripts/build-cloudflare-pages.sh`）を自動実行して `dist/` を生成・アップロードする。出力先は `dist`
- 自動デプロイの有効化に必要: リポジトリ Secrets に `CLOUDFLARE_API_TOKEN`（Workers Scripts:Edit 権限）。未設定の間 deploy.yml はスキップ動作（main は赤くならない）
- 旧 Pages（`ai-advisory-hokkaido`）からの移行は GitHub Flow で `wrangler.jsonc` を main に載せた時点でリポジトリ側は完了。旧 Pages プロジェクトの独自ドメイン剥がし／GitHub 連携 OFF はオーナー承認のうえ実施する（本番ドメインに触るため）
- 公開LPのため、文言・価格・画像・計測タグの変更は見込み顧客に直接影響する本番変更として扱う

## 技術スタック

- 素の HTML / CSS / JavaScript（ビルドツール・パッケージマネージャなし）
- Google Fonts（Noto Sans JP, Sora）を CDN 経由で読込
- Google Analytics (gtag) 導入済み（測定ID `G-DNCMC8QGMV`。旧記載の `G-KV15FJJDYL` は GA4 上に実在しない孤立IDだった＝2026-07-21 GA4 管理画面で実確認）

## 構成

- `index.html` — メインLP。CSS は `<style>` タグ内、JS は `<script>` タグ内に**インライン**で記述（外部 style.css / script.js は存在しない）
- `privacy.html` — プライバシーポリシー
- `samples/{bonesetter,clinic,restaurant}/` — 営業用サンプルサイト（業種別）。完成サイトの設計見本。AI機能デモは別物（`~/work/ai-biz/demos/`）
- `favicon.svg`, `sitemap.xml`, `robots.txt`
- `profile.png` — プロフィール画像（`.gitignore` の `!profile.png` で例外許可）
- 他の `*.png` はスクリーンショット等で `.gitignore` により除外される
- `scripts/build-cloudflare-pages.sh` — Cloudflare 配信の公開対象だけを `dist/` にコピーする（`wrangler.jsonc` の `build.command` から呼ばれる）

## デザイン規約

デザインの正本はこのリポジトリ直下の `DESIGN.md`。
カラートークン・タイポグラフィ・コンポーネントパターン・DO/DON'T はそちらを参照すること。
なお `~/apps/DESIGN.md` は apps 配下の業務ツール向け共通基準であり、本LPには適用しない。

## 開発規約

- **CSS/JS はインライン方針を維持**：外部ファイル化しない（現状単一ページのため）。変更は `<style>` / `<script>` 内の既存セクションに追記・編集する
- **CSSカスタムプロパティ**：カラー・スペーシングは `:root` の `--ink`, `--accent` 等を必ず使う（ハードコードした色値の新規追加禁止）
- **レスポンシブ**：モバイル優先。画面幅変更で崩れやすい領域は profile section / hero / pricing — HTML変更時は必ず確認する
- **日本語LP**：文言変更時は敬語レベルと語尾の統一感を崩さない
- **画像追加**：`.gitignore` が `*.png` を除外しているので、本番で使う画像は `!filename.png` を追加する必要あり

## 各エージェント共通の作業ルール

- 作業開始時に必ず `git status --short --branch` を実行し、ブランチ・ahead/behind・dirty差分・未追跡ファイルを確認する
- ユーザー既存のdirty差分や未追跡ファイルは、明示指示なしに編集・整形・削除・revertしない。必要な変更が既存dirtyファイルと重なる場合は、先に差分を読んで最小限の追記に留める
- `git add .` は禁止。ステージングが必要な場合でも、明示指示後に対象ファイルを個別指定する
- `git reset --hard`、`git checkout -- <path>`、`git clean`、`rm -rf`、画像ファイル削除など破壊的なGit操作・削除操作は、明示承認なしに実行しない
- 変更前に `git diff` で意図しない差分がないか確認する
- コミット前に index.html をブラウザで開いて実機確認する（プレビューツールがあれば活用）
- `main` への push は本番反映トリガーになるため、明示承認なしで実行しない
- `git push --force`、画像ファイル削除、Google Analytics タグ変更・削除、公開文言の大幅変更、価格・問い合わせ導線の変更は明示承認なしで実行しない
- 静的HTMLとして成立することを確認する。`index.html` 変更時はブラウザ表示、主要セクション、レスポンシブ、構造化データの破損有無を確認する
- CSSの既存デザイントークン（`--ink`, `--accent`, `--surface` 系）を優先して使う
- 過度な構造変更（外部CSS化、フレームワーク導入、ビルドツール追加）は提案ベースで、実装前に必ず相談する

## CI / branch protection の注意（2026-07-09）

### 必須チェックが "Expected" のまま固まってマージ不能になる主因
GitHub は **PR の HEAD コミットメッセージ** に次のいずれかが含まれると、`pull_request` / `push` の workflow を**一切起動しない**（公式: Skipping workflow runs）:

- `[skip ci]` / `[ci skip]` / `[no ci]` / `[skip actions]` / `[actions skip]`

説明文として書いても同じ。必須ステータスチェック（`e2e` / `visual` / `Build and verify static site`）は status 未報告のまま "Expected" になり、`enforce_admins=true` だと admin マージも不可。

実害例: drift-guard 追加 PR（#51）の HEAD に説明として上記 magic string が入り CI 0 run。一方 workflow のみの #45（secret-scan 追加）は通常どおり発火・マージ済み → **「workflow のみ変更だから発火しない」ではない**。

### ルール
1. **CI を回したい PR のコミットメッセージに上記 magic string を書かない**（説明は「CI-skip magic string」「skip token」など別表記にする）。
2. 自動コミット step（`update-visual-baselines.yml` 等）にも付けない。`scripts/guard-no-skipci-in-commit-steps.sh` が CI で検査する。
3. squash 設定は `PR_BODY` 固定（ブランチ側の skip token が main 本文へ集約されないため）。
4. 取りこぼし安全網: `deploy-drift-guard.yml`（scheduled。コミットメッセージの skip token の影響を受けない）。

関連 beads: `nakamuramotoki-i04a`

### 第2の主因: `update-visual-baselines.yml` の自動コミット後、CI が承認待ちで止まる（2026-07-26 実測）

`update-visual-baselines.yml` を回すと `github-actions[bot]` が基準画像をブランチへ push する。
このコミットに対する `pull_request` の run は **`action_required`（実行時間 0s）で作られ、承認するまで走らない**。
`gh pr checks` は `no checks reported` を返し、必須チェックが揃わず `mergeStateStatus` は `BLOCKED` のままになる。

- 症状の見分け方: `gh run list --branch <branch>` に conclusion `action_required` の run が並ぶ。
  skip token 由来なら run 自体が 0 件なので、そこで区別できる。
- 対処: `gh api -X POST repos/motoki418/katachi-ai-lp/actions/runs/<run_id>/approve` を対象 run
  （`E2E & Visual` / `CI` / `Secret scan`）すべてに実行する。承認後は通常どおり走る。
- **`maxDiffPixelRatio` を緩める・スナップショット対象を外すのは禁止**。ビジュアル差分が出たときの
  正しい手順は基準画像の再生成であり、検査そのものを弱めない（`rules/security.md` の報酬ハッキング禁止）。

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
