import { useKoreanSeries } from "../hooks/useKoreanSeries";
import SeriesGrid from "../components/SeriesGrid";

const GENRES = ["Drama", "Comedy", "Mystery", "Crime", "Action", "Sci-Fi & Fantasy", "Romance", "Family", "War & Politics"];

export default function KoreanTV() {
  const { series, loading } = useKoreanSeries();
  return (
    <SeriesGrid
      series={series}
      loading={loading}
      genres={GENRES}
      title="Korean Drama"
      routePrefix="/series"
    />
  );
}
