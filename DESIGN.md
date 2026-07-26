# Bindery Design System

## Direction

바인더리는 정보 사이트이자 조용한 작업 다이어리다. 첫 화면은 모든 기능을 펼친 대시보드가 아니라, 오늘 필요한 정보만 적힌 한 장의 플래너처럼 읽혀야 한다. 구조와 값은 Federal Blue가 잡고, 형광 핑크는 마감 신호에만, 옐로는 체크와 하이라이트에만 쓴다.

시각 구현의 북극성은 소스 작업트리의 `bindery/02_디자인/mockup_home.html`과 `mockup_event-detail.html`이다. 색상 바, Hahmlet 중심의 제목, Federal Blue 구조선, 형광 하이라이트, 선형 카드, D-day 미스레지스트레이션, 1120px 래퍼와 상세 화면의 본문/사이드 구성을 실제 UI에 옮긴다.

홈 정보 밀도는 HTML 목업을 그대로 복제하지 않는다. 사용자 피드백에 따라 히어로와 마감 3건, 네 개의 텍스트 인덱스만 유지한다. 캘린더, 필터, 비교 표, 뉴스 피드, 공동구매 상세는 각 하위 화면에서만 펼친다. `docs/design/bindery-north-star.png`는 이 제한된 정보량을 확인한 보조 스케치이며 HTML 목업보다 우선하지 않는다.

다이어리·문구 감성은 질감 이미지나 스티커 장식이 아니라 HTML 목업의 용지 면, 얇은 괘선, 날짜·D-day 표기와 정확한 타이포그래피로 만든다. 종이 요소를 중첩하거나 모서리를 찢은 듯 표현하지 않는다.

## Color

```css
--stock: #e7e6e0;
--stock-deep: #dcdad2;
--sheet: #f4f3ef;
--ink-blue: #3d5588;
--ink-pink: #ff48b0;
--ink-yellow: #ffe800;
--over-violet: #2e2a6b;
--over-green: #7a8a2e;
--text: #1b1d2a;
--text-soft: #5a5f72;
--text-faint: #767b8c;
--rule: #c9c7be;
--rule-ink: rgba(61, 85, 136, 0.28);
```

- 파랑은 제목, 링크, 구조, 포커스, 선택 상태에 쓴다.
- 핑크는 한 화면 두 지점 이내의 마감·경고·밑줄에만 쓴다. 본문 텍스트 색으로 쓰지 않는다.
- 옐로는 텍스트가 아니라 배경 하이라이트와 체크 표식에 쓴다.
- 크림, 베이지, 테라코타, 그라디언트, 다크 모드는 사용하지 않는다.

## Typography

- Display: Hahmlet, serif fallback. 페이지·섹션·행사·노트 제목에만 사용한다.
- Body: IBM Plex Sans KR, system sans fallback. 본문과 모든 조작 요소에 사용한다.
- Utility: Space Mono, monospace fallback. 날짜·금액·D-day·메타데이터에 사용한다.
- 본문은 1rem 이상, 1.65–1.75 행간, 장문 폭 68–72ch다.
- 큰 제목 자간은 `-0.035em`보다 좁히지 않는다.
- 숫자 표와 D-day에는 tabular figures를 켠다.

## Spacing and layout

4px 기반 스케일을 쓴다.

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.5rem;
--space-6: 2rem;
--space-7: 3rem;
--space-8: 4.5rem;
```

- 최대 콘텐츠 폭 1120px, 데스크톱 12컬럼, 기본 거터 24px.
- 카드와 입력의 최대 radius는 2px.
- 그림자 대신 1px 잉크 선과 용지 면 차이로 계층을 만든다.
- 섹션은 동일한 카드 그리드로 반복하지 않고, 원장·표·목록·캘린더의 정보 형태를 살린다.
- 메인은 최대 3개의 마감만 노출하고, 상세 정보는 명시적인 링크 뒤에 둔다.
- 모바일에서는 메인 정보량을 늘리지 않고 단일 열로 재구성한다. 하위 화면의 표와 캘린더만 핵심 필드를 보존해 압축한다.

## Signature interaction

D-day는 파란 외곽 숫자 위에 핑크 외곽 숫자를 `translate(2px, 1px)`로 어긋나게 올린다. 카드 hover 또는 `focus-within`에서 두 판이 250ms 안에 맞는다. 위 레이어는 `aria-hidden="true"`다. 이외의 스크롤 등장, 패럴랙스, 페이지 입장 애니메이션은 만들지 않는다.

## Components

- Header: 조용한 BINDERY 워드마크, 네 개 정보 축, 내 바인더.
- Home planner: 한 문장, 오늘 날짜, 가장 가까운 마감 3건, 전체 일정 링크.
- Deadline ledger: 행사명·장소·D-day를 한 줄에서 비교. 원문 확인일과 마감 시각은 하위 화면에서 제공.
- Stamp: 상태 텍스트가 항상 있고, 색은 보조 신호다.
- Event table/card: 데스크톱은 비교 표, 좁은 화면은 핵심 필드를 보존한 목록.
- Filter bar: 네이티브 컨트롤, URL 쿼리와 동기화, 초기화·결과 수 제공.
- Calendar: 개최일과 신청 마감일을 텍스트 범례와 서로 다른 선/면으로 구분.
- Data table: 파랑 헤더, 짝수행 sheet, 모바일 가로 스크롤과 첫 열 sticky.
- Notice: 공식 원문, 확인 시점, 정보 없음, 후기 N<5 같은 신뢰 경계를 문장으로 설명.
- Buttons: 행동을 그대로 적고, default/hover/focus/active/disabled/loading/success 상태를 갖는다.

## Copy

평서체를 쓰고 느낌표를 쓰지 않는다. “저장” 대신 “내 바인더에 넣기”, “공식 원문 확인”, “필터 초기화”처럼 행동을 그대로 쓴다. 빈 상태는 다음 행동을 제시하고, 에러는 사과보다 무엇이 어떻게 되지 않았는지를 설명한다.

## Quality bar

- 360px에서 가로 페이지 스크롤이 없다.
- 모든 링크와 버튼은 키보드 포커스가 보인다.
- 터치 조작 요소는 최소 44px다.
- 상태는 색만으로 구분하지 않는다.
- 폰트 실패 시 레이아웃이 유지된다.
- `prefers-reduced-motion`에서 미스레지스트레이션이 정적 상태가 된다.
