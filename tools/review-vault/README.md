# 로컬 후기 보관 도구

후기 원문과 작성자 단서는 공개 사이트의 입력이 아닙니다. `npm run reviews:archive`가
만드는 `content-local/reviews/archivebox-input.txt`를 별도 로컬 ArchiveBox 인스턴스에
전달해 참고용 스냅샷을 보관합니다. 저장 데이터와 ArchiveBox 인스턴스는 Git과 배포
환경 밖에 둡니다.

## 선택 기준 (2026-08-03 확인)

- [ArchiveBox](https://github.com/ArchiveBox/ArchiveBox): MIT, 비보관(활성) 저장소,
  2026-08-02 최근 푸시, 2026-05-18 `v0.7.4` 릴리스, HTML·PDF·텍스트·JSON·WARC 등
  중복 포맷 보관 지원.
- [twscrape](https://github.com/vladkens/twscrape): MIT, 별 2,646개, 2026-07-31
  최근 푸시와 2026-07-21 `v0.19.2` 릴리스. 계정 DB 격리, Latest 검색, JSONL 경계가
  맞아 로컬 수집기로 채택.
- [Twikit](https://github.com/d60/twikit): MIT, 별 4,596개. 최근 푸시는
  2026-03-10이지만 최신 릴리스는 2025-02-06이고 읽기 외 쓰기 기능까지 넓어 보류.
- [the-convocation/twitter-scraper](https://github.com/the-convocation/twitter-scraper):
  MIT, 별 637개, 2026-04-01 `v0.22.3`. 직전 검색 404 수정까지 확인된 Node 대안이나
  계정 차단·프런트엔드 API 파손 위험을 저장소가 직접 경고해 예비안으로만 유지.
- `snscrape`는 2023년 이후 갱신 신호가 약해 제외.

별 수와 업데이트일은 품질 신호일 뿐 신뢰도 보장이 아닙니다. 실행 수집기는 X 공식
Recent Search API 또는 운영자가 명시적으로 고른 `twscrape`만 사용하고, ArchiveBox는
수집기가 아니라 이미 확보한 공개 URL의 로컬 증거 보관 계층으로만 사용합니다. 상세
비교 스냅샷은 `docs/TWITTER_COLLECTOR_REVIEW.md`에 둡니다.

## 로컬 실행 예시

ArchiveBox 공식 문서가 권장하는 Docker Compose 설치를 별도 디렉터리에 완료한 뒤:

```bash
npm run reviews:archive
cd /path/to/local/archivebox
docker compose run -T archivebox add < /absolute/path/to/website/content-local/reviews/archivebox-input.txt
```

X 로그인 쿠키·비밀번호·계정 DB는 이 프로젝트에 넣지 않습니다. `twscrape`는
`content-local/reviews/twscrape/`의 격리 DB만 사용하고 ID를 지정한 수동 실행만
허용합니다. X API 수집기는 로컬 환경의 `X_BEARER_TOKEN`으로만 동작합니다.
