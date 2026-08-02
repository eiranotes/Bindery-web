\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('b0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003');

insert into public.profiles (id, display_name, account_status) values
  ('b0000000-0000-4000-8000-000000000001', 'Binder 회원', 'active'),
  ('b0000000-0000-4000-8000-000000000002', '다른 회원', 'active'),
  ('b0000000-0000-4000-8000-000000000003', '정지 회원', 'suspended')
on conflict (id) do update set
  display_name = excluded.display_name,
  account_status = excluded.account_status;

set role service_role;
insert into public.posts (
  id, board_id, author_id, category_id, kind, state, title, body, published_at
) values (
  'b1000000-0000-4000-8000-000000000001', 'general',
  'b0000000-0000-4000-8000-000000000002', 'production', 'fact',
  'published', 'Binder에 저장할 공개 글',
  '계정 Binder 병합 RPC를 검증하는 공개 게시글입니다.', now()
);
reset role;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
do $$
declare own_count integer; first_event_merge boolean; second_event_merge boolean;
  first_post_merge boolean; second_post_merge boolean;
begin
  select public.merge_event_bookmark('illustar-2026-winter')
  into first_event_merge;
  select public.merge_event_bookmark('illustar-2026-winter')
  into second_event_merge;
  select public.merge_community_bookmark(
    'b1000000-0000-4000-8000-000000000001'
  ) into first_post_merge;
  select public.merge_community_bookmark(
    'b1000000-0000-4000-8000-000000000001'
  ) into second_post_merge;
  select count(*) into own_count from public.event_bookmarks;
  if own_count <> 1 then raise exception 'owner expected one event bookmark, found %', own_count; end if;
  if first_event_merge is distinct from true or second_event_merge is distinct from false then
    raise exception 'event merge was not idempotent: %, %', first_event_merge, second_event_merge;
  end if;
  if first_post_merge is distinct from true or second_post_merge is distinct from false then
    raise exception 'community merge was not idempotent: %, %', first_post_merge, second_post_merge;
  end if;
  begin
    insert into public.event_bookmarks (user_id, event_id)
    values ('b0000000-0000-4000-8000-000000000001', 'seoul-illustration-2026-v20');
    raise exception 'raw authenticated event insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
do $$
declare visible_count integer;
begin
  select count(*) into visible_count from public.event_bookmarks;
  if visible_count <> 0 then raise exception 'cross-user select leaked % bookmarks', visible_count; end if;
  begin
    insert into public.event_bookmarks (user_id, event_id)
    values ('b0000000-0000-4000-8000-000000000001', 'cross-user-event');
    raise exception 'cross-user insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000003', true);
do $$
begin
  begin
    perform public.merge_event_bookmark('illustar-2026-winter');
    raise exception 'inactive member event merge unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;
rollback;

begin;
set local role service_role;
insert into public.event_bookmarks (user_id, event_id)
values ('b0000000-0000-4000-8000-000000000002', 'seoul-illustration-2026-v20');
do $$
declare all_count integer;
begin
  select count(*) into all_count from public.event_bookmarks;
  if all_count <> 2 then raise exception 'service role expected two cross-account rows, found %', all_count; end if;
  begin
    insert into public.event_bookmarks (user_id, event_id)
    values ('b0000000-0000-4000-8000-000000000002', 'unknown-event');
    raise exception 'event bookmark foreign key accepted an unknown event';
  exception when foreign_key_violation then null;
  end;
end
$$;
commit;

begin;
set local role service_role;
insert into public.community_event_allowlist (event_id, is_catalog)
select 'cap-event-' || value, true
from generate_series(1, 100) value;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
do $$
declare value integer; saved_count integer;
begin
  for value in 1..99 loop
    perform public.merge_event_bookmark('cap-event-' || value);
  end loop;
  select count(*) into saved_count from public.event_bookmarks;
  if saved_count <> 100 then
    raise exception 'event bookmark cap fixture expected 100 rows, found %', saved_count;
  end if;
  begin
    perform public.merge_event_bookmark('cap-event-100');
    raise exception '101st event bookmark unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
end
$$;
rollback;
