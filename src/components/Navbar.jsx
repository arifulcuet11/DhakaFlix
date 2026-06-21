import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    if (onSearch) onSearch(val);
    if (val.trim()) navigate("/search");
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">Dhaka<span>Flix</span></Link>

        <button className="navbar-burger" onClick={() => setMenuOpen(m => !m)}>
          <span /><span /><span />
        </button>

        <ul className={`navbar-links ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/movies">Movies</Link></li>
          <li><Link to="/tvseries">TV Series</Link></li>
          <li><Link to="/games">Games</Link></li>
          <li><Link to="/software">Software</Link></li>
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
