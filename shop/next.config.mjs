// Локально ключі лежать в ../.env (поза папкою shop). Next сам читає лише shop/.env*,
// тому підвантажуємо кореневий файл тут. На Vercel його немає, змінні задаються в налаштуваннях.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {}

export default {};
