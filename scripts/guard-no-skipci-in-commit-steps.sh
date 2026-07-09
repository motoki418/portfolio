#!/usr/bin/env bash
# CI ハイジーンガード（決定論・モデル非依存）:
# 生成物を自動コミットする workflow の `git commit` に [skip ci] 系 magic string が
# 含まれていないか検査する。squash マージ時に本文へ集約され、本番 deploy を
# 無言スキップする罠（2026-07-08 実害）の再発防止。単体でもCIからでも実行可。
#   使い方: bash scripts/guard-no-skipci-in-commit-steps.sh
set -uo pipefail

DIR=".github/workflows"
if [ ! -d "$DIR" ]; then
  echo "OK: $DIR が無い（検査対象なし）"
  exit 0
fi

# `git commit` を含む行に [skip ci] / [ci skip] / [no ci] があれば違反
hits="$(grep -rnE 'git[[:space:]]+commit' "$DIR" 2>/dev/null | grep -iE '\[skip ci\]|\[ci skip\]|\[no ci\]' || true)"

if [ -n "$hits" ]; then
  echo "::error::workflow の自動コミットに [skip ci] 系 magic string が含まれています。"
  echo "squash マージ時に main のコミットメッセージへ集約され、本番デプロイを無言でスキップします。除去してください:"
  echo "$hits"
  exit 1
fi

echo "OK: .github/workflows の自動コミット step に [skip ci] 系 magic string なし"
exit 0
