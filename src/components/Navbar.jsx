import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function onScroll() { setSolid(window.scrollY > 40); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function navClass(path, exact = false) {
    if (exact) return location.pathname === path ? "active-link" : "";
    return location.pathname.startsWith(path) ? "active-link" : "";
  }

  function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    if (onSearch) onSearch(val);
    if (val.trim()) navigate("/search");
  }

  return (
    <nav className={`navbar${solid ? " navbar--solid" : ""}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">Dhaka<span>Flix</span></Link>

        <button className="navbar-burger" onClick={() => setMenuOpen(m => !m)}>
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

        <div className="navbar-search">
          <span className="search-icon">&#128269;</span>
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={handleSearch}
          />
        </div>
      </div>
    </nav>
  );
}
