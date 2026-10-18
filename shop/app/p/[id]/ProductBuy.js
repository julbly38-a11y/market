'use client';

import { OrderForm } from '../../OrderForm';

export default function ProductBuy({ product }) {
  if (product.stock < 1) return <p className="dim">Зараз немає в наявності.</p>;
  return <OrderForm product={product} inline />;
}
