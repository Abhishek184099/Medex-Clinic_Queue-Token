import type { ReactNode } from "react";
import type { QueueView } from "../api/clinic";
import { Notice } from "./Notice";

export function QueueState({
  data,
  error,
  children,
}: {
  data: QueueView | null;
  error: string | null;
  children: (view: QueueView) => ReactNode;
}) {
  if (error) {
    return (
      <Notice tone="error">
        {error} The queue is hidden until the server responds. Retrying…
      </Notice>
    );
  }
  if (!data) return <Notice>Loading queue…</Notice>;
  return <>{children(data)}</>;
}