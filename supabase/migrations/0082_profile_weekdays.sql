-- 0082_profile_weekdays.sql
-- «Når er du vanligvis ledig?» on Rediger profil: the weekdays a helper is usually
-- free (0 = søndag … 6 = lørdag, like «Tilbyr hjelp» in 0076). The owner then sees
-- «Ledig lørdag» next to a tilbud for a Saturday job, and the profile shows
-- «Ledig helg». Public like the rest of the profile; empty = not said.

alter table profiles add column if not exists available_weekdays smallint[]
  check (available_weekdays is null or (available_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]));
