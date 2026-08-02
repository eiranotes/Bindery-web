\set ON_ERROR_STOP on

insert into auth.users (id,email,raw_user_meta_data) values
('90000000-0000-4000-8000-000000000001','author@example.com','{"display_name":"질문작성자"}'),
('90000000-0000-4000-8000-000000000002','answer@example.com','{"display_name":"답변작성자"}'),
('90000000-0000-4000-8000-000000000003','operator@example.com','{"display_name":"운영자"}'),
('90000000-0000-4000-8000-000000000004','deleted-operator@example.com','{"display_name":"삭제 운영자"}');
insert into public.user_roles (user_id,role,reason)
values
('90000000-0000-4000-8000-000000000003','moderator','knowledge test'),
('90000000-0000-4000-8000-000000000004','moderator','inactive knowledge test');
insert into public.posts (id,board_id,author_id,category_id,kind,state,title,body,published_at)
values
('91000000-0000-4000-8000-000000000001','general','90000000-0000-4000-8000-000000000001','event','question','published','행사 준비 질문','행사 준비 순서를 묻습니다.',now()),
('91000000-0000-4000-8000-000000000002','general','90000000-0000-4000-8000-000000000001','event','question','hidden','숨김 질문','숨김 글은 승격되면 안 됩니다.',now()),
('91000000-0000-4000-8000-000000000003','general','90000000-0000-4000-8000-000000000004','event','question','published','삭제 운영자 글','삭제된 운영자의 행사 연결을 거부합니다.',now());
insert into public.post_sources (post_id,label,url,checked_at,valid_for_days,created_by)
values
('91000000-0000-4000-8000-000000000001','공식 안내','https://example.com/official','2026-07-01',30,'90000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000002','공식 안내','https://example.com/hidden','2026-07-01',30,'90000000-0000-4000-8000-000000000001');
insert into public.comments (id,post_id,author_id,body)
values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','공식 공지를 확인했습니다.');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform * from public.accept_community_answer('92000000-0000-4000-8000-000000000001',now());
    raise exception 'non-author accepted answer';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$ declare resolved boolean; linked text; begin
  select is_resolved into resolved from public.accept_community_answer('92000000-0000-4000-8000-000000000001',now());
  if not resolved then raise exception 'answer was not accepted'; end if;
  select event_id into linked from public.link_community_event('91000000-0000-4000-8000-000000000001','illustar-2026-winter',now());
  if linked <> 'illustar-2026-winter' then raise exception 'event was not linked'; end if;
  begin
    perform * from public.link_community_event(
      '91000000-0000-4000-8000-000000000001',
      'syntactically-valid-but-unknown-event'
    );
    raise exception 'unknown event was linked';
  exception when foreign_key_violation then null; end;
end $$;
commit;

begin;
set local role service_role;
update public.profiles set account_status = 'suspended'
where id = '90000000-0000-4000-8000-000000000001';
update public.profiles set account_status = 'deleted'
where id = '90000000-0000-4000-8000-000000000004';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform * from public.link_community_event(
      '91000000-0000-4000-8000-000000000001','seoul-illustration-2026-v20');
    raise exception 'suspended author linked an event';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
do $$ begin
  begin
    perform * from public.link_community_event(
      '91000000-0000-4000-8000-000000000003','seoul-illustration-2026-v20');
    raise exception 'deleted operator linked an event';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role service_role;
do $$
declare allowed_ids text[];
begin
  select array_agg(event_id order by event_id) into allowed_ids
  from public.community_event_allowlist;
  if allowed_ids <> array[
    'daegu-illustration-2026',
    'design-festa-2026',
    'illustar-2026-winter',
    'mungu-box-2026-8',
    'seoul-illustration-2026-v20'
  ]::text[] then
    raise exception 'database event allow-list does not match the app catalog: %', allowed_ids;
  end if;

  begin
    update public.posts
    set event_id = 'syntactically-valid-but-unknown-event'
    where id = '91000000-0000-4000-8000-000000000001';
    raise exception 'post event foreign key accepted an unknown event';
  exception when foreign_key_violation then null; end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
do $$ declare note_post uuid; begin
  select source_post_id into note_post from public.promote_community_note(
    '93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',
    'event-prep-answer','행사 준비 답변을 운영 노트로 정리했습니다.',now());
  if note_post <> '91000000-0000-4000-8000-000000000001' then raise exception 'note promotion failed'; end if;
  begin
    perform * from public.promote_community_note(
      '93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002',
      'hidden-note','숨김 글은 승격되면 안 됩니다.',now());
    raise exception 'hidden post was promoted';
  exception when raise_exception then
    if sqlerrm <> 'resolved public post required' then raise; end if;
  end;
end $$;
commit;

begin;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare visible_notes integer; protected_posts integer; begin
  select count(*) into visible_notes from public.community_note_promotions;
  if visible_notes <> 1 then raise exception 'promoted note not public'; end if;
  select count(*) into protected_posts from public.posts where board_id='artists';
  if protected_posts <> 0 then raise exception 'knowledge read leaked artist posts'; end if;
end $$;
rollback;
