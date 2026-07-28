export const COMMUNITY_CATEGORY_CATALOG = [
  {
    id: "event",
    label: "행사 준비",
    description: "신청, 부스, 반입, 현장 운영",
  },
  {
    id: "production",
    label: "제작·발주",
    description: "인쇄, 포장, 제작업체 이용 경험",
  },
  {
    id: "cost",
    label: "가격·원가",
    description: "단가, 수량, 손익 계산",
  },
  {
    id: "business",
    label: "사업자·세금",
    description: "사업 운영과 행정 절차",
  },
  {
    id: "copyright",
    label: "저작권",
    description: "창작물 권리와 라이선스",
  },
  {
    id: "shipping",
    label: "판매·배송",
    description: "온라인 판매, 포장, 고객 응대",
  },
  {
    id: "chat",
    label: "자유 대화",
    description: "정보 분류에 들지 않는 가벼운 이야기",
  },
] as const;

export type CommunityCategoryId =
  (typeof COMMUNITY_CATEGORY_CATALOG)[number]["id"];

export type CommunityBoardId = "artists" | "general";
export type CommunityAudience = "verified-artist" | "public";
export type CommunityPostStatus =
  | "답변 대기"
  | "해결"
  | "최신 확인 필요"
  | "경험 공유";

export type CommunityBoard = {
  id: CommunityBoardId;
  title: string;
  shortTitle: string;
  path: `/community/${CommunityBoardId}`;
  audience: CommunityAudience;
  audienceLabel: string;
  description: string;
  purpose: string;
};

export type CommunityPost = {
  slug: string;
  boardId: CommunityBoardId;
  categoryId: CommunityCategoryId;
  title: string;
  excerpt: string;
  body: string[];
  author: string;
  authorLabel: "방문자 역할" | "작가 역할";
  publishedAt: string;
  updatedAt: string;
  status: CommunityPostStatus;
  commentCount: number;
  usefulCount: number;
  tags: string[];
  pinned?: boolean;
  source?: {
    label: string;
    url: string;
    checkedAt: string;
  };
  related?: {
    label: string;
    path: string;
  };
};

export const communityBoards: CommunityBoard[] = [
  {
    id: "artists",
    title: "작가 인증 게시판",
    shortTitle: "작가 게시판",
    path: "/community/artists",
    audience: "verified-artist",
    audienceLabel: "작가 인증 후 읽기·쓰기",
    description:
      "행사 참가와 제작 실무처럼 공개하기 조심스러운 정보를 인증 작가끼리 나누는 자유게시판입니다.",
    purpose:
      "작가 인증은 활동 자격을 확인하는 신호이며, 게시글 내용의 사실 검증을 뜻하지 않습니다.",
  },
  {
    id: "general",
    title: "모두의 게시판",
    shortTitle: "모두의 게시판",
    path: "/community/general",
    audience: "public",
    audienceLabel: "누구나 읽기",
    description:
      "작가, 예비 작가, 문구를 좋아하는 사람이 함께 질문하고 경험을 정리하는 자유게시판입니다.",
    purpose:
      "실무 정보와 출처가 있는 글을 먼저 찾을 수 있게 분류하고, 자유 대화는 별도 범주로 둡니다.",
  },
];

