-- Online play: rooms, the phones in each room and the players (seats) each phone controls.
--
-- Security model
--   * Clients never write these tables directly. Lobby changes go through the
--     SECURITY DEFINER functions below; game moves will go through the
--     `room-action` Edge Function (service role), which owns the dice.
--   * Clients can only read rooms they belong to (row level security).
--   * Every function checks auth.uid(): anonymous sign-ins count as signed in.

create schema if not exists online;

-- Clients reach the schema through the API, but only what is granted below.
grant usage on schema online to authenticated, service_role;

create type online.room_status as enum ('lobby', 'playing', 'finished');
create type online.member_role as enum ('host', 'player', 'spectator');

-- Constants ----------------------------------------------------------------

create function online.max_seats() returns integer
language sql immutable as $$ select 8 $$;

-- Rooms a single user may have open (lobby or playing) as host at once.
create function online.max_open_rooms_per_host() returns integer
language sql immutable as $$ select 3 $$;

-- Tables -------------------------------------------------------------------

create table online.rooms (
  id uuid primary key default gen_random_uuid(),
  -- 6 characters without look-alikes (no 0/O, 1/I/L).
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  game text not null check (game in ('ambicioso')),
  status online.room_status not null default 'lobby',
  config jsonb not null,
  -- Game state, written only by the Edge Function once the game starts.
  state jsonb,
  -- Bumped on every change; the Edge Function uses it to reject stale moves.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per phone (signed-in user) in a room.
create table online.room_members (
  room_id uuid not null references online.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role online.member_role not null,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (room_id, user_id)
);

create unique index room_members_one_host on online.room_members (room_id) where role = 'host';
create index room_members_user on online.room_members (user_id);

-- One row per player. A phone can control several seats (pass-and-play inside an online room).
create table online.room_seats (
  room_id uuid not null,
  seat smallint not null check (seat >= 0 and seat < 8),
  user_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 24),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  removed boolean not null default false,
  primary key (room_id, seat),
  foreign key (room_id, user_id) references online.room_members (room_id, user_id) on delete cascade
);

create unique index room_seats_unique_color on online.room_seats (room_id, color) where not removed;

-- Every accepted move, for debugging and replaying a game.
create table online.room_actions (
  room_id uuid not null references online.rooms (id) on delete cascade,
  version integer not null,
  user_id uuid not null,
  action jsonb not null,
  created_at timestamptz not null default now(),
  primary key (room_id, version)
);

-- Row level security ---------------------------------------------------------

alter table online.rooms enable row level security;
alter table online.room_members enable row level security;
alter table online.room_seats enable row level security;
alter table online.room_actions enable row level security;

-- SECURITY DEFINER so the policies below can check membership without recursing into themselves.
create function online.is_member(target_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from online.room_members m
    where m.room_id = target_room and m.user_id = (select auth.uid())
  )
$$;

create policy "Members read their rooms" on online.rooms
  for select to authenticated using (online.is_member(id));
create policy "Members read who is in their rooms" on online.room_members
  for select to authenticated using (online.is_member(room_id));
create policy "Members read the seats in their rooms" on online.room_seats
  for select to authenticated using (online.is_member(room_id));
create policy "Members read the moves in their rooms" on online.room_actions
  for select to authenticated using (online.is_member(room_id));

-- Read-only for clients; no insert/update/delete grants at all.
revoke all on all tables in schema online from anon, authenticated;
grant select on all tables in schema online to authenticated;
grant all on all tables in schema online to service_role;

-- Functions are not callable by default; each RPC is granted explicitly below.
revoke execute on all functions in schema online from public, anon, authenticated;
alter default privileges in schema online revoke execute on functions from public;
grant execute on function online.is_member(uuid) to authenticated;

-- Helpers (not callable by clients) -----------------------------------------

create function online.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  return uid;
end
$$;

create function online.valid_config(game text, config jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  target numeric;
begin
  if game <> 'ambicioso' or jsonb_typeof(config) <> 'object'
     or (select count(*) from jsonb_object_keys(config)) <> 2
     or jsonb_typeof(config -> 'target') <> 'number'
     or coalesce(config ->> 'targetMode', '') not in ('reachOrPass', 'exact') then
    return false;
  end if;
  target := (config ->> 'target')::numeric;
  return target between 50 and 100000 and target % 50 = 0;
end
$$;

create function online.new_room_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, 1 + get_byte(bytes, i) % length(alphabet), 1);
  end loop;
  return code;
end
$$;

create function online.lock_lobby(target_room uuid) returns online.rooms
language plpgsql volatile set search_path = '' as $$
declare
  r online.rooms;
begin
  select * into r from online.rooms where id = target_room for update;
  if not found or not online.is_member(target_room) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'lobby' then
    raise exception 'game_already_started' using errcode = '55000';
  end if;
  return r;
end
$$;

create function online.touch(target_room uuid) returns void
language sql volatile set search_path = '' as $$
  update online.rooms set version = version + 1, updated_at = now() where id = target_room
$$;

create function online.insert_seat(target_room uuid, owner uuid, seat_name text, seat_color text)
returns smallint
language plpgsql volatile set search_path = '' as $$
declare
  free_seat smallint;
