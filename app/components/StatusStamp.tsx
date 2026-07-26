import type { EventStatus } from "../lib/types.ts";
import { statusLabels } from "../lib/events.ts";

export function StatusStamp({ status }: { status: EventStatus }) {
  return (
    <span className={`status-stamp status-stamp--${status}`}>
      {statusLabels[status]}
    </span>
  );
}
