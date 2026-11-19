-- Security and lobby rules for online rooms. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Test users ---------------------------------------------------------------
insert into auth.users (id, aud, role, is_anonymous) values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true), -- Alice
  ('b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', true), -- Bob
  ('c0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', true); -- Carol

-- Acts as a signed-in user for the rest of the transaction (until the next call).
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true), set_config('role', 'anon', true);
$$;

-- Structure ----------------------------------------------------------------
select has_schema('online');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where relnamespace = 'online'::regnamespace and relkind = 'r'),
  'every online table has row level security'
);
select is(
  (select count(*)::int from pg_class where relnamespace = 'online'::regnamespace and relkind = 'r'),
  4, 'online has rooms, room_members, room_seats and room_actions'
);

-- Signed out ---------------------------------------------------------------
select pg_temp.logout();
select throws_ok('select * from online.rooms', '42501', null, 'anon cannot read rooms');
select throws_ok(
  $$select * from online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass"}', 'Eve', '#f4b942')$$,
  '42501', null, 'anon cannot create rooms'
);
reset role;
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select * from online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass"}', 'Eve', '#f4b942')$$,
  '28000', 'not_signed_in', 'a request without a user is rejected'
);
reset role;

-- Alice creates a room -----------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select * from online.create_room('ambicioso', '{"target":5001,"targetMode":"reachOrPass"}', 'Alice', '#f4b942')$$,
  '22023', 'invalid_config', 'target must be a multiple of 50'
);
select throws_ok(
  $$select * from online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass","x":1}', 'Alice', '#f4b942')$$,
  '22023', 'invalid_config', 'unknown config keys are rejected'
);
select throws_ok(
  $$select * from online.create_room('ambicioso', '{"target":"a lot","targetMode":"exact"}', 'Alice', '#f4b942')$$,
  '22023', 'invalid_config', 'a non-numeric target is rejected'
);
select set_config('test.room', room_id::text, false), set_config('test.code', code, false)
from online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass"}', ' Alice ', '#F4B942');

select matches(current_setting('test.code'), '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$', 'room code has 6 unambiguous characters');
select results_eq(
  $$select role::text from online.room_members where room_id = current_setting('test.room')::uuid$$,
  array['host'], 'the creator is the host'
);
select results_eq(
  $$select seat::int, name, color from online.room_seats where room_id = current_setting('test.room')::uuid$$,
  $$values (0, 'Alice', '#f4b942')$$, 'the host gets seat 0 with a trimmed name and lower-case color'
);

-- Bob is not in the room yet -----------------------------------------------
select pg_temp.login('b0000000-0000-4000-8000-000000000002');
select is_empty('select * from online.rooms', 'outsiders cannot see a room');
select is_empty('select * from online.room_seats', 'outsiders cannot see its players');
select throws_ok(
  $$insert into online.rooms (code, game, config) values ('ZZZZZZ', 'ambicioso', '{}')$$,
  '42501', null, 'clients cannot insert rooms directly'
);
select throws_ok(
  $$update online.rooms set state = '{}'$$, '42501', null, 'clients cannot update rooms directly'
);
select throws_ok(
  $$select online.insert_seat(current_setting('test.room')::uuid, auth.uid(), 'Bob', '#4cc9f0')$$,
  '42501', null, 'internal helpers are not callable'
);
select throws_ok($$select online.join_room('NOPE22')$$, 'P0002', 'room_not_found', 'unknown codes are rejected');

-- Bob joins and adds players on his phone ----------------------------------
select is(online.join_room(lower(current_setting('test.code'))), current_setting('test.room')::uuid, 'join by code ignores case');
select is(online.join_room(current_setting('test.code')), current_setting('test.room')::uuid, 'joining twice is harmless');
select is((select count(*)::int from online.room_members), 2, 'members see everyone in the room');
select throws_ok(
  $$select online.add_seat(current_setting('test.room')::uuid, 'Bob', '#f4b942')$$,
  '23505', 'color_taken', 'two players cannot share a color'
);
select is(online.add_seat(current_setting('test.room')::uuid, 'Bob', '#4cc9f0'), 1::smallint, 'Bob gets seat 1');
select is(online.add_seat(current_setting('test.room')::uuid, 'Juli', '#7fdc97'), 2::smallint, 'a phone can hold several players');
select throws_ok(
  $$select online.update_config(current_setting('test.room')::uuid, '{"target":3000,"targetMode":"exact"}')$$,
  '42501', 'not_allowed', 'only the host changes the rules'
);
select throws_ok(
  $$select online.remove_seat(current_setting('test.room')::uuid, 0::smallint)$$,
  '42501', 'not_allowed', 'players cannot remove someone else'
);

-- Alice manages the lobby ---------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$select online.update_config(current_setting('test.room')::uuid, '{"target":3000,"targetMode":"exact"}')$$,
  'the host changes the rules'
);
select lives_ok($$select online.remove_seat(current_setting('test.room')::uuid, 2::smallint)$$, 'the host removes any player');
select is(online.add_seat(current_setting('test.room')::uuid, 'Pipe', '#7fdc97'), 2::smallint, 'freed seats are reused');
select lives_ok($$
  select online.add_seat(current_setting('test.room')::uuid, 'P' || n, c)
  from unnest(array['#f27aa7', '#c3a6ff', '#ff9f68', '#5ee0d0', '#e4e4e4']) with ordinality as t(c, n)
$$, 'the room fills up to 8 players');
select throws_ok(
  $$select online.add_seat(current_setting('test.room')::uuid, 'Nine', '#123456')$$,
  '54000', 'room_full', 'a ninth player is rejected'
);

-- The game starts (the Edge Function will do this) --------------------------
reset role;
update online.rooms set status = 'playing' where id = current_setting('test.room')::uuid;

select pg_temp.login('c0000000-0000-4000-8000-000000000003');
select lives_ok($$select online.join_room(current_setting('test.code'))$$, 'people can join a game in progress');
select results_eq(
  $$select role::text from online.room_members where user_id = auth.uid()$$,
  array['spectator'], '... as spectators'
);
select throws_ok(
  $$select online.add_seat(current_setting('test.room')::uuid, 'Carol', '#000000')$$,
  '55000', 'game_already_started', 'nobody adds players once the game started'
);

-- Host hand-off and empty rooms ---------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select set_config('test.room2', room_id::text, false), set_config('test.code2', code, false)
from online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass"}', 'Alice', '#f4b942');
select pg_temp.login('b0000000-0000-4000-8000-000000000002');
select online.join_room(current_setting('test.code2'));
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select online.leave_room(current_setting('test.room2')::uuid);
reset role;
select results_eq(
  $$select user_id::text, role::text from online.room_members where room_id = current_setting('test.room2')::uuid$$,
  $$values ('b0000000-0000-4000-8000-000000000002', 'host')$$,
  'when the host leaves, the next player becomes host'
);
select pg_temp.login('b0000000-0000-4000-8000-000000000002');
select online.leave_room(current_setting('test.room2')::uuid);
reset role;
select is_empty(
  $$select 1 from online.rooms where id = current_setting('test.room2')::uuid$$,
  'an empty room is deleted'
);

-- Limit on open rooms -------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass"}', 'Alice', '#f4b942');
select online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass"}', 'Alice', '#f4b942');
select throws_ok(
  $$select online.create_room('ambicioso', '{"target":5000,"targetMode":"reachOrPass"}', 'Alice', '#f4b942')$$,
  '54000', 'too_many_rooms', 'one person cannot open endless rooms'
);

select * from finish();
rollback;
