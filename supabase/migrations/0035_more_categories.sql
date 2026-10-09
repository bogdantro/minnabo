-- 0035_more_categories.sql — 12 more oppdrag categories (mirrors src/domain/categories.ts).
-- Only jobs neighbours may legally do; regulated trades (electrical, plumbing) stay out.
insert into categories (slug, label, icon) values
  ('snekring','Snekring/småreparasjoner','snekring'),
  ('vinduspuss','Vinduspuss','vinduspuss'),
  ('bilpleie','Bilpleie','bilpleie'),
  ('handling','Handling og ærender','handling'),
  ('leksehjelp','Leksehjelp','leksehjelp'),
  ('husvakt','Hus- og plantevakt','husvakt'),
  ('ved','Ved og fyring','ved'),
  ('bortkjoring','Bortkjøring og rydding','bortkjoring'),
  ('sykkel','Sykkelreparasjon','sykkel'),
  ('matlaging','Matlaging og baking','matlaging'),
  ('selskap','Selskap og følge','selskap'),
  ('barnevakt','Barnevakt','barnevakt')
on conflict (slug) do update set label = excluded.label, icon = excluded.icon;
