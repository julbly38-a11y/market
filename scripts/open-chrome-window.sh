#!/usr/bin/env bash
# Відкриває сайт у окремому вікні Chrome (не у вкладці). За замовчуванням helsi.pro.
# Використання: ./scripts/open-claude-session.sh [URL]
# Без аргументу відкривається https://helsi.pro.
set -euo pipefail

URL="${1:-https://helsi.pro}"

case "$(uname -s)" in
  Darwin) open -na "Google Chrome" --args --new-window "$URL" ;;
  Linux)  google-chrome --new-window "$URL" >/dev/null 2>&1 & ;;
  MINGW*|MSYS*|CYGWIN*) start chrome --new-window "$URL" ;;
  *) echo "Невідома система: $(uname -s)" >&2; exit 1 ;;
esac
