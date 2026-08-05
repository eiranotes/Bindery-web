"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { events } from "../lib/data";
import {
  BOOKMARKS_CHANGED_EVENT,
  readBookmarkRecord,
  removeBookmark,
  removeCommunityPostBookmark,
  writeBookmarkRecord,
} from "../lib/bookmarks";
import { eventPath, formatDateRange } from "../lib/events";
import type { EventEdition } from "../lib/types";

const knownEventIds = events.map((event) => event.id);
const emptyAccountEventIds: string[] = [];
const emptyAccountCommunityPosts: AccountCommunityBookmark[] = [];

type AccountCommunityBookmark = {
  id: string;
  title: string;
  boardId: "general" | "artists";
};

type BinderSyncState = "unconfigured" | "signed_out" | "signed_in" | "error";

type BinderSyncResponse = {
  ok?: boolean;
  merged?: unknown[];
  conflicts?: unknown[];
  rejected?: unknown[];
  message?: string;
};

type SavedEvent = {
  event: EventEdition;
  local: boolean;
  account: boolean;
};

type SavedCommunityPost = AccountCommunityBookmark & {
  local: boolean;
  account: boolean;
};

function getSavedEvents(accountEventIds: readonly string[]): SavedEvent[] {
  const record = readBookmarkRecord(window.localStorage, knownEventIds);
  const byId = new Map(events.map((event) => [event.id, event]));
  const localIds = new Set(record.eventIds);
  const accountIds = new Set(accountEventIds);
  const allIds = [...record.eventIds];

  for (const id of accountEventIds) {
    if (!localIds.has(id)) allIds.push(id);
  }

  return allIds.flatMap((id) => {
    const event = byId.get(id);
    return event
      ? [{ event, local: localIds.has(id), account: accountIds.has(id) }]
      : [];
  });
}

function getSavedCommunityPosts(
  accountCommunityPosts: readonly AccountCommunityBookmark[],
): SavedCommunityPost[] {
  const localPosts = readBookmarkRecord(window.localStorage).communityPosts;
  const accountById = new Map(accountCommunityPosts.map((post) => [post.id, post]));
  const localIds = new Set(localPosts.map((post) => post.id));
  const saved = localPosts.map((post) => ({
    ...post,
    local: true,
    account: accountById.has(post.id),
  }));
  for (const post of accountCommunityPosts) {
    if (!localIds.has(post.id)) saved.push({ ...post, local: false, account: true });
  }
  return saved;
}

