import Link from "next/link";

import {
  communityBoards,
  type CommunityBoardId,
} from "../lib/community";

type CommunityBoardNavProps = {
  current?: CommunityBoardId;
};

export function CommunityBoardNav({ current }: CommunityBoardNavProps) {
  return (
    <nav className="community-board-nav" aria-label="커뮤니티 게시판">
      <Link href="/community" aria-current={!current ? "page" : undefined}>
        게시판 안내
      </Link>
      {communityBoards.map((board) => (
        <Link
          key={board.id}
          href={board.path}
          aria-current={current === board.id ? "page" : undefined}
        >
          {board.title}
        </Link>
      ))}
    </nav>
  );
}
