import { SITE_BASE as SITE } from '../lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/order/', '/review/'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
