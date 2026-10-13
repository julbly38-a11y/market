import './globals.css';

export const metadata = {
  title: 'Форпост — товари напряму зі складу',
  description: 'Каталог товарів постачальників для дропшипінгу',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
