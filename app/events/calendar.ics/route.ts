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

export function GET(request: Request) {
  const host = new URL(request.url).origin;
  const entries = events.flatMap((event) => [
    [
      "BEGIN:VEVENT",
      `UID:${event.id}-deadline@bindery`,
      `DTSTAMP:${utc(new Date().toISOString())}`,
      `DTSTART:${utc(event.applicationDeadline)}`,
      `DTEND:${utc(event.applicationDeadline)}`,
      `SUMMARY:${escapeIcs(`${event.shortName} 신청 마감`)}`,
      `DESCRIPTION:${escapeIcs("신청 전 공식 원문을 확인하세요.")}`,
      `URL:${host}/events/${event.slug}/${event.edition}`,
      "END:VEVENT",
    ].join("\r\n"),
    [
      "BEGIN:VEVENT",
      `UID:${event.id}-event@bindery`,
      `DTSTAMP:${utc(new Date().toISOString())}`,
      `DTSTART:${utc(event.startDate)}`,
      `DTEND:${utc(event.endDate)}`,
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
