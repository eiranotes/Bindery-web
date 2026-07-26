"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { events } from "../lib/data";
import {
  BOOKMARKS_CHANGED_EVENT,
  readBookmarkRecord,
  removeBookmark,
  writeBookmarkRecord,
} from "../lib/bookmarks";
import { eventPath, formatDateRange } from "../lib/events";
import type { EventEdition } from "../lib/types";

const knownEventIds = events.map((event) => event.id);

function getSavedEvents(): EventEdition[] {
  const record = readBookmarkRecord(window.localStorage, knownEventIds);
  const byId = new Map(events.map((event) => [event.id, event]));

  return record.eventIds
    .map((id) => byId.get(id))
    .filter((event): event is EventEdition => event !== undefined);
}

export function BinderClient() {
  const [savedEvents, setSavedEvents] = useState<EventEdition[] | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const syncFromStorage = () => setSavedEvents(getSavedEvents());

    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, syncFromStorage);
    };
  }, []);

  function remove(eventId: string) {
    const current = readBookmarkRecord(window.localStorage, knownEventIds);
    const next = removeBookmark(current, eventId, knownEventIds);

    if (!writeBookmarkRecord(window.localStorage, next)) {
      setFeedback("이 브라우저에서는 기기 저장소를 변경할 수 없습니다.");
      return;
    }

    window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
    setSavedEvents(getSavedEvents());
    setFeedback("내 바인더에서 뺐습니다.");
  }

  if (savedEvents === null) {
    return (
      <p className="binder-loading" role="status" aria-live="polite">
        이 기기에 꽂아 둔 페이지를 확인하는 중입니다.
      </p>
    );
  }

  if (savedEvents.length === 0) {
    return (
      <>
        <section className="binder-empty" aria-labelledby="binder-empty-title">
          <p className="entry-index" aria-hidden="true">
            00
          </p>
          <div>
            <h2 id="binder-empty-title">아직 꽂아 둔 행사가 없습니다.</h2>
            <p>
              행사 페이지에서 ‘내 바인더에 넣기’를 누르면 이곳에 준비할
              목록이 생깁니다.
            </p>
            <Link className="text-link" href="/events">
              행사 찾아보기
            </Link>
          </div>
        </section>
        <span className="bookmark-feedback" role="status" aria-live="polite">
          {feedback}
        </span>
      </>
    );
  }

  return (
    <>
      <section className="binder-saved" aria-labelledby="binder-saved-title">
        <div className="section-heading">
          <p className="eyebrow">SAVED PAGES</p>
          <h2 id="binder-saved-title">
            꽂아 둔 행사{" "}
            <span className="section-count">{savedEvents.length}</span>
          </h2>
        </div>
        <ol className="binder-list">
          {savedEvents.map((event, index) => (
            <li className="binder-list-item" key={event.id}>
              <p className="entry-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div className="binder-list-copy">
                <p className="entry-meta">
                  {formatDateRange(event)} · {event.region} · {event.venue}
                </p>
                <h3>
                  <Link href={eventPath(event)}>{event.name}</Link>
                </h3>
                <p>{event.summary}</p>
              </div>
              <button
                type="button"
                className="text-action"
                onClick={() => remove(event.id)}
              >
                내 바인더에서 빼기
              </button>
            </li>
          ))}
        </ol>
      </section>
      <span className="bookmark-feedback" role="status" aria-live="polite">
        {feedback}
      </span>
    </>
  );
}

export default BinderClient;
