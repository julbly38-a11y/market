import { Inter } from 'next/font/google';
import './globals.css';
import { SITE_BASE } from '../lib/site';
import { getMenu } from '../lib/menu';
import MegaScroller from './MegaScroller';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font' });

export const metadata = {
  metadataBase: new URL(SITE_BASE),
  title: 'Форпост — товари напряму зі складу',
  description: 'Одяг, спорядження, енергія та інше напряму від постачальників. Оплата карткою, доставка Новою Поштою.',
  openGraph: { siteName: 'Форпост', locale: 'uk_UA', type: 'website' },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#faf9f7' };

export default function RootLayout({ children }) {
  const menu = getMenu();
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
              <div className="nav-item">
                <a href="/?g=all#catalog" className="nav-chip">Каталог</a>
                <div className="mega">
                  <div className="wrap mega-in">
                    <div className="mega-list">
                      <h4>Усі категорії</h4>
                      <ul>
                        {menu.groups.map((g) => (
                          <li key={g.group}><a href={`/?g=${encodeURIComponent(g.group)}#catalog`}>{g.group} <em>{g.total}</em></a></li>
                        ))}
                      </ul>
                    </div>
                    <MegaScroller items={menu.groups.map((g) => ({ href: `/?g=${encodeURIComponent(g.group)}#catalog`, name: g.group, image: g.image }))} />
                  </div>
                </div>
              </div>
              {menu.sections.map((sec) => (
                <div className="nav-item" key={sec.group}>
                  <a href={`/?g=${encodeURIComponent(sec.group)}#catalog`}>{sec.label}</a>
                  <div className="mega">
                    <div className="wrap mega-in">
                      <div className="mega-list">
                        <h4>{sec.group}</h4>
                        <ul>
                          {sec.categories.map((c) => (
                            <li key={c.name}><a href={`/?g=${encodeURIComponent(sec.group)}&c=${encodeURIComponent(c.name)}#catalog`}>{c.name} <em>{c.count}</em></a></li>
                          ))}
                        </ul>
                        <a className="mega-all" href={`/?g=${encodeURIComponent(sec.group)}#catalog`}>Усі товари розділу →</a>
                      </div>
                      <MegaScroller items={sec.categories.map((c) => ({ href: `/?g=${encodeURIComponent(sec.group)}&c=${encodeURIComponent(c.name)}#catalog`, name: c.name, image: c.image }))} />
                    </div>
                  </div>
                </div>
              ))}
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
                <h4>Партнерам</h4>
                <a href="https://mydrop.com.ua/dropshipper?p=15282c" target="_blank" rel="sponsored noopener nofollow">MyDrop для дропшиперів (−2 € на першу підписку)</a>
                <a href="https://mydrop.com.ua/vendor?p=15282c" target="_blank" rel="sponsored noopener nofollow">MyDrop для постачальників (−7 €)</a>
                <a href="https://mydrop.com.ua/?p=15282c" target="_blank" rel="sponsored noopener nofollow">MyDrop: CRM для дропшипінгу</a>
                <small className="partner-note">Партнерські посилання: ми можемо отримати винагороду.</small>
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
