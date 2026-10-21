const SITE = (process.env.SITE_URL || 'https://forpost-shop.vercel.app').replace(/\/$/, '');

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/order/', '/review/'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
