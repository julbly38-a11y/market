import { money } from '../lib/format';

// Картки наборів (головна й сторінка /nabory).
export default function SetCards({ sets }) {
  return (
    <div className="set-cards">
      {sets.map((x) => (
        <a key={x.id} className="set-card" href={`/nabir/${x.slug}`}>
          <span className="set-collage">
            {x.items.slice(0, 4).map((i) => <img key={i.id} src={i.image} alt="" loading="lazy" />)}
          </span>
          <span className="set-card-body">
            <span className="set-card-title">{x.title}</span>
            <span className="set-card-meta">{x.items.length} речей{Number(x.discount_percent) > 0 ? ` · −${Number(x.discount_percent)}%` : ''}</span>
            <span className="set-card-price">
              {x.fullPrice > x.total && <s>{money.format(x.fullPrice)} ₴</s>} <b>{money.format(x.total)} ₴</b>
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
