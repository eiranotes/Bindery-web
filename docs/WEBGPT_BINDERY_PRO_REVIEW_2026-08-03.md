# WebGPT Pro review: Bindery event-first UI

검토일: 2026-08-03

대상: `eiranotes/Bindery-web`의 현재 vinext/React 구현

모델: ChatGPT Pro

프로젝트: `Bindery-web`

## 검토에 넣은 프로젝트 소스

1. `docs/WEBGPT_BINDERY_REDESIGN_BRIEF.md`
2. `PRODUCT.md`
3. `DESIGN.md`
4. `docs/SITE_STRATEGY_AND_ROADMAP.md`
5. `docs/UI_UX_AUDIT_2026-08-02.md`
6. `docs/CONTENT_PIPELINE.md`

## 결론

새 시각 스타일이 부족한 것이 아니라 제품 전략과 실제 전역 탐색의 우선순위가
어긋난 것이 가장 큰 문제였다. 행사 데이터가 유입과 재방문의 중심이라고
정의했지만, 헤더와 홈은 행사·공동구매·소식·커뮤니티를 비슷한 무게로
보여주고 있었다.

### P0

- 헤더와 홈을 행사 검색, 비교, 회차 아카이브, 준비 노트 중심으로 재구성한다.
- 공동구매는 소스를 삭제하지 않고 공개 탐색, sitemap, 정적 배포에서 숨긴다.
- 커뮤니티는 행사 판단을 보충하는 3차 계층으로 내린다.
- 워드마크는 대문자 표기 변형 없이 `Bindery`로 통일한다.
- 테마 선택을 제거하고 제한된 4색 역할을 고정한다.
- 다국어 선택은 실제 번역 범위를 과장하지 않는 셸 단계부터 시작한다.

### P1

- `ko`를 기본 콘텐츠 언어로 유지한다.
- `한국어`, `English`, `日本語`, `中文`처럼 각 언어의 자기 이름을 선택지로
  쓴다.
- 행사명과 본문은 번역 데이터가 생기기 전까지 한국어 원문으로 명시한다.
- 공식 원문, 확인 날짜, 정보 없음, 표본 부족의 신뢰 경계를 계속 유지한다.
- 360px, 768px, 1280px에서 탐색 우선순위와 줄바꿈을 다시 검증한다.

### P2

- 실제 번역된 행사 메타데이터와 Notes를 단계적으로 추가한다.
- 고유 도메인과 서버 런타임을 정한 뒤 locale route와 SEO 대체 언어 정책을
  설계한다.
- 커뮤니티 경험을 행사 데이터나 Notes로 승격하는 운영 흐름을 실제 데이터로
  검증한다.

## 적용한 디자인 역할

| 역할 | 값 | 용도 |
|---|---|---|
| Surface | `#F4F3EF` | 배경과 용지 면 |
| Ink | `#1B1D2A` | 본문과 가장 강한 정보 |
| Structure Blue | `#3D5588` | 제목, 링크, 선, 포커스, 선택 |
| Deadline Pink | `#FF48B0` | 마감, 제한된 강조, D-day 어긋남 |

Pink는 본문 텍스트, 포커스 링, 단독 상태 신호로 쓰지 않는다. 나머지 회색과
옅은 면은 네 기본 역할을 혼합해 만든다.

## 최신 공식 가이드에서 채택한 원칙

- [Apple HIG Color](https://developer.apple.com/design/human-interface-guidelines/color):
  색은 의미를 돕되 유일한 정보 전달 수단이 되지 않게 한다.
- [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/):
  충분한 대비, 읽을 수 있는 계층, 예측 가능한 조작을 유지한다.
- [WCAG 2.2 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color):
  상태와 링크를 색만으로 구분하지 않는다.
- [WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible):
  모든 키보드 조작에 식별 가능한 포커스를 둔다.
- [USWDS Select a Language](https://designsystem.digital.gov/patterns/select-a-language/three-or-more-languages/):
  세 개 이상의 언어는 명시적 선택 컨트롤로 제공한다.
- [W3C Language Navigation](https://www.w3.org/International/questions/qa-navigation-select):
  국기 대신 언어의 자기 이름을 사용한다.
- [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html):
  좁은 화면에서도 핵심 정보가 양방향 스크롤에 갇히지 않게 한다.
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion):
  D-day 정렬 효과는 감소된 모션 설정에서 정적인 상태로 바꾼다.

## 보존한 Bindery 정체성

- 1120px 콘텐츠 폭과 낮은 라운드 값
- Hahmlet, IBM Plex Sans KR, Space Mono 역할 분리
- 얇은 구조선과 그림자 없는 원장형 정보 구성
- D-day의 파랑·핑크 미스레지스트레이션
- 공식 출처, 확인일, 정보 없음, 후기 비공개 경계
- vinext/React 구조와 GitHub Pages 정적 미리보기 계약

## 이번 적용 범위와 보류

이번 변경은 헤더, 홈 정보구조, 푸터, 색 역할, sitemap/robots, Pages export,
다국어 셸과 테스트를 다룬다. 행사 본문 번역, locale별 URL/SEO, Groupbuy 정책,
실운영 도메인, 외부 Supabase 연결은 포함하지 않는다.
