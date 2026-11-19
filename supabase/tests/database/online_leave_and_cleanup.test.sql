-- Leaving mid-game and cleaning up old rooms. Run with `npm run db:test`.
-- Queries are scoped to the test rooms so they pass on a database that already has rooms.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, aud, role, is_anonymous) values
  ('a0000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', true),
  ('b0000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', true),
  ('c0000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', true);

insert into online.rooms (id, code, game, config, status, version) values
  ('22222222-2222-4222-8222-222222222222', 'GHJKMN', 'ambicioso', '{"target":1000,"targetMode":"reachOrPass"}', 'playing', 5);
insert into online.room_members (room_id, user_id, role) values
  ('22222222-2222-4222-8222-222222222222', 'a0000000-0000-4000-8000-000000000011', 'host'),
  ('22222222-2222-4222-8222-222222222222', 'b0000000-0000-4000-8000-000000000012', 'player'),
  ('22222222-2222-4222-8222-222222222222', 'c0000000-0000-4000-8000-000000000013', 'spectator');
insert into online.room_seats (room_id, seat, user_id, name, color, removed) values
  ('22222222-2222-4222-8222-222222222222', 0, 'a0000000-0000-4000-8000-000000000011', 'Diego', '#4cc9f0', false),
  ('22222222-2222-4222-8222-222222222222', 1, 'b0000000-0000-4000-8000-000000000012', 'Ana', '#f4b942', false);

set local role authenticated;

-- A player still in the game cannot just walk out.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select throws_ok(
  $$select online.leave_room('22222222-2222-4222-8222-222222222222')$$,
  '55000', 'game_in_progress', 'a player still in the game cannot leave'
);

-- A spectator can.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select lives_ok($$select online.leave_room('22222222-2222-4222-8222-222222222222')$$, 'a spectator leaves mid-game');

reset role;
-- Ana's player is taken out of the game (what the REMOVE_PLAYER move saves).
update online.room_seats set removed = true where room_id = '22222222-2222-4222-8222-222222222222' and seat = 1;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select lives_ok($$select online.leave_room('22222222-2222-4222-8222-222222222222')$$, 'once out of the game, a player can leave');
reset role;
select is(
  (select count(*)::integer from online.room_members where room_id = '22222222-2222-4222-8222-222222222222'),
  1, 'only the host is left in the room'
);

-- Cleanup ----------------------------------------------------------------------------
insert into online.rooms (id, code, game, config, status, updated_at) values
  ('33333333-3333-4333-8333-333333333333', 'PQRSTU', 'ambicioso', '{"target":1000,"targetMode":"reachOrPass"}', 'finished', now() - interval '25 hours'),
  ('44444444-4444-4444-8444-444444444444', 'VWXYZ2', 'ambicioso', '{"target":1000,"targetMode":"reachOrPass"}', 'playing', now() - interval '23 hours');
insert into online.room_members (room_id, user_id, role) values
  ('33333333-3333-4333-8333-333333333333', 'a0000000-0000-4000-8000-000000000011', 'host');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok($$select online.cleanup()$$, '42501', null, 'phones cannot run the cleanup');
reset role;

select cmp_ok(online.cleanup(), '>=', 1, 'the cleanup deletes old rooms');
select ok(not exists (select 1 from online.rooms where id = '33333333-3333-4333-8333-333333333333'), 'a room idle for over a day is gone');
select ok(
  not exists (select 1 from online.room_members where room_id = '33333333-3333-4333-8333-333333333333'),
  'with its members'
);
select ok(exists (select 1 from online.rooms where id = '44444444-4444-4444-8444-444444444444'), 'a room used today stays');

select * from finish();
rollback;
