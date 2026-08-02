alter table public.post_sources
  add column valid_for_days integer not null default 90
  check (valid_for_days between 1 and 3650);

alter table public.posts
  add column accepted_comment_id uuid references public.comments(id) on delete set null,
  add column event_id text check (
    event_id is null or event_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'
  );

create table public.community_note_promotions (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  title text not null check (char_length(title) between 4 and 120),
  summary text not null check (char_length(summary) between 10 and 240),
  body text not null,
  source_post_id uuid not null unique references public.posts(id) on delete restrict,
  source_author_id uuid not null references public.profiles(id) on delete restrict,
  source_author_name text not null,
  source_url text not null check (source_url ~ '^https?://'),
  source_checked_at date not null,
  promoted_by uuid not null references public.profiles(id) on delete restrict,
  promoted_at timestamptz not null default now()
);

alter table public.community_note_promotions enable row level security;

create policy community_note_promotions_select_public
on public.community_note_promotions
for select
using (true);

create trigger audit_community_note_promotions
after insert or update or delete on public.community_note_promotions
for each row execute function public.audit_privileged_change();

create or replace function public.accept_community_answer(
  p_comment_id uuid,
  p_accepted_at timestamptz default now()
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_comment public.comments%rowtype;
  selected_post public.posts%rowtype;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;

  select * into selected_comment
  from public.comments
  where id = p_comment_id and state = 'published';
  if not found then return; end if;

  select * into selected_post
  from public.posts
  where id = selected_comment.post_id
  for update;
  if not found then return; end if;
  if selected_post.author_id <> auth.uid() then
    raise exception 'post author required' using errcode = '42501';
  end if;
  if selected_post.kind <> 'question'
    or selected_post.state not in ('published', 'locked') then
    raise exception 'published question required';
  end if;

  update public.posts
  set
    accepted_comment_id = selected_comment.id,
    is_resolved = true,
    updated_at = p_accepted_at
  where id = selected_post.id
  returning * into selected_post;

  return next selected_post;
end;
$$;

create or replace function public.link_community_event(
  p_post_id uuid,
  p_event_id text,
  p_linked_at timestamptz default now()
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare selected_post public.posts%rowtype;
begin
  if p_event_id !~ '^[a-z0-9][a-z0-9-]{1,79}$' then
    raise exception 'valid event id required';
  end if;
  select * into selected_post from public.posts where id = p_post_id for update;
  if not found then return; end if;
  if selected_post.author_id <> auth.uid() and not public.is_operator() then
    raise exception 'post author or operator required' using errcode = '42501';
  end if;
  if not public.can_access_board(selected_post.board_id) then
    raise exception 'board access required' using errcode = '42501';
  end if;
  update public.posts
  set event_id = p_event_id, updated_at = p_linked_at
  where id = selected_post.id
  returning * into selected_post;
  return next selected_post;
end;
$$;

create or replace function public.promote_community_note(
  p_id uuid,
  p_source_post_id uuid,
  p_slug text,
  p_summary text,
  p_promoted_at timestamptz default now()
)
returns setof public.community_note_promotions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_post public.posts%rowtype;
  selected_source public.post_sources%rowtype;
  selected_answer public.comments%rowtype;
  author_name text;
  created_note public.community_note_promotions%rowtype;
begin
  if not public.is_operator() then
    raise exception 'operator required' using errcode = '42501';
  end if;
  select * into selected_post
  from public.posts
  where id = p_source_post_id
  for update;
  if not found then return; end if;
  if selected_post.board_id <> 'general'
    or selected_post.state <> 'published'
    or not selected_post.is_resolved
    or selected_post.accepted_comment_id is null then
    raise exception 'resolved public post required';
  end if;
  select * into selected_source
  from public.post_sources
  where post_id = selected_post.id
  order by checked_at desc
  limit 1;
  if not found then raise exception 'source required'; end if;
  select * into selected_answer
  from public.comments
  where id = selected_post.accepted_comment_id
    and post_id = selected_post.id
    and state = 'published';
  if not found then raise exception 'accepted answer required'; end if;
  select display_name into author_name
  from public.profiles where id = selected_post.author_id;

  insert into public.community_note_promotions (
    id, slug, title, summary, body, source_post_id, source_author_id,
    source_author_name, source_url, source_checked_at, promoted_by, promoted_at
  ) values (
    p_id, lower(p_slug), selected_post.title, trim(p_summary),
    selected_post.body || E'\n\n채택 답변\n' || selected_answer.body,
    selected_post.id, selected_post.author_id, author_name,
    selected_source.url, selected_source.checked_at, auth.uid(), p_promoted_at
  )
  returning * into created_note;
  return next created_note;
end;
$$;

grant select on public.community_note_promotions to anon, authenticated;
revoke all on function public.accept_community_answer(uuid, timestamptz) from public;
revoke all on function public.link_community_event(uuid, text, timestamptz) from public;
revoke all on function public.promote_community_note(uuid, uuid, text, text, timestamptz) from public;
grant execute on function public.accept_community_answer(uuid, timestamptz) to authenticated;
grant execute on function public.link_community_event(uuid, text, timestamptz) to authenticated;
grant execute on function public.promote_community_note(uuid, uuid, text, text, timestamptz) to authenticated;
