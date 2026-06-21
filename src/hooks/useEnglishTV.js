import { useState, useEffect } from "react";

let cache = null;
let promise = null;

function fetchSeries() {
  if (cache) return Promise.resolve(cache);
  if (!promise) {
    promise = fetch(import.meta.env.BASE_URL + "english-tv.json")
      .then(r => r.json())
      .then(data => { cache = data; return data; })
      .catch(() => { promise = null; return []; });
  }
  return promise;
}

export function useEnglishTV() {
  const [series, setSeries]   = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setSeries(cache); setLoading(false); return; }
    fetchSeries().then(data => { setSeries(data); setLoading(false); });
  }, []);

  return { series, loading };
}
