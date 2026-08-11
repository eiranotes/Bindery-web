# Bindery

바인더리는 한국 독립 문구·일러스트 창작자가 지금 지원할 수 있는 행사를 찾고,
신청 마감·참가 조건과 과거 회차의 변화를 같은 구조로 비교해 준비하도록 돕는
참가 기회 레지스트리입니다. Notes와 행사 변경 기록은 판단과 준비를 보조하고,
Community는 로컬 경험을 참고하는 보조 계층으로 연결됩니다. Groupbuy는
정책·신뢰 기준이 준비될 때까지 공개 탐색과 배포에서 숨깁니다.

이 저장소는 GPT Sites용 vinext/React 구현입니다. 행사 화면은 허용 목록의 공식
원문을 수집·해시하고 필드별 근거를 편집자가 확인한 생성 데이터를 사용합니다.
신청·비용·일정의 최종 판단은 각 화면에서 연결하는 공식 원문을 기준으로 해야 합니다.

2026-08-11 기준 생성 카탈로그는 70개 회차입니다. 이 중 3개는 편집자가
공식 필드를 검수했고, 2개는 핵심 참가 판단 필드가 충분하며, 나머지 65개는
공식 일정과 원문을 찾을 수 있는 색인 상태입니다. 출처 접근 가능성과 참가
판단 가능성을 같은 상태로 취급하지 않습니다.

제품 전략과 단계별 데이터·운영 계획은
[`docs/SITE_STRATEGY_AND_ROADMAP.md`](docs/SITE_STRATEGY_AND_ROADMAP.md)를
기준으로 합니다. 행사 다음 단계의 문구작가 운영 정보 후보, 근거 계층, 수집 금지
대상과 8주 최소 데이터셋은
[`docs/STATIONERY_CREATOR_INFORMATION_COLLECTION.md`](docs/STATIONERY_CREATOR_INFORMATION_COLLECTION.md)에
정리되어 있습니다.

## 제공 화면

- `/` — 가까운 신청 마감 3건과 행사 비교·회차 아카이브 진입
- `/events` — URL로 공유되는 행사 필터와 현재 회차 목록
- `/events/compare` — 최대 3개 행사의 마감·비용·참가·현장 조건 비교
- `/events/archive` — 행사별 일정·장소·참가비·부스 수·선정 방식 회차 이력
- `/events/calendar` — 신청 마감·행사 시작 달력
- `/events/[slug]/[edition]` — 회차별 조건, 현장 정보, 지난 회차와 후기 공개 경계
- `/notes` — 제작·현장 노트와 공식 출처 19건을 연결한 개인사업자 세금·해외배송 통관 가이드
- `/notes/simple-tax-start` — 일반/간이 부가세, 종합소득세, 월별 증빙 준비 가이드
- `/notes/overseas-shipping-customs` — CN23·상업송장·수출신고·목적지 통관 분리 체크리스트
- `/news` — 날짜와 원문이 명시된 행사 변경 기록
- `/community` — 작가 인증 게시판과 모두의 게시판을 나누는 커뮤니티 허브
- `/community/artists` — 서버 세션과 작가 상태를 확인하고, 미연결·비회원·비작가 상태에서는 내용을 노출하지 않는 작가 전용 화면
- `/community/general`, `/community/general/[slug]` — 권한 안전 검색·필터와 모두의 게시판 글 상세
- `/community/write`, `/community/verify`, `/community/rules`, `/community/report` — 글 작성, 자동 임시 승인 신청, 운영 규칙과 신고 접수
- `/community/appeals/[id]` — 영향받은 작성자만 접근하는 14일 이의제기 화면
- `/auth/sign-in`, `/auth/callback` — Supabase 이메일 로그인과 서버 세션 교환 경계
- `/me`, `/me/notifications` — 기기/계정 Binder와 수신자 전용 커뮤니티 알림
- `/events/calendar.ics`, `/rss.xml` — 일정과 소식 피드

## 로컬 실행

Node.js `22.13.0` 이상이 필요합니다.

```bash
npm install
npm run dev
```

