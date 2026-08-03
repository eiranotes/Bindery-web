# X/Twitter 로컬 수집기 검토 — 2026-08-03

## 결론

로컬 참가자·판매자 후기 참고 수집에는 `twscrape==0.19.2`를 사용합니다. 공식 행사
필드에는 이 자료를 쓰지 않고, Git에서 제외한 SQLite 계정 DB와 후기 JSONL에만
보관합니다. 공식 X API collector도 더 낮은 정책 위험의 선택지로 유지합니다.

## 최신성 스냅샷

| 후보 | 별 | 최근 소스 푸시 | 최신 릴리스 | 판단 |
| --- | ---: | --- | --- | --- |
| [twscrape](https://github.com/vladkens/twscrape) | 2,646 | 2026-07-31 | v0.19.2 · 2026-07-21 | 채택 |
| [Twikit](https://github.com/d60/twikit) | 4,596 | 2026-03-10 | version2.3.1 · 2025-02-06 | 보류 |
| [the-convocation/twitter-scraper](https://github.com/the-convocation/twitter-scraper) | 637 | 2026-04-01 | v0.22.3 · 2026-04-01 | Node 예비안 |
| [Tweety](https://github.com/mahrtayyab/tweety) | 670 | 2026-07-03 | GitHub 최신 릴리스 없음 | 예비안 |
| [snscrape](https://github.com/JustAnotherArchivist/snscrape) | 5,433 | 2023-11-15 | 최신 릴리스 없음 | 최신성 부족으로 제외 |

수치는 GitHub API로 당일 재확인한 스냅샷입니다. 별·최근 푸시는 유지보수 신호이지
정확성, 서비스 정책 적합성, 계정 안전 또는 장기 동작을 보장하지 않습니다.

## 선택 이유와 위험

- `twscrape`: 검색 기본값이 Latest이고, 비동기 스트림·계정 풀 SQLite·rate-limit 계정
  전환·JSONL CLI가 있어 현재 로컬 파이프라인과 잘 맞습니다.
- `the-convocation/twitter-scraper`: 2026-03-31 SearchTimeline 404 수정 뒤 바로
  v0.22.3이 나와 실질 유지보수가 보입니다. 다만 README가 프런트엔드 API의 잦은 파손과
  로그인 계정 차단 가능성을 직접 경고합니다.
- `Twikit`/`Tweety`: 관심과 기능은 충분하지만 읽기 전용 수집보다 자동 게시·DM 등 범위가
  넓고, 현재 요구에는 계정 풀·출력 경계가 더 명확한 `twscrape`가 적합합니다.

비공식 수집기는 X 내부 엔드포인트 변경으로 예고 없이 중단될 수 있습니다. 계정 구매,
프록시 구매, 대량 회피 자동화는 이 저장소의 실행 경로에 넣지 않으며, 실제 운영 전에는
수집량·보존기간·접근 권한과 서비스 약관을 다시 검토합니다.
