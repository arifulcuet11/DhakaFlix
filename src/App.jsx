import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import BottomNav from "./components/BottomNav";
import PageTransition from "./components/PageTransition";
import SearchOverlay from "./components/SearchOverlay";
import Home from "./pages/Home";
import CategoryPage from "./pages/CategoryPage";
import SeriesDetail from "./pages/SeriesDetail";
import EnglishTV from "./pages/EnglishTV";
import KoreanTV from "./pages/KoreanTV";
import ForeignMovies from "./pages/ForeignMovies";
import AnimationMovies from "./pages/AnimationMovies";
import EnglishMovies from "./pages/EnglishMovies";
import SouthMovies from "./pages/SouthMovies";
import Documentary from "./pages/Documentary";
import BanglaMovies from "./pages/BanglaMovies";
import Watchlist from "./pages/Watchlist";

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onOpen() { setSearchOpen(true); }
    window.addEventListener("dhakaflix_open_search", onOpen);
    return () => window.removeEventListener("dhakaflix_open_search", onOpen);
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Navbar onOpenSearch={() => setSearchOpen(true)} />
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      <PageTransition>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:slug" element={<CategoryPage />} />
        <Route path="/series/:id" element={<SeriesDetail source="korean" />} />
        <Route path="/tv/:id" element={<SeriesDetail source="english" />} />
        <Route path="/tvseries" element={<EnglishTV />} />
        <Route path="/korean" element={<KoreanTV />} />
        <Route path="/foreign-movies" element={<ForeignMovies />} />
        <Route path="/animation-movies" element={<AnimationMovies />} />
        <Route path="/english-movies" element={<EnglishMovies />} />
        <Route path="/south-movies" element={<SouthMovies />} />
        <Route path="/documentary" element={<Documentary />} />
        <Route path="/bangla-movies" element={<BanglaMovies />} />
        <Route path="/watchlist" element={<Watchlist />} />
      </Routes>
      </PageTransition>
      <Footer />
      <BottomNav />
    </BrowserRouter>
  );
}
