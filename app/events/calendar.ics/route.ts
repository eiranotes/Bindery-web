import { events } from "../../lib/data.ts";

function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}

function utc(value: string) {
  return new Date(value)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function compactDate(value: string) {
  return value.replaceAll("-", "");
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function icsDates(start: string, end = start) {
  if (isDateOnly(start) && isDateOnly(end)) {
    return [
      `DTSTART;VALUE=DATE:${compactDate(start)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDate(end))}`,
    ];
  }
  return [`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`];
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const host = url.origin;
  const requestedIds = (url.searchParams.get("event") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const kind = url.searchParams.get("kind");
  const entryKind = kind === "event" || kind === "deadline" ? kind : "all";
  const selectedEvents = requestedIds.length
    ? requestedIds.flatMap((id) => {
        const event = events.find((candidate) => candidate.id === id);
        return event ? [event] : [];
      })
    : events;
  if (requestedIds.length && selectedEvents.length !== new Set(requestedIds).size) {
    return new Response("Unknown event", { status: 404 });
  }
  const entries = selectedEvents.flatMap((event) => {
    const eventEntry = [
      "BEGIN:VEVENT",
      `UID:${event.id}-event@bindery`,
      `DTSTAMP:${utc(new Date().toISOString())}`,
      ...icsDates(event.startDate, event.endDate),
      `SUMMARY:${escapeIcs(event.name)}`,
      ...(event.venue
        ? [`LOCATION:${escapeIcs([event.venue, event.address].filter(Boolean).join(", "))}`]
        : []),
      `URL:${host}/events/${event.slug}/${event.edition}`,
      "END:VEVENT",
    ].join("\r\n");
    if (!event.applicationDeadline) {
      return entryKind === "deadline" ? [] : [eventEntry];
    }
    const deadlineEntry = [
      "BEGIN:VEVENT",
      `UID:${event.id}-deadline@bindery`,
      `DTSTAMP:${utc(new Date().toISOString())}`,
      ...icsDates(event.applicationDeadline),
      `SUMMARY:${escapeIcs(`${event.shortName} ${event.applicationDeadlineLabel ?? "신청 마감"}`)}`,
      `DESCRIPTION:${escapeIcs("신청 전 공식 원문을 확인하세요.")}`,
      `URL:${host}/events/${event.slug}/${event.edition}`,
      "END:VEVENT",
    ].join("\r\n");
    if (entryKind === "deadline") return [deadlineEntry];
    if (entryKind === "event") return [eventEntry];
    return [deadlineEntry, eventEntry];
  });
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bindery//Creator Events//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...entries,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${
        selectedEvents.length === 1 ? selectedEvents[0].id : "bindery-events"
      }-${entryKind}.ics"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
