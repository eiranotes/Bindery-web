"use client";

import { useEffect, useState } from "react";

import { events } from "../lib/data";
import {
  addBookmark,
  BOOKMARKS_CHANGED_EVENT,
  readBookmarkRecord,
  removeBookmark,
  writeBookmarkRecord,
} from "../lib/bookmarks";

const knownEventIds = events.map((event) => event.id);

export interface BookmarkButtonProps {
  eventId: string;
  className?: string;
}

function containsEvent(eventId: string): boolean {
  return readBookmarkRecord(window.localStorage, knownEventIds).eventIds.includes(
    eventId,
  );
}

export function BookmarkButton({
  eventId,
  className = "",
}: BookmarkButtonProps) {
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const syncFromStorage = () => setSaved(containsEvent(eventId));

    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, syncFromStorage);
    };
  }, [eventId]);

  function toggleBookmark() {
    const current = readBookmarkRecord(window.localStorage, knownEventIds);
    const currentlySaved = current.eventIds.includes(eventId);
    const next = currentlySaved
      ? removeBookmark(current, eventId, knownEventIds)
      : addBookmark(current, eventId, knownEventIds);

    if (!writeBookmarkRecord(window.localStorage, next)) {
      setFeedback("이 브라우저에서는 기기 저장소를 사용할 수 없습니다.");
      return;
    }

    window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
    setSaved(next.eventIds.includes(eventId));
    setFeedback(
      currentlySaved
        ? "내 바인더에서 뺐습니다."
        : "이 기기의 내 바인더에 넣었습니다.",
    );
  }

  return (
    <span className="bookmark-control">
      <button
        type="button"
        className={`bookmark-button ${className}`.trim()}
        aria-pressed={saved}
        data-state={saved ? "saved" : "idle"}
        onClick={toggleBookmark}
      >
        {saved ? "내 바인더에서 빼기" : "내 바인더에 넣기"}
      </button>
      <span className="bookmark-feedback" role="status" aria-live="polite">
        {feedback}
      </span>
    </span>
  );
}

export default BookmarkButton;