begin
  -- Lowest seat number not in use (seats freed in the lobby are reused).
  select min(n) into free_seat
  from generate_series(0, online.max_seats() - 1) as n
  where not exists (select 1 from online.room_seats s where s.room_id = target_room and s.seat = n);
  if free_seat is null then
    raise exception 'room_full' using errcode = '54000';
  end if;
  if exists (select 1 from online.room_seats where room_id = target_room and color = lower(seat_color) and not removed) then
    raise exception 'color_taken' using errcode = '23505';
  end if;
  insert into online.room_seats (room_id, seat, user_id, name, color)
  values (target_room, free_seat, owner, btrim(seat_name), lower(seat_color));
  return free_seat;
end
$$;

-- Client API (RPC) -----------------------------------------------------------

-- Creates a room with the caller as host and their first player.
create function online.create_room(game text, config jsonb, player_name text, player_color text)
returns table (room_id uuid, code text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := online.require_user();
  new_id uuid;
  new_code text;
begin
  if not online.valid_config(game, config) then
    raise exception 'invalid_config' using errcode = '22023';
  end if;
  if (
    select count(*) from online.rooms r
    join online.room_members m on m.room_id = r.id
    where m.user_id = uid and m.role = 'host' and r.status <> 'finished'
  ) >= online.max_open_rooms_per_host() then
    raise exception 'too_many_rooms' using errcode = '54000';
  end if;

  loop
    begin
      new_code := online.new_room_code();
      insert into online.rooms (code, game, config) values (new_code, game, config) returning id into new_id;
      exit;
    exception when unique_violation then
      -- Code already in use: try another one.
    end;
  end loop;

  insert into online.room_members (room_id, user_id, role) values (new_id, uid, 'host');
  perform online.insert_seat(new_id, uid, player_name, player_color);
  return query select new_id, new_code;
end
$$;

-- Joins by code. Players can add seats while the room is in the lobby; after that they watch.
-- Calling it again from the same phone is harmless and returns the same room.
create function online.join_room(room_code text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := online.require_user();
  r online.rooms;
begin
  select * into r from online.rooms where code = upper(btrim(room_code)) for update;
  if not found or r.status = 'finished' then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  insert into online.room_members (room_id, user_id, role)
  values (r.id, uid, case when r.status = 'lobby' then 'player' else 'spectator' end::online.member_role)
  on conflict do nothing;
  if found then
    perform online.touch(r.id);
  end if;
  return r.id;
end
$$;

-- Adds a player controlled by the caller's phone.
create function online.add_seat(target_room uuid, player_name text, player_color text) returns smallint
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := online.require_user();
  seat smallint;
begin
  perform online.lock_lobby(target_room);
  if exists (select 1 from online.room_members where room_id = target_room and user_id = uid and role = 'spectator') then
    raise exception 'spectators_cannot_play' using errcode = '42501';
  end if;
  seat := online.insert_seat(target_room, uid, player_name, player_color);
  perform online.touch(target_room);
  return seat;
end
$$;

-- Removes a player before the game starts: your own, or anyone's if you are the host.
create function online.remove_seat(target_room uuid, target_seat smallint) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := online.require_user();
  owner uuid;
begin
  perform online.lock_lobby(target_room);
  select user_id into owner from online.room_seats where room_id = target_room and seat = target_seat and not removed;
  if owner is null then
    raise exception 'seat_not_found' using errcode = 'P0002';
  end if;
  if owner <> uid and not exists (
    select 1 from online.room_members where room_id = target_room and user_id = uid and role = 'host'
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from online.room_seats where room_id = target_room and seat = target_seat;
  perform online.touch(target_room);
end
$$;

-- Host only, before the game starts.
create function online.update_config(target_room uuid, config jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := online.require_user();
  r online.rooms;
begin
  r := online.lock_lobby(target_room);
  if not exists (select 1 from online.room_members where room_id = target_room and user_id = uid and role = 'host') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not online.valid_config(r.game, config) then
    raise exception 'invalid_config' using errcode = '22023';
  end if;
  update online.rooms set config = update_config.config where id = target_room;
  perform online.touch(target_room);
end
$$;

-- Leaves a room that has not started (or has finished). If the host leaves, the
-- longest-standing remaining player becomes host; an empty room is deleted.
-- Leaving mid-game is handled by the Edge Function (the player's seats are kept).
create function online.leave_room(target_room uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := online.require_user();
  r online.rooms;
  was_host boolean;
begin
  select * into r from online.rooms where id = target_room for update;
  if not found or not online.is_member(target_room) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  if r.status = 'playing' then
    raise exception 'game_in_progress' using errcode = '55000';
  end if;

  delete from online.room_members where room_id = target_room and user_id = uid
  returning role = 'host' into was_host;

  if not exists (select 1 from online.room_members where room_id = target_room) then
    delete from online.rooms where id = target_room;
    return;
  end if;

  if was_host then
    update online.room_members set role = 'host'
    where (room_id, user_id) = (
      select m.room_id, m.user_id from online.room_members m
      where m.room_id = target_room
      order by (m.role = 'player') desc, m.joined_at
      limit 1
    );
  end if;
  perform online.touch(target_room);
end
$$;

grant execute on function
  online.create_room(text, jsonb, text, text),
  online.join_room(text),
  online.add_seat(uuid, text, text),
  online.remove_seat(uuid, smallint),
  online.update_config(uuid, jsonb),
  online.leave_room(uuid)
to authenticated;
