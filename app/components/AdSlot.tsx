export const AD_PLACEMENTS = {
  "home-lower": {
    format: "leaderboard",
    description: "홈 정보 인덱스 아래",
  },
  "community-hub": {
    format: "leaderboard",
    description: "커뮤니티 게시판 선택 아래",
  },
  "community-general-feed": {
    format: "in-feed",
    description: "모두의 게시판 정보 글 사이",
  },
} as const;

export type AdPlacementId = keyof typeof AD_PLACEMENTS;

type AdSlotProps = {
  placement: AdPlacementId;
};

export function AdSlot({ placement }: AdSlotProps) {
  const config = AD_PLACEMENTS[placement];

  return (
    <aside
      className={`ad-slot ad-slot--${config.format}`}
      aria-label="광고 영역"
      data-ad-format={config.format}
      data-ad-placement={placement}
    >
      <p className="ad-slot__label">광고</p>
      <p>광고 영역 준비 중</p>
      <span>{config.description}</span>
    </aside>
  );
}
