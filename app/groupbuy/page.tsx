import type { Metadata } from "next";

import { groupbuys } from "../lib/data";

export const metadata: Metadata = {
  title: "공동구매 현황",
  description:
    "문구·굿즈 공동구매의 모집 상태와 주최 이력을 읽기 전용으로 확인합니다.",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+09:00`));
}

export default function GroupbuyPage() {
  return (
    <div className="page-shell groupbuy-page">
      <header className="page-heading page-heading--ruled">
        <p className="eyebrow">공구 기록 · 읽기 전용</p>
        <h1>공동구매 현황</h1>
        <p className="page-lede">
          모집 인원, 진행 단계, 정산 조건을 확인합니다.
        </p>
      </header>

      <aside className="boundary-note" aria-labelledby="groupbuy-boundary">
        <p className="stamp">책임 경계</p>
        <div>
          <h2 id="groupbuy-boundary">
            바인더리는 결제와 정산에 관여하지 않습니다.
          </h2>
          <p>
            이 화면은 모집 현황을 정리한 읽기 전용 정보판입니다. 송금, 환불,
            분쟁 조정, 물품 보관을 제공하지 않으며 주최 이력은 거래를 보증하지
            않습니다.
          </p>
        </div>
      </aside>

      <section className="groupbuy-board" aria-labelledby="groupbuy-board-title">
        <header className="section-heading">
          <div>
            <p className="eyebrow">현재 기록</p>
            <h2 id="groupbuy-board-title">진행 상태</h2>
          </div>
          <p className="section-count">{groupbuys.length}건</p>
        </header>

        <div className="groupbuy-ledger">
          {groupbuys.map((groupbuy, index) => {
            const percentage = Math.min(
              100,
              Math.round((groupbuy.current / groupbuy.target) * 100),
            );

            return (
              <article className="groupbuy-entry" key={groupbuy.id}>
                <header className="groupbuy-entry__heading">
                  <p className="entry-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <p className="entry-meta">
                      <span>{groupbuy.category}</span>
                      <span className="status-stamp">{groupbuy.status}</span>
                    </p>
                    <h3>{groupbuy.item}</h3>
                  </div>
                </header>

                <div className="groupbuy-progress">
                  <div className="groupbuy-progress__copy">
                    <span>모집 기록</span>
                    <strong>
                      {groupbuy.current}
                      <span aria-hidden="true"> / </span>
                      <span className="sr-only">명 중 </span>
                      {groupbuy.target}
                      {groupbuy.unit}
                    </strong>
                  </div>
                  <progress
                    aria-label={`${groupbuy.item} 모집 진행률`}
                    max={groupbuy.target}
                    value={groupbuy.current}
                  >
                    {percentage}%
                  </progress>
                  <p className="progress-percentage">{percentage}% 기록됨</p>
                </div>

                <dl className="groupbuy-facts">
                  <div>
                    <dt>마감 기록</dt>
                    <dd>{formatDate(groupbuy.deadline)}</dd>
                  </div>
                  <div>
                    <dt>예상 단가</dt>
                    <dd>{groupbuy.estimatedPrice}</dd>
                  </div>
                  <div>
                    <dt>주최</dt>
                    <dd>{groupbuy.organizer}</dd>
                  </div>
                  <div>
                    <dt>주최 이력</dt>
                    <dd>
                      완료 {groupbuy.organizerHistory.completed}회
                      <span aria-hidden="true"> · </span>
                      무산 {groupbuy.organizerHistory.failed}회
                    </dd>
                  </div>
                </dl>

                <div className="groupbuy-route" aria-label="외부 진행 정보">
                  <p>
                    <span>정산 안내</span>
                    {groupbuy.settlement}
                  </p>
                  <p>
                    <span>수령 방식</span>
                    {groupbuy.delivery}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <p className="data-note">
          현재 항목은 화면과 안전 기준을 검증하기 위한 예시 기록입니다. 실제
          참여 전에는 주최자가 올린 최신 모집 원문을 기준으로 판단해야 합니다.
        </p>
      </section>

      <section
        className="responsibility-guide"
        aria-labelledby="responsibility-title"
      >
        <header className="section-heading">
          <div>
            <p className="eyebrow">책임 메모</p>
            <h2 id="responsibility-title">참여 전 확인</h2>
          </div>
        </header>

        <div className="responsibility-grid">
          <article>
            <p className="entry-index" aria-hidden="true">
              A
            </p>
            <h3>주최자가 적을 것</h3>
            <ul className="check-list">
              <li>견적서의 업체명, 수량, 부가세와 배송비</li>
              <li>입금 기한, 환불 기준과 무산 시 반환 일정</li>
              <li>제작 지연과 불량이 생겼을 때의 연락 방법</li>
            </ul>
          </article>
          <article>
            <p className="entry-index" aria-hidden="true">
              B
            </p>
            <h3>참여자가 확인할 것</h3>
            <ul className="check-list">
              <li>주최자의 동일 품목 완료·무산 이력</li>
              <li>예상 단가가 확정 금액인지, 추가 비용이 있는지</li>
              <li>서면 조건을 보관했고 감당 가능한 금액인지</li>
            </ul>
          </article>
          <article>
            <p className="entry-index" aria-hidden="true">
              C
            </p>
            <h3>바인더리가 하는 일</h3>
            <ul className="check-list">
              <li>진행 상태와 변경 기록을 같은 형식으로 정리</li>
              <li>정정이 필요한 항목을 표시하고 확인 시점을 남김</li>
              <li>거래 당사자가 아닌 정보 바인더로만 작동</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
