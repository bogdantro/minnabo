-- 0102_nabolag_innlandet.sql
--  Asked 2026-11-12: nabolag for every kommune MinNabo offers, not only Lillehammer (0065).
--  The towns, bydeler and bygder people say they live in, per kommune (Moelv and Brumunddal in Ringsaker,
--  Raufoss in Vestre Toten, Otta in Sel …). Approximate areas only, never an address (rule 6).
--
--  Safe to run again, and it never changes what is already there:
--   * a (kommune, place) that exists is skipped – Lillehammer's 21 and anything renamed, hidden or
--     re-ordered in Admin › Nabolag stay as they are (on conflict do nothing on neighbourhoods_area_uidx);
--   * new ones get a sort after the kommune's existing nabolag, in the order below;
--   * nobody is added as a member, and no oppslag moves: an oppslag for the whole kommune stays that.
--  Hide or rename any of them in Admin › Nabolag; hide instead of delete (0065).

with wanted(municipality, places) as (
  values
    -- Lillehammer-regionen (Lillehammer has its own list from 0065)
    ('Øyer',          array['Tingberg', 'Granrudmoen', 'Hafjell', 'Tretten', 'Musdal']),
    ('Gausdal',       array['Segalstad bru', 'Follebu', 'Forset', 'Østre Gausdal', 'Svatsum', 'Espedalen', 'Skeikampen']),
    -- Hamar-regionen
    ('Hamar',         array['Sentrum', 'Storhamar', 'Briskebyen', 'Ankerskogen', 'Furuberget', 'Børstad', 'Hjellum',
                            'Ridabu', 'Ingeberg', 'Vang', 'Prestrud', 'Disen']),
    ('Ringsaker',     array['Brumunddal', 'Moelv', 'Furnes', 'Nes', 'Rudshøgda', 'Stavsjø', 'Næroset', 'Brøttum',
                            'Mesnali', 'Sjusjøen', 'Gaupen', 'Veldre']),
    ('Stange',        array['Stange sentrum', 'Ottestad', 'Sandvika', 'Romedal', 'Ilseng', 'Tangen', 'Espa', 'Vallset']),
    ('Løten',         array['Løten sentrum', 'Ådalsbruk']),
    -- Gjøvik-regionen
    ('Gjøvik',        array['Sentrum', 'Hunndalen', 'Bybrua', 'Kopperud', 'Hovdetoppen', 'Kallerud', 'Nordbyberget',
                            'Vindingstad', 'Bråstad', 'Biri', 'Redalen', 'Snertingdal']),
    ('Østre Toten',   array['Lena', 'Skreia', 'Kapp', 'Totenvika', 'Hoff']),
    ('Vestre Toten',  array['Raufoss', 'Reinsvoll', 'Bøverbru', 'Eina']),
    ('Søndre Land',   array['Hov', 'Fall', 'Odnes']),
    ('Nordre Land',   array['Dokka', 'Torpa', 'Nord-Torpa', 'Aust-Torpa']),
    -- Hadeland
    ('Gran',          array['Gran sentrum', 'Brandbu', 'Jaren', 'Bjoneroa']),
    -- Valdres
    ('Nord-Aurdal',   array['Fagernes', 'Leira', 'Aurdal']),
    ('Sør-Aurdal',    array['Bagn', 'Begnadalen', 'Hedalen', 'Reinli']),
    ('Etnedal',       array['Bruflat']),
    ('Vestre Slidre', array['Slidre', 'Røn']),
    ('Øystre Slidre', array['Heggenes', 'Rogne', 'Beitostølen']),
    ('Vang',          array['Grindaheim', 'Ryfoss']),
    -- Midt-Gudbrandsdal
    ('Ringebu',       array['Vålebru', 'Fåvang', 'Venabygd', 'Kvitfjell']),
    ('Sør-Fron',      array['Hundorp', 'Harpefoss', 'Gålå']),
    ('Nord-Fron',     array['Vinstra', 'Kvam', 'Skåbu']),
    -- Nord-Gudbrandsdal
    ('Sel',           array['Otta', 'Sjoa', 'Heidal']),
    ('Vågå',          array['Vågåmo', 'Lalm']),
    ('Lom',           array['Fossbergom', 'Bøverdalen']),
    ('Skjåk',         array['Bismo']),
    ('Dovre',         array['Dombås', 'Dovre', 'Hjerkinn']),
    ('Lesja',         array['Lesja', 'Lesjaskog', 'Bjorli']),
    -- Sør-Østerdal
    ('Elverum',       array['Sentrum', 'Hernes', 'Heradsbygd', 'Sørskogbygda', 'Jømna']),
    ('Trysil',        array['Innbygda', 'Nybergsund', 'Ljørdalen', 'Trysilfjellet']),
    ('Åmot',          array['Rena', 'Osen', 'Deset']),
    ('Stor-Elvdal',   array['Koppang', 'Atna', 'Evenstad']),
    ('Engerdal',      array['Engerdal', 'Drevsjø']),
    -- Nord-Østerdal
    ('Tynset',        array['Tynset sentrum', 'Tylldalen', 'Kvikne', 'Brydalen']),
    ('Alvdal',        array['Alvdal']),
    ('Folldal',       array['Folldal']),
    ('Os',            array['Os', 'Dalsbygda', 'Narbuvoll']),
    ('Rendalen',      array['Åkrestrømmen', 'Otnes']),
    ('Tolga',         array['Tolga', 'Vingelen']),
    -- Kongsvinger-regionen
    ('Kongsvinger',   array['Sentrum', 'Brandval', 'Austmarka', 'Roverud']),
    ('Eidskog',       array['Skotterud', 'Magnor', 'Matrand']),
    ('Grue',          array['Kirkenær', 'Namnå']),
    ('Åsnes',         array['Flisa', 'Kjellmyra']),
    ('Våler',         array['Våler sentrum', 'Braskereidfoss']),
    ('Nord-Odal',     array['Sand', 'Knapper', 'Mo']),
    ('Sør-Odal',      array['Skarnes', 'Sander', 'Disenå'])
),
listed as (
  select w.municipality, t.place, t.i
    from wanted w, unnest(w.places) with ordinality as t(place, i)
),
start as (
  -- after whatever the kommune already has, so an admin's order is kept
  select l.municipality, coalesce((select max(n.sort) from neighbourhoods n where n.municipality = l.municipality), 0) as base
    from (select distinct municipality from listed) l
)
insert into neighbourhoods (name, place, municipality, sort, active)
select l.place || ' nabolag', l.place, l.municipality, s.base + l.i * 10, true
  from listed l join start s using (municipality)
on conflict (municipality, place) do nothing;
