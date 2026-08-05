-- Source-checked international stationery editions collected from official
-- organizer, association, venue, and public trade-show pages on 2026-08-05.
insert into public.community_event_allowlist (event_id, label, active)
values
  ('bungu-joshi-tokyo-2026', '문구여자박람회 도쿄 2026', true),
  ('bungu-joshi-niigata-2026', '문구여자박람회 팝업 니가타 2026', true),
  ('bungu-joshi-hiroshima-2026', '문구여자박람회 팝업 히로시마 2026', true),
  ('bungu-joshi-yokohama-2026', '문구여자박람회 요코하마 2026', true),
  ('isot-tokyo-2026-autumn', 'ISOT 도쿄 2026 가을', true),
  ('isot-tokyo-2027-summer', 'ISOT 도쿄 2027 여름', true),
  ('tokyo-international-gift-show-2026-autumn', '제102회 도쿄 인터내셔널 기프트 쇼 2026 가을', true),
  ('osaka-international-gift-show-2026', '제68회 오사카 인터내셔널 기프트 쇼 2026', true),
  ('taiwan-creative-stationery-fair-2026-winter', '제20회 대만 국제 창의문구전 2026 겨울', true),
  ('taiwan-creative-stationery-fair-2026-summer', '제20회 대만 국제 창의문구전 2026 여름', true),
  ('dg-taiwan-2026', 'DG Taiwan 2026 대만 국제 창의선물문구전', true),
  ('play-stationery-handcraft-fair-2026', '플레이 문구·핸드메이드 창의전 2026', true),
  ('china-stationery-fair-2026-120', '제120회 중국 문화용품상품교역회 CSF 2026', true),
  ('paperworld-china-2026', '페이퍼월드 차이나 2026', true),
  ('design-festa-2026-64', '디자인 페스타 vol.64', true)
on conflict (event_id) do update
set label = excluded.label,
    active = excluded.active;
