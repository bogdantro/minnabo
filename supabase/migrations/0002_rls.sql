-- 0002_rls.sql — row level security (spec §4)

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_participant(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv and profile_id = auth.uid()
  );
$$;

create or replace function owns_listing(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings where id = l and owner_id = auth.uid());
$$;

alter table profiles                  enable row level security;
alter table verifications             enable row level security;
alter table business_profiles         enable row level security;
alter table consent_records           enable row level security;
alter table categories                enable row level security;
alter table listings                  enable row level security;
alter table task_details              enable row level security;
alter table service_offer_details     enable row level security;
alter table listing_images            enable row level security;
alter table saved_listings            enable row level security;
alter table saved_searches            enable row level security;
alter table conversations             enable row level security;
alter table conversation_participants enable row level security;
alter table proposals                 enable row level security;
alter table messages                  enable row level security;
alter table message_reads             enable row level security;
alter table proposal_revisions        enable row level security;
alter table agreement_snapshots       enable row level security;
alter table completion_confirmations  enable row level security;
alter table reviews                   enable row level security;
alter table reports                   enable row level security;
alter table blocks                    enable row level security;
alter table notifications             enable row level security;
alter table partners                  enable row level security;
alter table partner_placements        enable row level security;
alter table donation_records          enable row level security;

-- profiles
create policy p_profiles_read on profiles for select to authenticated using (true);
create policy p_profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- verifications / business_profiles: read own or admin; writes via RPC only
create policy p_verif_read on verifications for select to authenticated
  using (profile_id = auth.uid() or is_admin());
create policy p_biz_read on business_profiles for select to authenticated
  using (profile_id = auth.uid() or is_admin());

-- consent: own only
create policy p_consent_all on consent_records for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- read-only content
create policy p_categories_read on categories for select to authenticated using (true);
create policy p_partners_read on partners for select to authenticated using (true);
create policy p_placements_read on partner_placements for select to authenticated using (true);
create policy p_donations_read on donation_records for select to authenticated using (true);

-- listings + detail + images
create policy p_listings_read on listings for select to authenticated
  using (status <> 'REMOVED' or owner_id = auth.uid());
create policy p_listings_ins on listings for insert to authenticated
  with check (owner_id = auth.uid());
create policy p_listings_upd on listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_listings_del on listings for delete to authenticated
  using (owner_id = auth.uid());

create policy p_task_read on task_details for select to authenticated using (true);
create policy p_task_write on task_details for all to authenticated
  using (owns_listing(listing_id)) with check (owns_listing(listing_id));
create policy p_soffer_read on service_offer_details for select to authenticated using (true);
create policy p_soffer_write on service_offer_details for all to authenticated
  using (owns_listing(listing_id)) with check (owns_listing(listing_id));
create policy p_limg_read on listing_images for select to authenticated using (true);
create policy p_limg_write on listing_images for all to authenticated
  using (owns_listing(listing_id)) with check (owns_listing(listing_id));

-- saved
create policy p_saved_all on saved_listings for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy p_savedsearch_all on saved_searches for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- conversations
create policy p_conv_read on conversations for select to authenticated
  using (is_participant(id));
create policy p_convpart_read on conversation_participants for select to authenticated
  using (is_participant(conversation_id));

-- messages
create policy p_msg_read on messages for select to authenticated
  using (is_participant(conversation_id));
create policy p_msg_ins on messages for insert to authenticated
  with check (is_participant(conversation_id)
              and author_id = auth.uid()
              and kind in ('TEXT','IMAGE'));

create policy p_reads_all on message_reads for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- proposals / revisions / agreements: read if participant; write via RPC only
create policy p_prop_read on proposals for select to authenticated
  using (is_participant(conversation_id));
create policy p_prev_read on proposal_revisions for select to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id and is_participant(p.conversation_id)));
create policy p_agree_read on agreement_snapshots for select to authenticated
  using (exists (select 1 from proposals p where p.id = proposal_id and is_participant(p.conversation_id)));

-- completion / reviews
create policy p_comp_read on completion_confirmations for select to authenticated
  using (exists (select 1 from proposals p where p.id = agreement_proposal_id and is_participant(p.conversation_id)));
create policy p_reviews_read on reviews for select to authenticated using (true);

-- reports / blocks
create policy p_reports_read on reports for select to authenticated
  using (by_profile_id = auth.uid() or is_admin());
create policy p_reports_ins on reports for insert to authenticated
  with check (by_profile_id = auth.uid());
create policy p_reports_upd on reports for update to authenticated
  using (is_admin()) with check (is_admin());
create policy p_blocks_all on blocks for all to authenticated
  using (by_profile_id = auth.uid()) with check (by_profile_id = auth.uid());

-- notifications
create policy p_notif_all on notifications for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
