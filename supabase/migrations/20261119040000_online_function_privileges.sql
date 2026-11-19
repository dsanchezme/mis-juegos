-- Locks down who can call what in the `online` schema.
--
-- The first migration revoked EXECUTE before creating its functions, and Postgres gives
-- every new function EXECUTE to PUBLIC (a per-schema default cannot take that away). So the
-- helpers and the RPCs were callable by anyone, including requests without a session.
-- Nothing could be abused (each RPC requires a signed-in user and the helpers need write
-- grants nobody has), but only what the app needs should be reachable.

revoke execute on all functions in schema online from public, anon, authenticated;

-- What phones call (signed in, anonymous or not).
grant execute on function
  online.create_room(text, jsonb, text, text),
  online.join_room(text),
  online.add_seat(uuid, text, text),
  online.remove_seat(uuid, smallint),
  online.update_config(uuid, jsonb),
  online.leave_room(uuid),
  online.is_member(uuid) -- used by the row level security policies
to authenticated;

-- Functions created later by migrations start closed too; each grant stays explicit.
alter default privileges for role postgres in schema online revoke execute on functions from public;

-- Constants: a fixed search_path, like every other function here.
alter function online.max_seats() set search_path = '';
alter function online.max_open_rooms_per_host() set search_path = '';
