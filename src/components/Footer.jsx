import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <p className="footer-logo">Dhaka<span>Flix</span></p>
          <p className="footer-tagline">Your local media streaming hub</p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <p className="footer-col-title">Browse</p>
            <Link to="/korean">Korean Drama</Link>
            <Link to="/tvseries">TV Series</Link>
            <Link to="/english-movies">English Movies</Link>
            <Link to="/south-movies">Hindi & South</Link>
          </div>
          <div className="footer-col">
            <p className="footer-col-title">More</p>
            <Link to="/foreign-movies">Foreign</Link>
            <Link to="/animation-movies">Animation</Link>
            <Link to="/documentary">Documentary</Link>
            <Link to="/bangla-movies">Bangla</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">© 2025 DhakaFlix · All rights reserved · LAN streaming for personal use</p>
      </div>
    </footer>
  );
}
