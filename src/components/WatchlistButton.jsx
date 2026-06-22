import { useWatchlist } from "../hooks/useWatchlist";
import "./WatchlistButton.css";

export default function WatchlistButton({ item, className = "" }) {
  const { isInList, toggle } = useWatchlist();
  const saved = isInList(item.id);

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  }

  return (
    <button
      className={`wl-btn${saved ? " wl-btn--saved" : ""} ${className}`}
      onClick={handleClick}
      aria-label={saved ? "Remove from My List" : "Add to My List"}
      title={saved ? "Remove from My List" : "Add to My List"}
    >
      <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {saved ? "Saved" : "My List"}
    </button>
  );
}