검증 명령:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:community-db
```

### 행사 콘텐츠 파이프라인

```bash
npm run content:pipeline
npm run content:guard
npm run content:check-generated
```

`content/`에는 공개 가능한 공식 사실, 출처 레코드, 필드 근거와 Markdown 수집
보고서만 둡니다. 원문 캐시는 `.content-cache/`, 참가자·판매자 후기 연구 자료는
`content-local/reviews/`에 두며 두 경로 모두 Git과 사이트 생성 입력에서 제외됩니다.
신뢰도 등급, X 공식 API 수집기, ArchiveBox 로컬 보관 절차는
[`docs/CONTENT_PIPELINE.md`](docs/CONTENT_PIPELINE.md)를 따릅니다.
`npm run content:pipeline`은 공식 원문 재수집, 후보 접근성 확인, 정규화,
검증, 생성, 재확인 대기열과 보고서 갱신까지 수행합니다. 2026-08-11 갱신에서
11개 편집 원문은 모두 접근 가능했고, 후보 전체는 104개 접근 가능·7개 HTTP
오류·5개 fetch 오류였습니다. 변경 또는 오류가 있는 14개 출처는
`content/queues/recheck.jsonl`에 남습니다.

`npm test`는 360×800, 768×1024, 1280×900 브라우저 검증도 포함합니다.
macOS에서는 설치된 Google Chrome을 사용하고, 다른 환경에서는 먼저
`npx playwright install chromium`으로 테스트 브라우저를 준비합니다.

### 커뮤니티 백엔드 설정

`cp .env.example .env.local` 후 Supabase 프로젝트의 공개 URL과 publishable
key, Cloudflare Turnstile의 공개 site key를 입력합니다.
Supabase 공개 값 두 개가 모두 유효할 때만 이메일 로그인과 서버 세션 확인이
켜지고, 공개 site key가 있어야 작가 신청 폼이 열립니다.
필수 값이 없거나 잘못되면 공개 정보는 계속 렌더링하되 회원 변경 작업과 작가
게시판은 실패 폐쇄합니다.

작가 신청의 Turnstile 검증과 임시 승인은
`supabase/functions/submit-artist-application`에서만 처리합니다. Function
secret은 `supabase/functions/.env.example`의 이름을 기준으로 Edge Function
환경에 설정합니다. `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`는 Supabase Function 런타임 값이며 Sites나
브라우저 환경변수로 복사하지 않습니다.

Supabase Auth의 허용 리디렉션에는 로컬 개발용
`http://127.0.0.1:3000/auth/callback`과 실제 배포 도메인의 `/auth/callback`을
등록해야 합니다. 호스팅 환경의 값은 Sites 런타임 설정으로 관리하며 소스에
실제 키를 커밋하지 않습니다. `service_role` 키와 `TURNSTILE_SECRET_KEY`는
Edge Function 밖으로 노출하지 않습니다. 특히 `service_role`은 RLS를
우회하므로 Sites 환경변수나 `NEXT_PUBLIC_*` 값으로 두지 않습니다.

로컬 RLS 검증은 전역 데이터베이스를 변경하지 않습니다.
`npm run test:community-db`가 임시 PostgreSQL 17 클러스터를 만들고 production
마이그레이션과 seed를 그대로 적용해 권한 행렬을 확인한 뒤 정리합니다.
기능별 실제 데이터베이스 계약은 같은 스크립트의 두 번째 인자로 확인합니다.

```bash
bash scripts/test-community-db.sh supabase/tests/community_operations.test.sql
bash scripts/test-community-db.sh supabase/tests/community_artist_board.test.sql
bash scripts/test-community-db.sh supabase/tests/community_moderation.test.sql
bash scripts/test-community-db.sh supabase/tests/community_knowledge.test.sql
bash scripts/test-community-db.sh supabase/tests/community_search.test.sql
bash scripts/test-community-db.sh supabase/tests/community_notifications.test.sql
bash scripts/test-community-db.sh supabase/tests/community_binder_sync.test.sql
bash scripts/test-community-db.sh supabase/tests/community_security_hardening.test.sql
bash scripts/test-community-db.sh supabase/tests/community_corrections_pagination.test.sql
bash scripts/test-community-db.sh supabase/tests/content_read_integrity.test.sql
```

`supabase/migrations/`가 스키마의 단일 배포 원본입니다. 파일명 순서대로 모두
적용한 뒤에만 런타임 값을 연결해야 합니다. 이 저장소 작업에서는 외부
Supabase 프로젝트 생성, 원격 마이그레이션, Sites 비밀값 설정을 실행하지
않았습니다.

## 행사 데이터 방향

공개 행사는 `content/catalog/`의 마스터·회차·출처·근거 컬렉션에서
`content/generated/events.json`과 `app/lib/generated/events.ts`로 결정적으로
생성됩니다. 목록·비교·상세는 핵심 필드 충족도, 원문 확인일과 재확인 기한을
표시하고, 회차 아카이브는 같은 마스터에 실제 공개 회차가 두 개 이상일 때만
노출합니다. 다음 데이터 목표는 단순 행사 수가 아니라 참가 판단 가능한
회차 15개와 핵심 필드별 누락·재확인 시간을 측정하는 것입니다.

## 색과 다국어 셸

