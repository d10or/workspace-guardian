#!/usr/bin/env bash
# Records the three demo scenarios as asciinema casts and GIFs under demo/recordings/.
# Needs: asciinema (pip install asciinema), agg (github.com/asciinema/agg), node, git.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/demo/recordings"; mkdir -p "$OUT"
export PATH="$HOME/.local/bin:$HOME/Library/Python/3.9/bin:$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
export DEMO_PAUSE="${DEMO_PAUSE:-1.4}" DEMO_QUIET=1 DEMO_TMP=/tmp NO_COLOR=
for s in clean risky handoff; do
  rm -f "$OUT/$s.cast" "$OUT/$s.gif"
  asciinema rec --quiet --overwrite --cols 100 --rows 44 --title "guardian: $s" \
    -c "bash '$HERE/demo/scenarios.sh' $s" "$OUT/$s.cast"
  agg --cols 100 --rows 44 --font-size 15 --speed 1 --last-frame-duration 4 --theme monokai "$OUT/$s.cast" "$OUT/$s.gif"
  printf '%-8s %6s KB cast  %6s KB gif\n' "$s" "$(du -k "$OUT/$s.cast" | cut -f1)" "$(du -k "$OUT/$s.gif" | cut -f1)"
done
