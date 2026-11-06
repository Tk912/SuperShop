import { useEffect, useState } from 'react';
import { api, type Meta } from './api';

let cached: Meta | null = null;

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const fetchMeta = () =>
    api.meta().then((m) => { cached = m; setMeta(m); setError(null); }).catch((e) => setError(String(e.message ?? e)));
  useEffect(() => { if (!cached) fetchMeta(); }, []);
  return { meta, error, retry: () => { setError(null); fetchMeta(); } };
}
