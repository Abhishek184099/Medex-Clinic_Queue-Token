
import { useCallback, useEffect, useState } from "react";
import { errorMessage, getQueue, type QueueView } from "../api/clinic";

export function useQueue(intervalMs = 3000) {
  const [data, setData] = useState<QueueView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const queue = await getQueue();
      setData(queue);
      setError(null);
    } catch (err) {
      setData(null);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      try {
        const queue = await getQueue();

        if (!cancelled) {
          setData(queue);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(errorMessage(err));
        }
      }
    };

    void loadQueue();

    const timer = setInterval(() => {
      void loadQueue();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return { data, error, refresh };
}
