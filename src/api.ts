import { useEffect, useState } from 'react';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign('/login');
    throw new Error('Your installation session expired. Sign in again.');
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

// Cancel obsolete reads when navigation changes. Polling only reads saved data;
// it never starts an audit, trial or provider connection test.
export function useResource<T>(path?: string, terminal?: (value: T) => boolean) {
  const [state, setState] = useState<{ path?: string; data?: T; error?: string }>({});
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const data = await api<T>(path, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ path, data });
        if (terminal && !terminal(data)) timer = setTimeout(poll, 1000);
      } catch (error) {
        if (!controller.signal.aborted) setState({ path, error: (error as Error).message });
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [path, terminal]);
  return state.path === path ? state : {};
}
