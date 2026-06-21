import "./CategoryRow.css";

const colors = ["#e50914", "#0097d6", "#f5a623", "#27ae60", "#8e44ad", "#e67e22"];

export default function CategoryRow({ title, items }) {
  return (
    <div className="row">
      <h2 className="row-title">{title}</h2>
      <div className="row-scroll">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="card"
            style={{ "--accent": colors[i % colors.length] }}
          >
            <div className="card-thumb">
              <img
                src={`https://picsum.photos/seed/${encodeURIComponent(item.title)}/300/170`}
                alt={item.title}
                loading="lazy"
              />
              <div className="card-overlay">
                <span className="card-play">&#9654;</span>
              </div>
            </div>
            <div className="card-body">
              <span className="card-tag">{item.tag}</span>
              <p className="card-title">{item.title}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
