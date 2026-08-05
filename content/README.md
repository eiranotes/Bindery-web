# Bindery content source of truth

이 디렉터리는 공개 가능한 공식 행사 사실만 보관합니다. 자동 수집기는
원문을 로컬 캐시에 저장하고 해시와 상태를 `sources/`에 기록하지만,
`editor_checked` 상태나 공개 필드 값을 스스로 만들 수 없습니다.

흐름은 다음과 같습니다.

1. `config/source-registry.json`의 허용 목록만 수집합니다.
2. 원문은 Git에서 제외한 `.content-cache/`에 보관합니다.
3. 해시 변경은 `queues/recheck.jsonl`에 추가합니다.
4. 운영자가 `events/`의 짧은 근거와 정규화 값을 확인합니다.
5. 검증기가 필드별 공식 근거를 확인합니다.
6. 생성기가 `app/lib/generated/events.ts`와 사람이 읽는 Markdown 보고서를 만듭니다.

대량 발굴 원본은 `research/`에 해시 manifest와 함께 보존하고
`config/candidate-batches.json`에서 활성 배치를 등록합니다. 정규화기는 모든 활성
배치의 원본 3종을 `catalog/`의 EventMaster, EventEdition, SourceRecord 컬렉션으로 옮기고
공식 S1/S2 대표 출처의 현재 접근성과 개최 날짜를 기준으로 공개/보류를 나눕니다.
확인되지 않은 신청 마감, 참가비, 선정 방식, 장소는 추정하지 않고 `null`로
유지합니다. `reports/candidate-review.md`에는 공개 후 보강 대상과 보류 대상을
별도로 기록합니다. 해외 문구 배치는 국가 코드, 국가명, 도시, IANA 시간대,
원문 언어와 ISO 4217 통화를 보존하며 서로 다른 통화의 참가비를 직접 순위 비교하지
않습니다. 해외 전용 보강 목록은 `reports/international-stationery-review.md`입니다.

참가자·판매자 후기 원문은 이 디렉터리에 들어오지 않습니다. 후기 수집 결과는
항상 Git에서 제외한 `content-local/reviews/`에만 남고 공개 사이트 생성기는 그
경로를 읽지 않습니다.

```bash
npm run content:pipeline
npm run content:candidates:validate
npm run content:candidates:check-sources
npm run content:normalize
npm run content:check-normalized
npm run reviews:collect
npm run reviews:report
```

`content:pipeline`은 공식 원문을 다시 가져오고 후보 정규화와 공개 생성을
순서대로 수행합니다. 네트워크 없이 구조만 확인하려면
`npm run content:candidates:validate && npm run content:check-normalized && npm run content:validate && npm run content:check-generated`를
사용합니다. `content:candidates:check-sources`는 현재 URL 상태를 다시 측정해 후보
묶음의 접근성 스냅샷과 편집자 대기열을 갱신하므로 의도한 네트워크 검수 때만
실행합니다.
