import { categories } from "../data/content";
import "./Page.css";
import "./Search.css";

const allItems = Object.entries(categories).flatMap(([slug, cat]) =>
  cat.items.map(item => ({ ...item, category: cat.label }))
);

export default function Search({ query }) {
  const q = (query || "").toLowerCase().trim();
  const results = q ? allItems.filter(i => i.title.toLowerCase().includes(q)) : [];

  return (
    <div>
      <div className="page-hero">
        <h1>Search</h1>
        <p>{q ? `${results.length} result(s) for "${query}"` : "Start typing to search..."}</p>
      </div>
      <div className="search-results">
        {results.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noreferrer" className="search-card">
            <div className="search-card-left">
              <span className="search-tag">{item.tag}</span>
              <span className="search-title">{item.title}</span>
              <span className="search-cat">{item.category}</span>
            </div>
            <span className="search-arrow">&#8599;</span>
          </a>
        ))}
        {q && results.length === 0 && (
          <p className="search-empty">No results found for "{query}"</p>
        )}
      </div>
    </div>
  );
}
