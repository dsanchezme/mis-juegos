-- Stage 5: leaving a game in progress, and cleaning up old rooms.

-- Leaving ---------------------------------------------------------------------------
create or replace function online.leave_room(target_room uuid) returns void
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
  -- Mid-game you first take your players out of the game (a move, so everyone sees it);
  -- spectators, and phones whose players are all out, can leave any time.
  if r.status = 'playing' and exists (
    select 1 from online.room_seats s where s.room_id = target_room and s.user_id = uid and not s.removed
  ) then
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

-- Cleanup -----------------------------------------------------------------------------
-- Rooms nobody has touched for a day are deleted with everything in them. Each phone keeps
-- its own history, so nothing is lost; the free database stays small.
create function online.cleanup() returns integer
language sql volatile security definer set search_path = '' as $$
  with gone as (
    delete from online.rooms where updated_at < now() - interval '24 hours' returning 1
  )
  select count(*)::integer from gone;
$$;
revoke execute on function online.cleanup() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
-- Every hour (scheduling again under the same name just updates the job).
select cron.schedule('online-cleanup', '23 * * * *', 'select online.cleanup()');
