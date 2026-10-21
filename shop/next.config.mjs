// Локально ключі лежать в ../.env (поза папкою shop). Next сам читає лише shop/.env*,
// тому підвантажуємо кореневий файл тут. Значення з файлу мають пріоритет над змінними
// оболонки (наприклад, старий MONO_TOKEN із ~/.zshrc). На Vercel файл не читаємо:
// там змінні задаються в налаштуваннях проєкту.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

if (!process.env.VERCEL) {
  try {
    Object.assign(process.env, parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')));
  } catch {}
}

export default {};
