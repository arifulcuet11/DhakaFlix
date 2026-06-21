import { useState, useEffect } from "react";

let cache = null;
let promise = null;

function fetchMovies() {
  if (cache) return Promise.resolve(cache);
  if (!promise) {
    promise = fetch(import.meta.env.BASE_URL + "foreign-movies.json")
      .then(r => r.json())
      .then(data => { cache = data; return data; })
      .catch(() => { promise = null; return []; });
  }
  return promise;
}

export function useForeignMovies() {
  const [movies, setMovies]   = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setMovies(cache); setLoading(false); return; }
    fetchMovies().then(data => { setMovies(data); setLoading(false); });
  }, []);

  return { movies, loading };
}
