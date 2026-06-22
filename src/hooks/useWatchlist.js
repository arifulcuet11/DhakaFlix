import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "dhakaflix_watchlist";

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Module-level listeners so all hook instances stay in sync
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn());
}

export function useWatchlist() {
  const [list, setList] = useState(load);

  useEffect(() => {
    const refresh = () => setList(load());
    listeners.add(refresh);
    return () => listeners.delete(refresh);
  }, []);

  const isInList = useCallback((id) => {
    return list.some(item => item.id === id);
  }, [list]);

  const toggle = useCallback((item) => {
    const current = load();
    const exists = current.some(i => i.id === item.id);
    const next = exists
      ? current.filter(i => i.id !== item.id)
      : [{ ...item, addedAt: Date.now() }, ...current];
    save(next);
    setList(next);
    notify();
  }, []);

  const remove = useCallback((id) => {
    const next = load().filter(i => i.id !== id);
    save(next);
    setList(next);
    notify();
  }, []);

  return { list, isInList, toggle, remove };
}
