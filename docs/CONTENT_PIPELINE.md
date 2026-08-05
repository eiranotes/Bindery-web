# 공식 콘텐츠·로컬 후기 파이프라인

## 목표와 경계

Bindery 사이트에는 확인된 행사 공식 정보만 생성합니다. 참가자·판매자 후기는 행사
후보 발굴과 재확인 단서로만 쓰며, 공개 데이터·집계·검색 인덱스에 합류하지 않습니다.

```text
공식 허용 목록/등록 후보 배치 → 원문 캐시·접근성 감사 → SourceRecord → FieldEvidence → 정규화 → 사이트 생성
커뮤니티 URL → 공식 API/twscrape/수동 import → 익명화 JSONL → 로컬 ArchiveBox (공개 경로 없음)
```

## 공식 정보 신뢰도

| 등급 | 자료 | 공개 필드 사용 |
| --- | --- | --- |
| S1 | 주최자 공식 사이트·신청 안내·공식 PDF | 일정, 신청, 비용, 환불, 운영 |
| S2 | 전시장·공공기관 공식 페이지 | 장소, 주소, 운영 주체 |
| S3 | 주최자 공식 소셜 채널 | 긴급 변경 공지 |
| S4 | 공식 판매처·협력사·보도자료 | 관람 보조 정보 |
| S5 | 참가자·판매자 경험 자료 | 공개 필드 사용 금지 |

핵심 필드는 `fieldEvidence`로 S1/S2 출처에 연결합니다. 공식 원문에 없는 부스 수,
사업자등록 필요 여부, 반입·주차 정보는 `0`이나 `false`로 추정하지 않고 `null`로
유지합니다. 고정 최종 접수일이 없는 경우에도 조기 할인일을 최종 마감일처럼 표현하지
않습니다.

## 실행

```bash
npm run content:pipeline
npm run content:guard
npm run content:check-generated
```

- `content:collect`: 레지스트리 허용 URL의 robots 정책과 HTTP 상태를 확인하고 원문은
  `.content-cache/`에 저장, 정규화 텍스트 SHA-256과 다음 확인일은 `content/sources/`에 기록.
- `content:validate`: 출처 링크, 접근 상태, 해시, 게시 승인 상태와 필드 근거 등급을 검사.
- `content:generate`: 결정론적으로 사이트 TypeScript/JSON을 생성.
- `content:report`: 사람이 확인할 Markdown 보고서를 생성. 로컬 후기 저장소를 읽지 않음.
- `content:guard`: 로컬 경로의 Git 추적과 공개 생성물의 후기 필드 유입을 차단.

후보 배치는 `content/config/candidate-batches.json`에 등록합니다. 각 배치는 JSONL
3종, SHA-256 `manifest.json`, 독립 `source-reachability-audit.json`을 가지며
`content:candidates:validate`와 `content:candidates:check-sources`가 활성 배치를 모두
검사합니다. 해외 회차는 `countryCode`, `countryName`, `city`, `timeZone`,
`sourceLanguage`를 기록하고 참가비는 ISO 4217 통화와 원 금액을 함께 보존합니다.
통화 환산값은 수집 시점에 따라 달라지므로 생성하지 않습니다.

해시 변경이나 접근 실패는 `content/queues/recheck.jsonl`에 들어갑니다. 자동 수집은
편집자가 확인한 값을 덮어쓰지 않습니다.

## 후기 수집과 보관

`scripts/content/reviews.mjs`는 X API v2 Recent Search, 수동 JSONL import와 승인된
`twscrape==0.19.2` Latest 검색 어댑터를 지원합니다. 작성자 ID는 저장소별 pepper로
해시하고, 원문·URL·수집 시각·규칙 기반 주제를 `content-local/reviews/`에 보관합니다.
이 디렉터리와 `.content-cache/`는 Git과 Pages 빌드에서 제외됩니다.

`twscrape`는 비공식 X GraphQL에 의존하므로 기본 자동 실행하지 않는 `manualOnly`
collector입니다. 별도 Python 3.10+ 가상환경과 `content-local/reviews/twscrape/accounts.db`
만 사용하고, 쿠키·계정 DB·원문은 저장소에 넣지 않습니다. 기본 수집 명령은 활성화된
공식 collector만 실행하고, `twscrape`는 운영자가 ID를 지정할 때만 실행됩니다.

```bash
npm run reviews:twscrape:setup
content-local/reviews/twscrape/.venv/bin/twscrape \
  --db content-local/reviews/twscrape/accounts.db add_cookie bindery_local
npm run reviews:collect -- --collector x-twscrape-latest
npm run reviews:report
```

`add_cookie`는 값을 인자에 쓰지 않으면 대화형으로 입력받아 셸 기록 노출을 피합니다.
별도 X 계정과 접근 권한은 운영자가 준비해야 하며, 계정 제한·엔드포인트 변경·서비스
정책 위험은 남습니다. URL 스냅샷 보관 절차는 `tools/review-vault/README.md`를 따릅니다.

## 1차 데이터셋 (2026-08-03)

- 일러스트코리아 2026 서울 aT센터: 2026-09-04–09-06
- 일러스트코리아 2026 인천 송도컨벤시아: 2026-10-30–11-01
- 일러스트코리아 2026 수원 수원메쎄: 2026-12-11–12-13
- 공식 출처 11건, S1/S2만 공개 필드 근거로 사용
- 로컬 후기 0건: twscrape 어댑터 설치·상태 확인 완료, 로컬 계정 DB 입력 전까지 미수집

상세 출처·필드 근거·미확인 값은 `content/reports/latest.md`에서 확인합니다.
