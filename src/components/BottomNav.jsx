import { NavLink } from "react-router-dom";
import "./BottomNav.css";

const TABS = [
  { label: "Home",   icon: "🏠", to: "/",             exact: true  },
  { label: "Korean", icon: "🎭", to: "/korean",        exact: false },
  { label: "TV",     icon: "📺", to: "/tvseries",      exact: false },
  { label: "Movies", icon: "🎬", to: "/foreign-movies", exact: false },
  { label: "Search", icon: "🔍", to: "/search",        exact: false },
];

export default function BottomNav() {
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
    </nav>
  );
}
