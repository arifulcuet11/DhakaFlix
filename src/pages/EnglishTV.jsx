import { useEnglishTV } from "../hooks/useEnglishTV";
import SeriesGrid from "../components/SeriesGrid";

const GENRES = ["Drama", "Crime", "Comedy", "Sci-Fi & Fantasy", "Mystery", "Action", "Family", "War & Politics", "Western"];

export default function EnglishTV() {
  const { series, loading } = useEnglishTV();
  return (
    <SeriesGrid
      series={series}
      loading={loading}
      genres={GENRES}
      title="English TV Series"
      routePrefix="/tv"
    />
  );
}
