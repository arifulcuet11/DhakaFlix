import { useState, useEffect } from "react";

let _cache = null;
let _promise = null;

export function useBanglaMovies() {
  const [movies, setMovies] = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) { setMovies(_cache); setLoading(false); return; }
    if (!_promise) {
      _promise = fetch(import.meta.env.BASE_URL + "bangla-movies.json")
        .then(r => r.json())
        .then(data => { _cache = data; return data; });
    }
    _promise.then(data => { setMovies(data); setLoading(false); });
  }, []);

  return { movies, loading };
}
