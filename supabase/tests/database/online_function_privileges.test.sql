-- Who can call which function in the `online` schema. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'online'::regnamespace and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'requests without a session cannot call any function'
);

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'online'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')),
  array['add_seat', 'create_room', 'is_member', 'join_room', 'leave_room', 'remove_seat', 'update_config'],
  'phones can call only the lobby functions'
);

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'online'::regnamespace and has_function_privilege('service_role', p.oid, 'execute')
     and not has_function_privilege('authenticated', p.oid, 'execute')),
  array['commit_action'],
  'only the Edge Function can save moves'
);

select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'online'::regnamespace
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0,
  'every function has a fixed search_path'
);

select * from finish();
rollback;
