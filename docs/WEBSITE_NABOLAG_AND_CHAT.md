# Admin work for the website: Nabolag and MinNabo chat (2026-10-13)

For the website project (`minnaboweb`). The app and the database side are built in the app repo
(migrations `0065_nabolag.sql` and `0066_minnabo_chat.sql`). The admin has no pages for them yet. This
file says what to build and which database functions to use.

The next free migration number is **0067**. Do not redefine the functions these two migrations create.
The website connects as `postgres`, so it can call the admin functions and read the tables directly;
the app cannot.

## 1. Admin › Nabolag (new page)

Nabolag are now a list MinNabo owns. Users can no longer create them; they join up to three from
Fellesskap → Nabolag in the app, and members get a varsel about new oppslag in their nabolag.

Table `public.neighbourhoods`:

| Column | Meaning |
|---|---|
| `name` | Shown as the title in the app. Convention: `"<place> nabolag"` (e.g. `Vingnes nabolag`). |
| `place` | The short name in lists (e.g. `Vingnes`). Unique together with `municipality`. |
| `municipality` | Kommune name, spelled as in `profiles.municipality` (e.g. `Lillehammer`). |
| `active` | `false` hides it in the app. Members keep their membership; nobody new can join. |
| `sort` | Order in the app's list (ascending, then by `place`). |

Members are in `public.neighbourhood_members (neighbourhood_id, profile_id, joined_at)`.
Oppslag for one nabolag have `noticeboard_posts.neighbourhood_id` set; `null` means the whole kommune.

The page needs:

