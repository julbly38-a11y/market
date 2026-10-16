#!/usr/bin/env bash
# Відкриває Supabase-проєкт nobodyjul в окремому вікні Chrome (не у вкладці).
# Використання: ./scripts/open-supabase.sh [URL]
# Без аргументу відкривається панель проєкту.
set -euo pipefail

URL="${1:-https://supabase.com/dashboard/project/ubjnztanehqlsrqphdqy}"

case "$(uname -s)" in
  Darwin) open -na "Google Chrome" --args --new-window "$URL" ;;
  Linux)  google-chrome --new-window "$URL" >/dev/null 2>&1 & ;;
  MINGW*|MSYS*|CYGWIN*) start chrome --new-window "$URL" ;;
  *) echo "Невідома система: $(uname -s)" >&2; exit 1 ;;
esac
