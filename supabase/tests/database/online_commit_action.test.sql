-- Saving moves from the Edge Function. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, aud, role, is_anonymous) values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true),
  ('b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', true),
  ('c0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', true);

insert into online.rooms (id, code, game, config, status, version)
values ('11111111-1111-4111-8111-111111111111', 'ABCDEF', 'ambicioso', '{"target":1000,"targetMode":"reachOrPass"}', 'playing', 5);
insert into online.room_members (room_id, user_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'host'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000002', 'player'),
  ('11111111-1111-4111-8111-111111111111', 'c0000000-0000-4000-8000-000000000003', 'spectator');
insert into online.room_seats (room_id, seat, user_id, name, color) values
  ('11111111-1111-4111-8111-111111111111', 0, 'a0000000-0000-4000-8000-000000000001', 'Diego', '#4cc9f0'),
  ('11111111-1111-4111-8111-111111111111', 1, 'b0000000-0000-4000-8000-000000000002', 'Ana', '#f4b942'),
  ('11111111-1111-4111-8111-111111111111', 2, 'b0000000-0000-4000-8000-000000000002', 'Pipe', '#7fdc97');

-- Players cannot call it ------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select online.commit_action('11111111-1111-4111-8111-111111111111', 5, auth.uid(), '{"type":"ROLL"}',
    'playing', '{"cheat":true}', '{}', false)$$,
  '42501', null, 'a phone cannot save a game state itself'
);
reset role;

-- The Edge Function (service role) ------------------------------------------------
set local role service_role;
select is(
  online.commit_action('11111111-1111-4111-8111-111111111111', 5, 'a0000000-0000-4000-8000-000000000001',
    '{"type":"ROLL"}', 'playing', '{"turn":1}', '{}', false),
  6, 'a move bumps the version'
);
select is((select state from online.rooms), '{"turn":1}'::jsonb, 'and saves the new state');
select results_eq(
  $$select version, action from online.room_actions$$,
  $$values (6, '{"type":"ROLL"}'::jsonb)$$,
  'and logs the move'
);
select throws_ok(
  $$select online.commit_action('11111111-1111-4111-8111-111111111111', 5, 'a0000000-0000-4000-8000-000000000001',
    '{"type":"ROLL"}', 'playing', '{"turn":2}', '{}', false)$$,
  '40001', 'stale_version', 'a move based on an old version is refused'
);
select is((select state from online.rooms), '{"turn":1}'::jsonb, '... and changes nothing');

select online.commit_action('11111111-1111-4111-8111-111111111111', 6, 'a0000000-0000-4000-8000-000000000001',
  '{"type":"REMOVE_PLAYER","seat":2}', 'finished', '{"turn":3}', '{2}', false);
select results_eq(
  $$select seat::int, removed from online.room_seats order by seat$$,
  $$values (0, false), (1, false), (2, true)$$,
  'removed players are marked, not deleted, during the game'
);
select is((select status::text from online.rooms), 'finished', 'the status follows the game');

select online.commit_action('11111111-1111-4111-8111-111111111111', 7, 'a0000000-0000-4000-8000-000000000001',
  '{"type":"REMATCH"}', 'lobby', '{"turn":3}', '{}', true);
select results_eq(
  $$select seat::int from online.room_seats order by seat$$,
  $$values (0), (1)$$,
  'a rematch clears removed players'
);
select is(
  (select role::text from online.room_members where user_id = 'c0000000-0000-4000-8000-000000000003'),
  'player', 'and lets spectators play'
);
select is((select version from online.rooms), 8, 'every move is one version');

select * from finish();
rollback;
