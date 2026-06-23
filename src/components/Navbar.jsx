import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({ onOpenSearch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const location = useLocation();

  useEffect(() => {
    function onScroll() { setSolid(window.scrollY > 40); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  function navClass(path, exact = false) {
    if (exact) return location.pathname === path ? "active-link" : "";
    return location.pathname.startsWith(path) ? "active-link" : "";
  }

  return (
    <nav className={`navbar${solid ? " navbar--solid" : ""}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">Dhaka<span>Flix</span></Link>

        <button className="navbar-burger" onClick={() => setMenuOpen(m => !m)} aria-label="Menu">
          <span /><span /><span />
        </button>

        <ul className={`navbar-links ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}>
          <li><Link to="/" className={navClass("/", true)}>Home</Link></li>
          <li><Link to="/korean" className={navClass("/korean")}>Korean</Link></li>
          <li><Link to="/tvseries" className={navClass("/tvseries")}>TV Series</Link></li>
          <li><Link to="/english-movies" className={navClass("/english-movies")}>English</Link></li>
          <li><Link to="/south-movies" className={navClass("/south-movies")}>Hindi</Link></li>
          <li><Link to="/foreign-movies" className={navClass("/foreign-movies")}>Foreign</Link></li>
          <li><Link to="/animation-movies" className={navClass("/animation-movies")}>Animation</Link></li>
          <li><Link to="/documentary" className={navClass("/documentary")}>Docs</Link></li>
          <li><Link to="/bangla-movies" className={navClass("/bangla-movies")}>Bangla</Link></li>
        </ul>

        <button className="navbar-search-btn" onClick={onOpenSearch} aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Search</span>
        </button>
      </div>
    </nav>
  );
}
