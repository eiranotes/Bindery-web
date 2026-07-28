insert into public.boards (id, title, audience)
values
  ('general', '모두의 게시판', 'public'),
  ('artists', '작가 인증 게시판', 'artist')
on conflict (id) do update
set
  title = excluded.title,
  audience = excluded.audience;
