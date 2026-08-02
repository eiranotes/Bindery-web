revoke select on public.post_revisions from anon, authenticated;

grant select (id, post_id, editor_id, reason, created_at)
  on public.post_revisions to anon, authenticated;

drop function if exists public.promote_community_note(
  uuid, uuid, text, text, timestamptz
);

create or replace function public.promote_community_note(
  p_id uuid,
  p_source_post_id uuid,
  p_slug text,
  p_summary text
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
  order by checked_at desc, created_at desc, id
  limit 1;

  if not found then raise exception 'source required'; end if;

  select * into selected_answer
  from public.comments
  where id = selected_post.accepted_comment_id
    and post_id = selected_post.id
    and state = 'published';

  if not found then raise exception 'accepted answer required'; end if;

  select display_name into author_name
  from public.profiles
  where id = selected_post.author_id;

  insert into public.community_note_promotions (
    id, slug, title, summary, body, source_post_id, source_author_id,
    source_author_name, source_url, source_checked_at, promoted_by, promoted_at
  ) values (
    p_id, lower(p_slug), selected_post.title, trim(p_summary),
    selected_post.body || E'\n\n채택 답변\n' || selected_answer.body,
    selected_post.id, selected_post.author_id, author_name,
    selected_source.url, selected_source.checked_at, auth.uid(), clock_timestamp()
  )
  returning * into created_note;

  return next created_note;
end;
$$;

-- Upgrade-compatible wrapper: caller time is intentionally ignored.
create function public.promote_community_note(
  p_id uuid,
  p_source_post_id uuid,
  p_slug text,
  p_summary text,
  p_promoted_at timestamptz
)
returns setof public.community_note_promotions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.promote_community_note(
    p_id, p_source_post_id, p_slug, p_summary
  );
end;
$$;

revoke all on function public.promote_community_note(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.promote_community_note(
  uuid, uuid, text, text, timestamptz
) from public, anon;
grant execute on function public.promote_community_note(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.promote_community_note(
  uuid, uuid, text, text, timestamptz
) to authenticated;
