import { Inter } from 'next/font/google';
import './globals.css';
import { SITE_BASE } from '../lib/site';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font' });

export const metadata = {
  metadataBase: new URL(SITE_BASE),
  title: 'Форпост — товари напряму зі складу',
  description: 'Одяг, спорядження, енергія та інше напряму від постачальників. Оплата карткою, доставка Новою Поштою.',
  openGraph: { siteName: 'Форпост', locale: 'uk_UA', type: 'website' },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#faf9f7' };

export default function RootLayout({ children }) {
  return (
    <html lang="uk" className={inter.variable}>
      <body>
        <div className="topbar">
          <div className="wrap topbar-in">
            <span className="tb-left"><a href="/povernennya">Доставка і повернення</a><a href="/oferta">Оферта</a></span>
            <span className="tb-mid">Напряму зі складу. Оплата карткою. Нова Пошта.</span>
            <span className="tb-right">Україна</span>
          </div>
        </div>
        <header className="site-header">
          <div className="wrap bar">
            <a className="brand" href="/" aria-label="Форпост — на головну">
              <span className="brand-mark" aria-hidden="true" />
              Форпост
            </a>
            <nav className="nav" aria-label="Головне меню">
              <a href="/#catalog" className="nav-chip">Каталог</a>
              <a href="/?g=%D0%92%D1%96%D0%B9%D1%81%D1%8C%D0%BA%D0%BE%D0%B2%D0%B8%D0%B9%20%D1%96%20%D1%82%D0%B0%D0%BA%D1%82%D0%B8%D1%87%D0%BD%D0%B8%D0%B9%20%D0%BE%D0%B4%D1%8F%D0%B3#catalog">Одяг</a>
              <a href="/?g=%D0%A2%D0%B0%D0%BA%D1%82%D0%B8%D1%87%D0%BD%D0%B5%20%D1%81%D0%BF%D0%BE%D1%80%D1%8F%D0%B4%D0%B6%D0%B5%D0%BD%D0%BD%D1%8F%20%D1%96%20%D0%B7%D0%B0%D1%85%D0%B8%D1%81%D1%82#catalog">Спорядження</a>
              <a href="/?g=%D0%90%D0%BA%D1%83%D0%BC%D1%83%D0%BB%D1%8F%D1%82%D0%BE%D1%80%D0%BD%D1%96%20%D1%81%D1%82%D0%B0%D0%BD%D1%86%D1%96%D1%97%20%D1%82%D0%B0%20%D0%B5%D0%BD%D0%B5%D1%80%D0%B3%D1%96%D1%8F#catalog">Енергія</a>
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
