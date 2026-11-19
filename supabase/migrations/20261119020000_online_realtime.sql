-- Phones follow their room live: every lobby change and every move bumps `rooms.version`,
-- so listening to the room row is enough. Realtime applies the same row level security,
-- so a phone only hears about rooms it belongs to.
alter publication supabase_realtime add table online.rooms;