- A list per kommune with the name, member count, oppslag count, active/hidden and sort order.
- **Create** (kommune, place; set `name = place || ' nabolag'`), **rename**, **hide / show**, **reorder**.
- **Merge A into B**: move the members (`insert … on conflict do nothing`, then delete A's rows), move the
  oppslag (`update noticeboard_posts set neighbourhood_id = B where neighbourhood_id = A`), then hide or
  delete A.
- **Delete** only when the nabolag has no oppslag: the foreign key is `ON DELETE RESTRICT`, so a delete
  with oppslag fails. Offer "hide" or "merge" instead.

Seeded today, all in Lillehammer: Sentrum, Nordre Ål, Søre Ål, Vingnes, Vingrom, Jørstadmoen, Fåberg,
Rudsbygd, Saksumdal, Nordseter, Røyslimoen, Vårsetergrenda, Kringsjå, Hammartun, Smestad, Skårsetlia,
Busmoen, Ekrom, Storhove, Stampesletta, Kanten. Other kommuner have none; the app then says oppslag are
for the whole kommune.

Also:

- **Admin › Oppslag:** show which nabolag an oppslag belongs to ("Bare Vingnes") or "Hele kommunen", and
  let the list be filtered by nabolag. Moderation is unchanged.
- **Admin › Brukere, user detail:** show the user's nabolag (at most 3).
- A person in three nabolag cannot join a fourth (`join_nabolag()` refuses). If the admin adds members by
  hand, keep to the same limit.

## 2. Admin › Chats (new tab) and "Send melding"

There is now a thread between each user and "MinNabo", shown pinned at the top of Innboks in the app.
The user can answer. A message can go to one person or to many, and one sent to many can be a plain
message, a news item or a poll.

**Replace the current "Send melding".** `apps/adminportal/views_users.py` calls
`notify_moderation(profile, 'Melding fra MinNabo', text, null)`, which only makes a varsel: nothing lands
in Innboks and the user cannot answer. Call `minnabo_send_message` instead.

### Functions to call

```sql
-- one person; returns the message id. Also creates the varsel (push) that opens the thread.
select public.minnabo_send_message(p_profile => %s, p_body => %s, p_staff => %s);

-- how many people a filter reaches – show "Sendes til N personer" before sending
select public.minnabo_audience_count(%s::jsonb);

-- many people; returns the broadcast id
select public.minnabo_send_broadcast(
  p_kind      => %s,          -- 'MESSAGE' | 'NEWS' | 'POLL'
  p_title     => %s,          -- required for NEWS, optional otherwise
  p_body      => %s,          -- 1–2000 characters
  p_options   => %s,          -- text[]: 2–6 options, POLL only
  p_audience  => %s::jsonb,   -- see below
  p_staff     => %s,          -- who sent it (shown only in the admin)
  p_closes_at => %s);         -- optional timestamptz, POLL only
```

Audience filter (all keys optional; an empty object means everyone):

```json
{ "municipalities": ["Lillehammer", "Gjøvik"], "nabolag": ["<neighbourhood uuid>"], "account": "all" }
```

`account` is `"all"`, `"adult"` or `"youth"`. The filters combine with AND; several kommuner or several
nabolag combine with OR inside their key. Deleted accounts and app admins never receive anything.

The send form needs: type (melding / nyhet / spørsmål), title, text, poll options and optional closing
time, the three filters, the live recipient count, and a confirm step before sending to many.

### What to read

- `public.minnabo_messages`: one row per message in a user's thread.
  - `from_admin = true`: from MinNabo. `broadcast_id` is set when it was a copy of a broadcast.
    `read_at` = when the user read it.
  - `from_admin = false`: the user's answer. `reply_to_broadcast_id` = the broadcast they were answering
    (the last one they had received), or null for an answer in a one-to-one thread.
    `read_at` = when the admin read it. **The website sets this** when the thread is opened in the admin.
- `public.minnabo_broadcasts`: one row per message sent to many (kind, title, body, poll options,
  closing time, the audience filter as sent, `recipients`, `created_by`).
- `public.minnabo_poll_votes (broadcast_id, profile_id, option, created_at)`: `option` is 1-based.
- View `public.minnabo_broadcast_stats`: per broadcast `recipients`, `read_count`, `reply_count`,
  `vote_count` and `votes` (an int array, one count per option in order).

### The Chats tab

- **Tråder:** every user with a thread, newest activity first, with an unread marker when the latest user
  message has `read_at is null`. Opening one shows the whole thread and a reply box
  (`minnabo_send_message`), and marks the user's messages read.
- **Utsendelser:** every broadcast from `minnabo_broadcast_stats` with kind, title, when, who sent it, the
  audience in words, recipients, read, answers.
  - Detail of one: the text, and all answers to it (`minnabo_messages where reply_to_broadcast_id = id`)
    with the user's name, each linking to that user's thread.
  - For a poll: each option with count and percent (`votes`), total votes, and who voted for what
    (`minnabo_poll_votes`). Allow closing a poll early by setting `poll_closes_at = now()`.
- **Admin › Brukere, user detail:** show that user's thread and the same reply box.

### Rules the database enforces

- A user can send at most 30 messages to MinNabo per 24 hours, 2000 characters each.
- A user sees a poll's result only after voting, or when it has closed. Votes can be changed until then.
- When a user deletes the account, their thread and votes are deleted at once.
- Messages older than 24 months are deleted nightly (`minnabo_purge_old`, pg_cron `minnabo-chat-retention`).
- Each message to a user creates one varsel of kind `MODERATION` with route `/minnabo`, which the app's
  push trigger sends. A broadcast to everyone therefore creates one varsel per user.

## 3. Texts

- **Personvern, section 2:** add the rows "Nabolag du er med i" (Deg; vise oppslag og sende varsler) and
  "Meldinger mellom deg og MinNabo, og svar i avstemninger" (Deg; kundeservice og tilbakemeldinger).
- **Personvern, section 5:** the line "Meldinger og bilder … 24 måneder" also covers messages with MinNabo.
- **Hjelp:** if it explains how to contact MinNabo, mention that MinNabo can write to you in Innboks and
  that MinNabo never asks for passwords, codes or payment (the app says this in the thread).

## 4. Local dev database

Apply `0064`–`0066` to `minnabo_dev` as well. `0064` needs `auth.users.last_sign_in_at` and
`auth.sessions.created_at / updated_at / refreshed_at` in the stand-in `auth` schema (see
`docs/WEBSITE_LEGAL_TEXTS.md`).