export function BinderClient({
  syncState = "unconfigured",
  accountEventIds = emptyAccountEventIds,
  accountCommunityPosts = emptyAccountCommunityPosts,
}: {
  syncState?: BinderSyncState;
  accountEventIds?: string[];
  accountCommunityPosts?: AccountCommunityBookmark[];
}) {
  const router = useRouter();
  const [savedEvents, setSavedEvents] = useState<SavedEvent[] | null>(null);
  const [savedCommunityPosts, setSavedCommunityPosts] = useState<SavedCommunityPost[] | null>(null);
  const [feedback, setFeedback] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setSavedEvents(getSavedEvents(accountEventIds));
      setSavedCommunityPosts(getSavedCommunityPosts(accountCommunityPosts));
    };

    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, syncFromStorage);
    };
  }, [accountCommunityPosts, accountEventIds]);

  function remove(eventId: string) {
    const current = readBookmarkRecord(window.localStorage, knownEventIds);
    const next = removeBookmark(current, eventId, knownEventIds);

    if (!writeBookmarkRecord(window.localStorage, next)) {
      setFeedback("이 브라우저에서는 기기 저장소를 변경할 수 없습니다.");
      return;
    }

    window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
    setSavedEvents(getSavedEvents(accountEventIds));
    setFeedback(
      accountEventIds.includes(eventId)
        ? "이 기기 저장에서 뺐습니다. 계정 Binder에는 남아 있습니다."
        : "내 바인더에서 뺐습니다.",
    );
  }

  function removeCommunityPost(postId: string) {
    const current = readBookmarkRecord(window.localStorage, knownEventIds);
    const next = removeCommunityPostBookmark(current, postId);
    if (!writeBookmarkRecord(window.localStorage, next)) {
      setFeedback("이 브라우저에서는 기기 저장소를 변경할 수 없습니다.");
      return;
    }
    window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
    setSavedCommunityPosts(getSavedCommunityPosts(accountCommunityPosts));
    setFeedback(
      accountCommunityPosts.some((post) => post.id === postId)
        ? "이 기기 저장에서 뺐습니다. 계정 Binder에는 남아 있습니다."
        : "내 Binder에서 글을 뺐습니다.",
    );
  }

  async function mergeWithAccount() {
    const local = readBookmarkRecord(window.localStorage, knownEventIds);
    if (local.eventIds.length === 0 && local.communityPosts.length === 0) return;

    setSyncing(true);
    setFeedback("");
    try {
      const response = await fetch("/api/community/binder-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            ...local.eventIds.map((id) => ({ kind: "event", id })),
            ...local.communityPosts.map((post) => ({ kind: "community_post", id: post.id })),
          ],
        }),
      });
      const result = (await response.json()) as BinderSyncResponse;
      const mergedCount = Array.isArray(result.merged)
        ? result.merged.length
        : 0;
      const rejectedCount = Array.isArray(result.rejected)
        ? result.rejected.length
        : 0;
      const conflictCount = Array.isArray(result.conflicts)
        ? result.conflicts.length
        : 0;

      if (rejectedCount > 0) {
        if (mergedCount > 0 || conflictCount > 0) router.refresh();
        setFeedback(
          mergedCount > 0
            ? `${mergedCount}개를 계정에 합쳤고, 합치지 못한 ${rejectedCount}개 항목은 이 기기에 그대로 남아 있습니다.`
            : `합치지 못한 ${rejectedCount}개 항목은 이 기기에 그대로 남아 있습니다.`,
        );
        return;
      }
      if (!response.ok || !result.ok) {
        setFeedback(result.message ?? "계정 Binder와 합치지 못했습니다.");
        return;
      }

      if (mergedCount === 0 && conflictCount > 0) {
        router.refresh();
        setFeedback(
          `${conflictCount}개 모두 이미 계정 Binder에 있습니다. 이 기기의 저장은 그대로 남아 있습니다.`,
        );
        return;
      }

      router.refresh();
      setFeedback(
        `계정 Binder와 ${mergedCount}개를 합쳤습니다.${
          conflictCount > 0 ? ` 이미 있던 ${conflictCount}개는 중복 저장하지 않았습니다.` : ""
        } 이 기기의 저장은 그대로 남아 있습니다.`,
      );
    } catch {
      setFeedback(
        "연결 문제로 합치지 못했습니다. 이 기기의 저장은 그대로 남아 있습니다.",
      );
    } finally {
      setSyncing(false);
    }
  }

  if (savedEvents === null || savedCommunityPosts === null) {
    return (
      <p className="binder-loading" role="status" aria-live="polite">
        이 기기에 꽂아 둔 페이지를 확인하는 중입니다.
      </p>
    );
  }

  if (savedEvents.length === 0 && savedCommunityPosts.length === 0) {
    return (
      <>
        <section className="binder-empty" aria-labelledby="binder-empty-title">
          <p className="entry-index" aria-hidden="true">
            00
          </p>
          <div>
            <h2 id="binder-empty-title">아직 꽂아 둔 페이지가 없습니다.</h2>
            <p>
              행사나 공개 커뮤니티 글에서 Binder 저장을 누르면 이곳에 다시 볼
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

  const localSaveCount =
    savedEvents.filter((saved) => saved.local).length +
    savedCommunityPosts.filter((saved) => saved.local).length;

  return (
    <>
      {syncState === "signed_in" && localSaveCount > 0 ? (
        <aside className="trust-notice" aria-labelledby="binder-sync-title">
          <p className="utility-text">ACCOUNT MERGE</p>
          <h2 id="binder-sync-title">이 기기의 저장을 계정 Binder와 합치기</h2>
          <p>
            직접 실행할 때만 계정으로 복사합니다. 성공하거나 일부 항목이 거절돼도
            이 기기의 원본은 지우지 않습니다.
          </p>
          <button
            className="button button--primary"
            disabled={syncing}
            onClick={mergeWithAccount}
            type="button"
          >
            {syncing ? "합치는 중…" : "계정 Binder와 합치기"}
          </button>
        </aside>
      ) : null}
      {savedEvents.length > 0 ? (
      <section className="binder-saved" aria-labelledby="binder-saved-title">
        <div className="section-heading">
          <p className="eyebrow">SAVED PAGES</p>
          <h2 id="binder-saved-title">
            꽂아 둔 행사{" "}
            <span className="section-count">{savedEvents.length}</span>
          </h2>
        </div>
        <ol className="binder-list">
          {savedEvents.map((saved, index) => (
            <li className="binder-list-item" key={saved.event.id}>
              <p className="entry-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div className="binder-list-copy">
                <p className="entry-meta">
                  {formatDateRange(saved.event)} · {saved.event.region} · {saved.event.venue ?? "장소 확인 중"}
                </p>
                <h3>
                  <Link href={eventPath(saved.event)}>{saved.event.name}</Link>
                </h3>
                <p>{saved.event.summary}</p>
                {saved.account ? (
                  <p className="entry-meta">
                    {saved.local ? "계정 Binder에도 저장됨" : "계정 Binder에 저장됨"}
                  </p>
                ) : null}
              </div>
              {saved.local ? (
                <button
                  type="button"
                  className="text-action"
                  onClick={() => remove(saved.event.id)}
                >
                  내 바인더에서 빼기
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      ) : null}
      {savedCommunityPosts.length > 0 ? (
        <section className="binder-saved" aria-labelledby="binder-community-title">
          <div className="section-heading">
            <p className="eyebrow">SAVED COMMUNITY</p>
            <h2 id="binder-community-title">
              꽂아 둔 커뮤니티 글{" "}
              <span className="section-count">{savedCommunityPosts.length}</span>
            </h2>
          </div>
          <ol className="binder-list">
            {savedCommunityPosts.map((saved, index) => (
              <li className="binder-list-item" key={saved.id}>
                <p className="entry-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div className="binder-list-copy">
                  <p className="entry-meta">
                    {saved.boardId === "general" ? "모두의 게시판" : "작가 인증 게시판"}
                  </p>
                  <h3><Link href={`/community/${saved.boardId}/${encodeURIComponent(saved.id)}`}>{saved.title}</Link></h3>
                  {saved.account ? (
                    <p className="entry-meta">
                      {saved.local ? "계정 Binder에도 저장됨" : "계정 Binder에 저장됨"}
                    </p>
                  ) : null}
                </div>
                {saved.local ? (
                  <button className="text-action" onClick={() => removeCommunityPost(saved.id)} type="button">
                    내 Binder에서 빼기
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <span className="bookmark-feedback" role="status" aria-live="polite">
        {feedback}
      </span>
    </>
  );
}

export default BinderClient;
