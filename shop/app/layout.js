import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font' });

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'https://forpost-shop.vercel.app'),
  title: 'Форпост — товари напряму зі складу',
  description: 'Одяг, спорядження, енергія та інше напряму від постачальників. Оплата карткою, доставка Новою Поштою.',
  openGraph: { siteName: 'Форпост', locale: 'uk_UA', type: 'website' },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#faf9f7' };

export default function RootLayout({ children }) {
  return (
    <html lang="uk" className={inter.variable}>
      <body>
        <header className="site-header">
          <div className="wrap bar">
            <a className="brand" href="/" aria-label="Форпост — на головну">
              <span className="brand-mark" aria-hidden="true" />
              Форпост
            </a>
            <nav className="nav">
              <a href="/povernennya">Доставка і повернення</a>
              <a href="/oferta">Оферта</a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <div className="foot-grid">
              <div>
                <div className="brand small"><span className="brand-mark" aria-hidden="true" />Форпост</div>
                <p>Товари напряму зі складів постачальників. Відправка Новою Поштою після підтвердження оплати.</p>
              </div>
              <div>
                <h4>Покупцям</h4>
                <a href="/povernennya">Доставка і повернення</a>
                <a href="/oferta">Публічна оферта</a>
                <a href="/konfidentsiynist">Політика конфіденційності</a>
              </div>
              <div>
                <h4>Оплата</h4>
                <p>Карткою онлайн через monobank (mono pay). Дані картки нам не передаються.</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
