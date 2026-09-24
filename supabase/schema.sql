-- Red Candle leaderboard.
-- Run once in Supabase → SQL Editor.
--
-- Players never write to the table directly: the only way in is
-- submit_score(), which takes the X handle from the signed-in account
-- (so nobody can post under someone else's name), rejects impossible
-- numbers and limits how often one player can submit.

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  handle      text not null,
  avatar_url  text,
  score       int  not null check (score >= 0),
  level       int  not null check (level >= 1),
  candles     int  not null check (candles >= 0),
  speed       text not null check (speed in ('chill', 'normal', 'degen')),
  created_at  timestamptz not null default now()
);

create index if not exists scores_speed_score on public.scores (speed, score desc);

alter table public.scores enable row level security;

drop policy if exists "Scores are public" on public.scores;
create policy "Scores are public" on public.scores for select using (true);
-- no insert/update/delete policies: writes only go through submit_score()


create or replace function public.submit_score(p_score int, p_level int, p_candles int, p_speed text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in with X first';
  end if;

  -- sanity checks against what the game can actually award:
  -- levels need at least 12 candles each, and a candle is worth at most
  -- ~10 × level × combo bonus plus the long-red bonuses
  if p_score < 0 or p_candles < 0 or p_level < 1 or p_speed not in ('chill', 'normal', 'degen') then
    raise exception 'Invalid score';
  end if;
  if p_level > p_candles / 12 + 1 then
    raise exception 'Level does not match candles played';
  end if;
  if p_score > p_candles * p_level * (70 + 2 * p_candles) then
    raise exception 'Score looks impossible';
  end if;

  if exists (select 1 from scores where user_id = auth.uid() and created_at > now() - interval '15 seconds') then
    raise exception 'Too many submissions, try again in a few seconds';
  end if;

  select raw_user_meta_data into m from auth.users where id = auth.uid();

  insert into scores (user_id, handle, avatar_url, score, level, candles, speed)
  values (
    auth.uid(),
    coalesce(m ->> 'user_name', m ->> 'preferred_username', m ->> 'name', 'player'),
    m ->> 'avatar_url',
    p_score, p_level, p_candles, p_speed
  );
end;
$$;

revoke all on function public.submit_score(int, int, int, text) from public, anon;
grant execute on function public.submit_score(int, int, int, text) to authenticated;


-- Top 20 for one speed, best run per player.
create or replace function public.get_leaderboard(p_speed text)
returns table (handle text, avatar_url text, score int, level int, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.handle, b.avatar_url, b.score, b.level, b.created_at
  from (
    select distinct on (user_id) handle, avatar_url, score, level, created_at
    from scores
    where speed = p_speed
    order by user_id, score desc, created_at
  ) b
  order by b.score desc, b.created_at
  limit 20;
$$;

grant execute on function public.get_leaderboard(text) to anon, authenticated;
