import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import CategoryPage from "./pages/CategoryPage";
import Search from "./pages/Search";
import SeriesDetail from "./pages/SeriesDetail";

export default function App() {
  const [query, setQuery] = useState("");

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Navbar onSearch={setQuery} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:slug" element={<CategoryPage />} />
        <Route path="/search" element={<Search query={query} />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