export const communityPosts: CommunityPost[] = [
  {
    slug: "first-booth-card-reader-checklist",
    boardId: "general",
    categoryId: "event",
    title: "첫 부스 전에 카드 결제 준비를 어디까지 해야 할까요",
    excerpt:
      "현금·계좌이체만 준비했을 때 생길 수 있는 문제와 카드 단말기 대여 확인 항목을 묻습니다.",
    body: [
      "처음 오프라인 행사에 참가합니다. 현금과 계좌이체 안내만 준비해도 되는지, 카드 결제 수단을 꼭 마련해야 하는지 궁금합니다.",
      "단말기를 빌린다면 통신 상태, 영수증 출력, 취소 처리, 정산 입금일 가운데 무엇을 먼저 확인하면 좋을까요. 실제 행사 경험을 기준으로 준비 순서를 나눠 주세요.",
    ],
    author: "종이산책",
    authorLabel: "방문자 역할",
    publishedAt: "2026-07-25",
    updatedAt: "2026-07-25",
    status: "답변 대기",
    commentCount: 4,
    usefulCount: 18,
    tags: ["첫 부스", "결제", "체크리스트"],
    pinned: true,
    related: {
      label: "첫 부스 체크리스트",
      path: "/notes/first-booth-checklist",
    },
  },
  {
    slug: "small-run-sticker-proofing",
    boardId: "general",
    categoryId: "production",
    title: "소량 스티커 발주 전에 교정본에서 확인할 순서",
    excerpt:
      "칼선, 흰색 인쇄, 코팅, 재단 여백을 한 번에 확인하기 위한 교정 순서를 정리합니다.",
    body: [
      "소량 스티커를 처음 맡기면서 화면 색과 실물 색 차이보다 칼선과 흰색 인쇄 누락이 더 자주 문제된다는 이야기를 들었습니다.",
      "교정 PDF를 받을 때 칼선 레이어, 흰색 인쇄 범위, 코팅 방향, 재단 여백을 어떤 순서로 보면 누락을 줄일 수 있는지 경험을 모으고 싶습니다.",
    ],
    author: "바늘종이",
    authorLabel: "작가 역할",
    publishedAt: "2026-07-24",
    updatedAt: "2026-07-25",
    status: "해결",
    commentCount: 9,
    usefulCount: 31,
    tags: ["스티커", "교정", "소량 발주"],
  },
  {
    slug: "booth-price-break-even",
    boardId: "general",
    categoryId: "cost",
    title: "부스비와 교통비까지 포함한 손익분기 계산 방식",
    excerpt:
      "제작 원가만 볼 때 빠지는 행사 고정비를 한 표로 계산하는 방식을 비교합니다.",
    body: [
      "상품 제작 원가와 판매가만으로 계산하면 행사 참가 뒤 실제 남는 금액이 예상과 크게 달라졌습니다.",
      "부스비, 교통, 숙박, 식비, 결제 수수료, 폐기 가능 재고를 어떤 항목으로 나눠야 다음 행사에도 재사용할 수 있는 계산표가 되는지 의견을 구합니다.",
    ],
    author: "모서리상점",
    authorLabel: "작가 역할",
    publishedAt: "2026-07-22",
    updatedAt: "2026-07-24",
    status: "최신 확인 필요",
    commentCount: 12,
    usefulCount: 42,
    tags: ["부스비", "손익분기", "원가"],
    related: {
      label: "부스 손익분기 노트",
      path: "/notes/booth-break-even",
    },
  },
  {
    slug: "simple-tax-business-start",
    boardId: "general",
    categoryId: "business",
    title: "간이과세자로 시작할 때 공식 안내에서 먼저 볼 부분",
    excerpt:
      "등록 자체보다 과세유형, 현금영수증, 통신판매업 확인 순서를 묻는 정보 질문입니다.",
    body: [
      "굿즈 판매를 시작하면서 블로그 요약마다 설명이 달라 국세청 공식 안내를 기준으로 순서를 잡으려 합니다.",
      "사업자등록, 과세유형 확인, 현금영수증 가맹, 통신판매업 신고 가운데 개인 상황에 따라 달라지는 부분을 구분해서 보고 싶습니다. 아래 원문은 확인했지만 실제 적용은 전문가에게 다시 확인할 예정입니다.",
    ],
    author: "첫종이",
    authorLabel: "방문자 역할",
    publishedAt: "2026-07-20",
    updatedAt: "2026-07-23",
    status: "최신 확인 필요",
    commentCount: 6,
    usefulCount: 27,
    tags: ["사업자등록", "간이과세", "공식 원문"],
    source: {
      label: "국세청 사업자등록 안내",
      url: "https://www.nts.go.kr/",
      checkedAt: "2026-07-23",
    },
    related: {
      label: "간이과세 시작 노트",
      path: "/notes/simple-tax-start",
    },
  },
  {
    slug: "packing-table-favorite-tools",
    boardId: "general",
    categoryId: "chat",
    title: "포장 작업대에 늘 올려두는 문구 하나씩 추천해요",
    excerpt:
      "배송 실수 방지에 실제로 도움이 된 작은 문구와 사용 이유를 가볍게 나눕니다.",
    body: [
      "작업대가 자꾸 복잡해져 꼭 쓰는 도구만 남겨 보려 합니다. 저는 주문서에 바로 표시할 수 있는 얇은 형광펜을 가장 자주 씁니다.",
      "테이프 커터, 날짜 스탬프, 체크용 펜처럼 포장 실수를 줄이는 데 도움이 된 문구가 있다면 하나와 사용 이유를 함께 적어 주세요.",
    ],
    author: "봉투수집가",
    authorLabel: "방문자 역할",
    publishedAt: "2026-07-19",
    updatedAt: "2026-07-19",
    status: "경험 공유",
    commentCount: 15,
    usefulCount: 19,
    tags: ["포장", "작업대", "문구 추천"],
  },
];

export function getCommunityBoard(
  boardId: string | null | undefined,
): CommunityBoard | undefined {
  return communityBoards.find((board) => board.id === boardId);
}

export function getCommunityCategory(
  categoryId: string | null | undefined,
) {
  return COMMUNITY_CATEGORY_CATALOG.find(
    (category) => category.id === categoryId,
  );
}

export function getCommunityPost(slug: string) {
  return communityPosts.find((post) => post.slug === slug);
}

export function getCommunityPostPath(post: CommunityPost) {
  return `/community/${post.boardId}/${post.slug}` as const;
}

export function filterCommunityPosts({
  categoryId,
  order,
}: {
  categoryId?: CommunityCategoryId;
  order: "helpful" | "latest";
}) {
  const posts = categoryId
    ? communityPosts.filter((post) => post.categoryId === categoryId)
    : [...communityPosts];

  return posts.sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    if (order === "helpful") {
      return right.usefulCount - left.usefulCount;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}
