-- Saves a move decided by the `room-action` Edge Function, atomically.
--
-- Only the service role (the Edge Function) can call it. It refuses the write when the
-- room changed since the function read it (optimistic concurrency), so two taps or two
-- phones at once can never both apply a move to the same state.

create function online.commit_action(
  target_room uuid,
  expected_version integer,
  actor uuid,
  action jsonb,
  new_status online.room_status,
  new_state jsonb,
  remove_seats smallint[],
  rematch boolean
) returns integer
language plpgsql volatile set search_path = '' as $$
declare
  new_version integer;
begin
  update online.rooms
  set status = new_status, state = new_state, version = version + 1, updated_at = now()
  where id = target_room and version = expected_version
  returning version into new_version;
  if not found then
    raise exception 'stale_version' using errcode = '40001';
  end if;

  update online.room_seats set removed = true
  where room_id = target_room and seat = any (remove_seats);

  if rematch then
    -- Back in the lobby: players taken out are gone and spectators may join the next game.
    delete from online.room_seats where room_id = target_room and removed;
    update online.room_members set role = 'player' where room_id = target_room and role = 'spectator';
  end if;

  insert into online.room_actions (room_id, version, user_id, action)
  values (target_room, new_version, actor, action);
  return new_version;
end
$$;

revoke execute on function online.commit_action(uuid, integer, uuid, jsonb, online.room_status, jsonb, smallint[], boolean)
  from public, anon, authenticated;
grant execute on function online.commit_action(uuid, integer, uuid, jsonb, online.room_status, jsonb, smallint[], boolean)
  to service_role;
