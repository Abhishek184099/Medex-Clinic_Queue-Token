import { useEffect, useRef, useState } from "react";
import type { QueueView } from "../api/clinic";

export function useFreshCalls(data: QueueView | null, durationMs = 6000): Set<string> {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;

    const current = new Set(data.nowServing.map((c) => `${c.doctorId}:${c.token}`));
    const previous = seen.current;
    seen.current = current;

    if (previous === null) return;

    const added = [...current].filter((key) => !previous.has(key));
    if (added.length === 0) return;

    setFresh((s) => new Set([...s, ...added]));
    setTimeout(() => {
      setFresh((s) => {
        const next = new Set(s);
        added.forEach((key) => next.delete(key));
        return next;
      });
    }, durationMs);
  }, [data, durationMs]);

  return fresh;
}