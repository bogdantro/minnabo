-- 0103_youth_nabolag.sql
--  Asked 2026-11-12: a youth account can join a nabolag (like an adult, at most 3).
--  0038 blocked it with a trigger on neighbourhood_members; 0065 kept that. Joining still only goes through
--  join_nabolag() (active nabolag, at most 3), and a member reads and writes that nabolag's oppslag and svar
--  like any member – a youth could already write on Oppslagstavla (0094).
--  Still closed for youth: the private reply to an oppslag's author (start_conversation_for_notice), the
--  arrangement group chat (0101) and everything else rule 5 keeps locked.

drop trigger if exists neighbourhood_members_block_youth on neighbourhood_members;
