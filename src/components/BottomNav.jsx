import { NavLink } from "react-router-dom";
import { useWatchlist } from "../hooks/useWatchlist";
import "./BottomNav.css";

const TABS = [
  { label: "Home",   icon: "🏠", to: "/",          exact: true  },
  { label: "Korean", icon: "🎭", to: "/korean",     exact: false },
  { label: "TV",     icon: "📺", to: "/tvseries",   exact: false },
  { label: "Movies", icon: "🎬", to: "/english-movies", exact: false },
  { label: "Search", icon: "🔍", to: "/search",     exact: false },
];

export default function BottomNav() {
  const { list } = useWatchlist();

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.exact}
          className={({ isActive }) => "bottom-nav-tab" + (isActive ? " bottom-nav-active" : "")}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </NavLink>
      ))}
      <NavLink
        to="/watchlist"
        className={({ isActive }) => "bottom-nav-tab" + (isActive ? " bottom-nav-active" : "")}
      >
        <span className="bottom-nav-icon bottom-nav-heart-wrap">
          <svg viewBox="0 0 24 24" fill={list.length > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, color: list.length > 0 ? "#E8A020" : "inherit" }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {list.length > 0 && <span className="bottom-nav-badge">{list.length > 99 ? "99+" : list.length}</span>}
        </span>
        <span className="bottom-nav-label">My List</span>
      </NavLink>
    </nav>
  );
}
