import { useParams } from "react-router-dom";
import { categories } from "../data/content";
import CategoryRow from "../components/CategoryRow";
import "./Page.css";

export default function CategoryPage() {
  const { slug } = useParams();
  const cat = categories[slug];

  if (!cat) return (
    <div className="page-hero">
      <h1>Not Found</h1>
      <p>This category does not exist.</p>
    </div>
  );

  return (
    <div>
      <div className="page-hero">
        <h1>{cat.label}</h1>
        <p>{cat.items.length} categories available</p>
      </div>
      <div className="page-content">
        <CategoryRow title={`All ${cat.label}`} items={cat.items} />
      </div>
    </div>
  );
}
