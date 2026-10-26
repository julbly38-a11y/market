// Ціноутворення: роздрібна ціна = ціна постачальника + націнка. Параметри — у змінних середовища.
//   SITE_MARKUP_PERCENT — націнка сайту, %          (за замовчуванням 0)
//   TAX_PERCENT         — єдиний податок 5% + військовий збір 1% від доходу = 6 (ФОП 3 група, без ПДВ)
//   MONO_FEE_PERCENT    — комісія еквайрингу, %     (за замовчуванням 1.3, перевірити в кабінеті monobank business)

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export const MARKUP_PERCENT = num(process.env.SITE_MARKUP_PERCENT, 0);
export const TAX_PERCENT = num(process.env.TAX_PERCENT, 6);
export const FEE_PERCENT = num(process.env.MONO_FEE_PERCENT, 1.3);

export const retailPrice = (supplierPrice) => Math.ceil(supplierPrice * (1 + MARKUP_PERCENT / 100));

// Мінімальна націнка, при якій продаж не в мінус: ціна·(1 − податок − комісія) = закупівля.
export const breakEvenMarkupPercent = (tax = TAX_PERCENT, fee = FEE_PERCENT) =>
  Math.round((1 / (1 - (tax + fee) / 100) - 1) * 1000) / 10;