시각 토큰의 단일 원본은 `app/lib/themes.ts`의 `THEME_CATALOG`입니다.
Surface, Ink, Structure Blue, Deadline Pink 네 역할만 기본색으로 두고 나머지
보조색은 이 값에서 파생합니다. 헤더의 언어 선택은 한국어·영어·일본어·중국어
셸을 기기 로컬에 저장하지만, 현재 행사명과 본문은 한국어 원문입니다. 실제
번역 콘텐츠가 없는 상태에서 문서 언어를 바꾸거나 전체 번역으로 표시하지
않습니다.

## 커뮤니티와 수익화 경계

커뮤니티의 단일 데이터 원본은 `app/lib/community.ts`입니다. 게시판 접근
정책, 정보 분류, 예시 글, URL 필터와 상세 경로를 이 모듈에서 관리합니다.
작가 게시판은 `verified-artist`, 모두의 게시판은 `public` 대상으로 분리하며,
Supabase Auth/Postgres/RLS 기반으로 게시·댓글·신고·운영 조치, 작가 신청과
초대, 이의제기, 지식화, 권한 안전 검색, 수신자 알림, 행사·커뮤니티 글 계정
Binder 경계가 소스와 실제 로컬 PostgreSQL 테스트까지 구축됐습니다. 구성된
런타임에서는 이 영속 기능만 사용하고, 미구성 런타임에서는 예시 모두의
게시판과 기기 초안을 명시적 fallback으로 유지합니다. 아직 운영 Supabase
프로젝트와 Sites 런타임 값은 연결하지 않았으므로 현재 배포에서는 변경 작업과
작가 게시판이 계속 실패 폐쇄됩니다.

초대 수락은 현재 커뮤니티 정책 버전에 대한 명시적 동의를 요구합니다.
검수·초대 취소·초대 만료 시각은 데이터베이스가 기록하며, 이벤트 Binder와
관련 행사 연결은 유지보수 카탈로그에 존재하는 행사만 허용합니다. 공개 수정
이력에는 편집자·사유·시각만 표시하고 이전 제목·본문 스냅샷은 공개하지
않습니다.

백엔드가 미구성된 글 작성 화면은 이 브라우저에 임시 글 한 건만 저장합니다.
구성된 환경에서는 서버 세션과 RLS를 통과한 요청만 게시합니다. 기기 초안은
암호화·자동 삭제되지 않으므로 공유 브라우저에서는 직접 지워야 하며, 삭제는
한 번 더 확인한 뒤 실행합니다. Binder의 계정 합치기는 로그인 사용자가 직접
실행하며 행사와 공개 커뮤니티 글을 함께 합칩니다. 성공·중복·부분 실패와
관계없이 기기 저장을 자동 삭제하지 않습니다.
`app/components/AdSlot.tsx`의 과거 광고 예약 컴포넌트는 정책 참고용으로만
남아 있고 현재 공개 라우트에서는 렌더링하지 않습니다. 실제 반복 사용과
수요가 검증되고 편집 독립성·동의·추적 정책이 승인되기 전에는 광고 공간도
제품 경험에 포함하지 않습니다.

## GitHub Pages 읽기 전용 스냅샷

`npm run pages:build`는 `dist-pages/`에 생성일이 표시된 정적 스냅샷을 만듭니다.
스크립트와 서버 기능을 제거하고 필터·비교 선택·월 이동·언어 전환·로그인·
Binder 저장·글쓰기를 비활성화합니다. Pages는 제품 데이터와 화면을 검토하는
공개 프리뷰이지, 동적 애플리케이션의 대체 배포가 아닙니다.

## 제품 경계

- 실제 결제, 정산, 환불, 분쟁 조정은 제공하지 않습니다.
- 참가자·판매자 후기는 현재 게시·집계하지 않고 로컬 운영 참고 자료로만 보관합니다.
- 커뮤니티는 자유게시판이지만 정보 분류와 출처 맥락을 우선합니다. 작가
  게시판은 서버가 임시 승인 또는 검수 완료 상태를 확인하기 전까지 읽기·
  쓰기를 모두 잠급니다. 모두의 게시판은 공개 열람, 정상 회원 작성·댓글·
  신고를 허용합니다.
- 신고 접수와 운영 대기열은 구현됐지만 DM, 개인 간 거래, 결제와 정산은
  제공하지 않습니다.
- 보호·변경 화면은 검색 사이트맵에서 제외하고, 공개 일반 글과 운영자가
  승격한 Note만 공개 정보 경계에 둡니다.
- 저장한 행사는 기본적으로 기기 로컬에 남으며, 로그인 사용자가 명시적으로
  합치면 계정 Binder에도 중복 없이 저장됩니다.
- 실제 운영 전 행사 데이터, 약관, 개인정보 처리방침과 공동구매 정책을
  제품 소유자가 확정해야 합니다.

제품·시각 기준은 `PRODUCT.md`와 `DESIGN.md`, 진행 상태와 결정 기록은
`docs/`에서 확인할 수 있습니다.
