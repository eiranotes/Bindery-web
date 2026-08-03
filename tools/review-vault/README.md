# 로컬 후기 보관 도구

후기 원문과 작성자 단서는 공개 사이트의 입력이 아닙니다. `npm run reviews:archive`가
만드는 `content-local/reviews/archivebox-input.txt`를 별도 로컬 ArchiveBox 인스턴스에
전달해 참고용 스냅샷을 보관합니다. 저장 데이터와 ArchiveBox 인스턴스는 Git과 배포
환경 밖에 둡니다.

## 선택 기준 (2026-08-03 확인)

- [ArchiveBox](https://github.com/ArchiveBox/ArchiveBox): MIT, 비보관(활성) 저장소,
  2026-08-02 최근 푸시, 2026-05-18 `v0.7.4` 릴리스, HTML·PDF·텍스트·JSON·WARC 등
  중복 포맷 보관 지원.
- [twscrape](https://github.com/vladkens/twscrape): MIT, 2026-07-31 최근 푸시와
  2026-07-21 `v0.19.2` 릴리스가 확인됐지만 X의 비공식 GraphQL·쿠키·계정 풀을
  사용하므로 실행 수집기로 채택하지 않음.
- [Twikit](https://github.com/d60/twikit): MIT이고 활발한 관심은 있으나 비공식
  로그인/엔드포인트 의존성과 최근 고장 이슈가 있어 채택하지 않음.
- `snscrape`는 2023년 이후 갱신 신호가 약해 제외.

별 수와 업데이트일은 품질 신호일 뿐 신뢰도 보장이 아닙니다. 실행 수집기는 X 공식
Recent Search API만 사용하고, ArchiveBox는 수집기가 아니라 이미 확보한 공개 URL의
로컬 증거 보관 계층으로만 사용합니다.

## 로컬 실행 예시

ArchiveBox 공식 문서가 권장하는 Docker Compose 설치를 별도 디렉터리에 완료한 뒤:

```bash
npm run reviews:archive
cd /path/to/local/archivebox
docker compose run -T archivebox add < /absolute/path/to/website/content-local/reviews/archivebox-input.txt
```

X 로그인 쿠키, 비밀번호, 비공식 계정 자동화는 이 프로젝트에 넣지 않습니다. X API
수집기는 `content/config/review-sources.json`에서 명시적으로 활성화하고 로컬 환경의
`X_BEARER_TOKEN`으로만 동작합니다.
