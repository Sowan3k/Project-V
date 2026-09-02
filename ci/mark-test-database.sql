-- Marks a throwaway CI database as disposable.
--
-- tests/db/setup.ts refuses to run the integration suite unless this row is present, so the
-- suite cannot be pointed at production by a mistaken environment variable. Production has
-- never carried this row and must never be given it.
insert into platform_meta (key, value, "updatedAt")
values ('environment', 'test', now())
on conflict (key) do update set value = 'test', "updatedAt" = now();
