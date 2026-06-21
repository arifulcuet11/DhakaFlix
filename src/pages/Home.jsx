import Hero from "../components/Hero";
import CategoryRow from "../components/CategoryRow";
import { categories } from "../data/content";
import "./Page.css";

export default function Home() {
  return (
    <div>
      <Hero />
      <div className="page-content">
        <CategoryRow title="Movies" items={categories.movies.items} />
        <CategoryRow title="TV Series" items={categories.tvseries.items} />
        <CategoryRow title="Games" items={categories.games.items} />
        <CategoryRow title="Software & Tutorials" items={categories.software.items} />
      </div>
    </div>
  );
}
