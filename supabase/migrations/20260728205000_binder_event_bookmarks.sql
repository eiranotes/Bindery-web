create table public.event_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id text not null check (
    char_length(event_id) between 1 and 120
    and event_id ~ '^[a-z0-9][a-z0-9-]*$'
  ),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.event_bookmarks enable row level security;

create policy event_bookmarks_select_own
on public.event_bookmarks
for select
using (user_id = auth.uid());

create policy event_bookmarks_insert_own
on public.event_bookmarks
for insert
with check (
  user_id = auth.uid()
  and public.is_active_member()
);

grant select, insert on public.event_bookmarks to authenticated;
grant select, insert, update, delete on public.event_bookmarks to service_role;
