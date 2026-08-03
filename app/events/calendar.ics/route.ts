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
  const host = new URL(request.url).origin;
  const entries = events.flatMap((event) => [
    [
      "BEGIN:VEVENT",
      `UID:${event.id}-deadline@bindery`,
      `DTSTAMP:${utc(new Date().toISOString())}`,
      ...icsDates(event.applicationDeadline),
      `SUMMARY:${escapeIcs(`${event.shortName} ${event.applicationDeadlineLabel ?? "신청 마감"}`)}`,
      `DESCRIPTION:${escapeIcs("신청 전 공식 원문을 확인하세요.")}`,
      `URL:${host}/events/${event.slug}/${event.edition}`,
      "END:VEVENT",
    ].join("\r\n"),
    [
      "BEGIN:VEVENT",
      `UID:${event.id}-event@bindery`,
      `DTSTAMP:${utc(new Date().toISOString())}`,
      ...icsDates(event.startDate, event.endDate),
      `SUMMARY:${escapeIcs(event.name)}`,
      `LOCATION:${escapeIcs(`${event.venue}, ${event.address}`)}`,
      `URL:${host}/events/${event.slug}/${event.edition}`,
      "END:VEVENT",
    ].join("\r\n"),
  ]);
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
      "content-disposition": 'attachment; filename="bindery-events.ics"',
      "cache-control": "public, max-age=3600",
    },
  });
}
