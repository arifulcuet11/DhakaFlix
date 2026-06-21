import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import CategoryPage from "./pages/CategoryPage";
import Search from "./pages/Search";
import SeriesDetail from "./pages/SeriesDetail";
import EnglishTV from "./pages/EnglishTV";
import KoreanTV from "./pages/KoreanTV";
import ForeignMovies from "./pages/ForeignMovies";
import AnimationMovies from "./pages/AnimationMovies";
import EnglishMovies from "./pages/EnglishMovies";
import SouthMovies from "./pages/SouthMovies";
import Documentary from "./pages/Documentary";
import BanglaMovies from "./pages/BanglaMovies";

export default function App() {
  const [query, setQuery] = useState("");

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Navbar onSearch={setQuery} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:slug" element={<CategoryPage />} />
        <Route path="/search" element={<Search query={query} />} />
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
      </Routes>
      <Footer />
      <BottomNav />
    </BrowserRouter>
  );
}
