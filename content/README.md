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

참가자·판매자 후기 원문은 이 디렉터리에 들어오지 않습니다. 후기 수집 결과는
항상 Git에서 제외한 `content-local/reviews/`에만 남고 공개 사이트 생성기는 그
경로를 읽지 않습니다.

```bash
npm run content:pipeline
npm run reviews:collect
npm run reviews:report
```

`content:pipeline`은 공식 원문을 다시 가져옵니다. 네트워크 없이 구조만 확인하려면
`npm run content:validate && npm run content:generate && npm run content:report`를
사용합니다.
