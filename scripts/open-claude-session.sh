#!/usr/bin/env bash
# Відкриває Claude-сесію в окремому вікні Chrome (не у вкладці).
# Використання: ./scripts/open-claude-session.sh [URL]
# Без аргументу відкривається ця сесія.
set -euo pipefail

URL="${1:-https://claude.ai/code/session_01NGASxV9PpUBABJJguazdZa}"

case "$(uname -s)" in
  Darwin) open -na "Google Chrome" --args --new-window "$URL" ;;
  Linux)  google-chrome --new-window "$URL" >/dev/null 2>&1 & ;;
  MINGW*|MSYS*|CYGWIN*) start chrome --new-window "$URL" ;;
  *) echo "Невідома система: $(uname -s)" >&2; exit 1 ;;
esac
