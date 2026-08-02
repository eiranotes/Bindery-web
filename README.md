# Bindery

바인더리는 독립 문구·일러스트 창작자가 행사 신청 마감, 참가 조건,
준비 노트, 공동구매 현황과 업계 공지를 한곳에서 확인하는 정보
바인더입니다.

이 저장소는 GPT Sites용 vinext/React 구현입니다. 현재 공개 데이터는
제품 검증용 예시이며, 신청·비용·일정의 최종 판단은 각 화면에서 연결하는
공식 원문을 기준으로 해야 합니다.

소스 원격은 비공개 GitHub 저장소
[`eiranotes/Bindery-web`](https://github.com/eiranotes/Bindery-web)입니다.

## 제공 화면

- `/` — 가까운 신청 마감 3건과 다섯 개 정보 축
- `/events` — URL로 공유되는 행사 필터와 비교 목록
- `/events/calendar` — 신청 마감·행사 시작 달력
- `/events/[slug]/[edition]` — 회차별 조건, 현장 정보, 지난 회차와 후기 공개 경계
- `/notes`, `/news` — 날짜와 출처가 명시된 실무 정보
- `/groupbuy` — 결제·정산을 중개하지 않는 읽기 전용 현황
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

## 테마 카탈로그

시각 테마의 단일 원본은 `app/lib/themes.ts`의 `THEME_CATALOG`입니다. 새
테마를 추가하거나 기존 테마를 교체할 때는 컴포넌트 CSS를 복제하지 않고
카탈로그 항목의 전체 토큰과 표시 이름만 관리합니다. 레이아웃과 의미 상태는
공통으로 유지되고, 선택한 테마 ID만 기기 로컬 저장소에 남습니다.

## 커뮤니티와 광고 슬롯

커뮤니티의 단일 데이터 원본은 `app/lib/community.ts`입니다. 게시판 접근
정책, 정보 분류, 예시 글, URL 필터와 상세 경로를 이 모듈에서 관리합니다.
작가 게시판은 `verified-artist`, 모두의 게시판은 `public` 대상으로 분리하며,
Supabase Auth/Postgres/RLS 기반으로 게시·댓글·신고·운영 조치, 작가 신청과
초대, 이의제기, 지식화, 권한 안전 검색, 수신자 알림, 행사·커뮤니티 글 계정
Binder 경계가 소스와 실제 로컬 PostgreSQL 테스트까지 구축됐습니다. 구성된
런타임에서는 이 영속 기능만 사용하고, 미구성 런타임에서는 예시 모두의
게시판과 기기 초안을 명시적
fallback으로 유지합니다. 아직 운영 Supabase 프로젝트와 Sites 런타임 값은
연결하지 않았으므로 현재 배포에서는 변경 작업과 작가 게시판이 계속 실패
폐쇄됩니다.

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
광고 예약 위치와 형식은 `app/components/AdSlot.tsx`의
`AD_PLACEMENTS`에서 관리합니다. 홈 하단, 커뮤니티 허브, 모두의 게시판
피드에 고정 높이 공간만 두며 실제 광고 스크립트는 없습니다.

## 제품 경계

- 실제 결제, 정산, 환불, 분쟁 조정은 제공하지 않습니다.
- 후기 응답은 5건 이상일 때만 익명 집계로 표시합니다.
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
