// Публічна адреса сайту для SEO (canonical, sitemap, robots, фід). Окрема змінна PUBLIC_SITE_URL, щоб локальний
// SITE_URL=http://localhost:3020 ніколи не потрапляв у продакшн. Коли зʼявиться свій домен — задати PUBLIC_SITE_URL.
export const SITE_BASE = (process.env.PUBLIC_SITE_URL || 'https://forpost-shop.vercel.app').replace(/\/$/, '');
