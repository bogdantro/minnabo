import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import type { CategoryId } from '@/theme/theme';
import type { IconName } from '@/components/ui';
import { CATEGORIES, categoryArtId } from '@/domain/categories';
import { milestonesFor } from '@/domain/milestones';
import nb from '@/i18n/nb';
import {
  useConversations,
  useEndorsements,
  useFollowedProfileIds,
  useProfile,
  useReviews,
  useToggleEndorsement,
  useCanEndorse,
  useToggleFollow,
  useUpdateProfile,
  usePortfolio,
  useReliability,
  useReplyMinutes,
} from '@/api/queries';
import { useSession } from '@/auth/session';
import { useMyAccount } from '@/auth/identity';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { longDate, monthYear, replyTime } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { categoryLabels, colors, fonts, radius, screenPadding, shadow, text } from '@/theme/theme';
import { FallbackScreen } from '@/components/FallbackScreen';
import { ProfileReviews, firstName } from '@/components/profile/ProfileReviews';
import { PortfolioViewer, VERIF_ART, VerifSheet, portfolioWhere, type VerifKind } from '@/components/profile/ProfileSheets';
import {
  Avatar,
  Button,
  CategoryArt,
  FadeUp,
  GrowBar,
  Icon,
  IconButton,
  KeyValueRow,
  Pill,
  PressableScale,
  Screen,
  Segmented,
  SubHeader,
  Tabs,
  TextLink,
  Toggle,
} from '@/components/ui';

type Tab = 'om' | 'rev' | 'port';
type View_ = 'me' | 'public';

/** Category art for an endorsed skill ("Hagearbeid" → hage); `annet` when nothing matches. */
function artForSkill(skill: string): CategoryId {
  const s = skill.toLowerCase();
  const hit = (Object.keys(categoryLabels) as CategoryId[]).find(
    (id) => id !== 'annet' && s.includes(categoryLabels[id].split('/')[0].toLowerCase()),
  );
  if (hit) return hit;
  const cat = CATEGORIES.find((c) => s.includes(c.label.split('/')[0].toLowerCase()));
  return cat ? categoryArtId(cat.slug) : 'annet';
}

/** Profil (design/screens/Profil.dc.html) – own profile with a public preview, or someone else's. */
export function ProfileScreen({ profileId, initialTab }: { profileId?: string; initialTab?: 'om' | 'rev' | 'port' }) {
  const router = useRouter();
  const myId = useSession().userId ?? '';
  const me = useCurrentUser();
  const account = useMyAccount().data;
  const id = profileId ?? myId;
  const isSelf = id === myId;
  const { data: profile, isLoading, isError, refetch } = useProfile(id);
  const { data: reviews } = useReviews(id);
  const { data: endorsements } = useEndorsements(id);
  const endorse = useToggleEndorsement(id);
  const canEndorse = !!useCanEndorse(isSelf ? undefined : id).data;
  const { data: followed } = useFollowedProfileIds();
  const toggleFollow = useToggleFollow();
  const { data: conversations } = useConversations();
  const update = useUpdateProfile();
  const replyMinutes = useReplyMinutes(id || undefined).data;
  const rel = useReliability(id || undefined).data;
  const { data: portfolioItems } = usePortfolio(id || undefined);

  const [tab, setTab] = useState<Tab>(initialTab ?? 'om');
  const [view, setView] = useState<View_>('me');
  const [verif, setVerif] = useState<VerifKind | null>(null);
  const [photo, setPhoto] = useState<number | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!profile) {
    return (
      <FallbackScreen
        status={isError ? 'error' : isLoading ? 'loading' : 'empty'}
        onRetry={() => refetch()}
        emptyText="Fant ikke profilen."
        title={nb.profile.title}
      />
    );
  }

  const isPub = !isSelf || view === 'public';
  const preview = isSelf && view === 'public';
  const first = firstName(profile.displayName);
  const reviewList = reviews ?? [];
  const portfolio = portfolioItems ?? [];
  const isFollowing = (followed ?? []).includes(id);
  const conversation = isSelf
    ? undefined
    : [...(conversations ?? [])]
        .filter((c) => c.counterpart.id === id)
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))[0];

  const share = async () => {
    try {
      await Clipboard.setStringAsync(Linking.createURL(`/profil/${id}`));
      toast.success(nb.profile.linkCopied, { icon: 'copy' });
    } catch {
      toast.error(nb.toast.genericError);
    }
  };
  const previewTap = () => toast.info(nb.profile.previewTap, { icon: 'eye' });

  const setVacation = (on: boolean) =>
    update.mutate(
      { paused: on },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(on ? nb.profile.vacOnToast : nb.profile.vacOffToast, { icon: on ? 'moon' : 'sun' });
        },
        onError: () => toast.error(nb.toast.genericError),
      },
    );

  // Vipps-ID is always there: login is Vipps only (CLAUDE.md rule 3).
  const verifKinds: VerifKind[] = [
    'VIPPS',
    ...profile.verifications.filter((v) => v.verified).map((v) => v.kind as VerifKind),
  ];
  const checkedFor = (k: VerifKind): string[] => {
    if (k === 'VIPPS') {
      return [
        nb.profile.vippsName(profile.displayName),
        ...(isSelf && !me.isYouth ? [nb.profile.vippsAdult] : []),
        nb.profile.vippsOne,
      ];
    }
    const v = profile.verifications.find((x) => x.kind === k);
    return v?.explanation ? [v.explanation] : [];
  };

  // Vipps-ID is confirmed at onboarding; the others carry their own verified_at.
  const verifDate = (k: VerifKind): string | undefined => {
    const at = k === 'VIPPS' ? profile.onboardedAt : profile.verifications.find((x) => x.kind === k)?.verifiedAt;
    return at ? longDate(at) : undefined;
  };

  const categories = (profile.categorySlugs ?? []).map((slug) => categoryArtId(slug));
  const catLabels = new Set(categories.map((c) => categoryLabels[c].toLowerCase()));
  const extraServices = (profile.services ?? []).filter((s) => !catLabels.has(s.toLowerCase()));

  const endorseList = endorsements ?? profile.endorsements ?? [];
  // Others can endorse any of the person's categories; their own view lists what neighbours endorsed.
  const recSkills = Array.from(
    new Set([
      ...endorseList.filter((e) => e.count > 0).map((e) => e.skill),
      ...(isSelf ? [] : categories.map((c) => categoryLabels[c])),
    ]),
  );

  const score = profile.reliability?.score;
  const milestones = milestonesFor({ completedTasks: profile.completedTasks, replyMinutes, rating: profile.rating });
  // Last-12-months figures when the backend has them (0044); the old overall score otherwise.
  type RelBar = { label: string; icon: IconName; value: number };
  const relBars = (
    [
      { label: nb.profile.relShowsUp, icon: 'hand', value: rel?.showsUp ?? score },
      { label: nb.profile.relOnTime, icon: 'clock', value: rel?.onTime },
      { label: nb.profile.relCompletes, icon: 'checks', value: rel?.completes },
    ] as { label: string; icon: IconName; value: number | undefined }[]
  ).filter((x): x is RelBar => x.value != null);
  const pills: { label: string; icon: IconName }[] = [
    ...(profile.languages?.length ? [{ label: profile.languages.join(', '), icon: 'globe' as IconName }] : []),
    ...(profile.hasCar ? [{ label: nb.profile.hasCar, icon: 'transport' as IconName }] : []),
    ...(profile.availabilityText ? [{ label: profile.availabilityText, icon: 'clock' as IconName }] : []),
  ];
  const statTiles = [
    { key: 'jobs', value: String(profile.completedTasks ?? 0), label: nb.profile.statJobs, star: false },
    ...(profile.rating
      ? [{ key: 'rating', value: profile.rating.average.toFixed(1).replace('.', ','), label: nb.profile.statReviews(profile.rating.count), star: true }]
      : []),
    ...(replyMinutes != null
      ? [{ key: 'reply', value: replyTime(replyMinutes), label: nb.profile.statReply, star: false, small: true }]
      : []),
  ];

  return (
    <Screen
      scroll
      spacer="none"
      header={
        <SubHeader
          title={nb.profile.title}
          onBack={back}
          sideWidth={98}
          right={
            <View style={styles.headBtns}>
              <IconButton icon="share" iconSize={18} accessibilityLabel={nb.profile.shareLabel} onPress={share} />
              {isSelf ? (
                <IconButton icon="gear" iconSize={18} accessibilityLabel={nb.profile.settingsLabel} onPress={() => safePush('/innstillinger')} />
              ) : (
                <IconButton icon="flag" iconSize={18} accessibilityLabel={nb.profile.reportOrBlock} onPress={() => safePush(`/rapporter?profil=${id}`)} />
              )}
            </View>
          }
        />
      }
    >
      {isSelf && !isPub && profile.paused ? (
        <FadeUp style={[styles.px, styles.mt4]}>
          <View style={styles.vacBanner}>
            <View style={[styles.icirc, styles.icirc34, styles.white]}>
              <Icon name="moon" size={18} color={colors.warn} />
            </View>
            <Text style={styles.vacBannerText}>{nb.profile.vacBanner}</Text>
            <Button label={nb.profile.vacTurnOff} variant="ghost" size="sm" block={false} onPress={() => setVacation(false)} style={styles.vacOff} />
          </View>
        </FadeUp>
      ) : null}

      {/* head */}
      <View style={[styles.px, styles.head]}>
        <View>
          <Avatar initials={profile.initials} uri={profile.avatarUrl} size={88} me={isSelf} seed={profile.id} />
          <View style={[styles.icirc, styles.avBadge, shadow.whiteRing3]}>
            <Icon name="check" size={16} color={colors.white} />
          </View>
        </View>
        <FadeUp delay={80}>
          <Text style={styles.name} accessibilityRole="header">{profile.displayName}</Text>
        </FadeUp>
        <FadeUp delay={120} style={styles.badges}>
          <View style={styles.vbadge}>
            <Icon name="shield" size={14} color={colors.verified} />
            <Text style={[text.verified, { color: colors.verified }]}>{nb.profile.vippsVerified}</Text>
          </View>
          {isPub && profile.paused ? <Pill label={nb.profile.onVacation} tone="warn" icon="moon" /> : null}
        </FadeUp>
        {/* earned badges: oppdrag fullført, quick replies, high vurderinger */}
        {milestones.length ? (
          <FadeUp delay={120} style={styles.badges}>
            {milestones.map((m) => (
              <Pill key={m.key} label={m.label} tone={m.key === 'jobs' ? 'ok' : 'neutral'} icon={m.icon} />
            ))}
          </FadeUp>
        ) : null}
        <FadeUp delay={120} style={styles.metaCol}>
          <View style={styles.metaRow}>
            <Icon name="pin" size={14} color={colors.mute} />
            <Text style={text.meta}>{profile.location.place}</Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="cal" size={14} color={colors.mute} />
            <Text style={text.meta}>
              {nb.profile.memberSinceLine(profile.memberSinceDate ? monthYear(profile.memberSinceDate) : profile.memberSince)}
            </Text>
          </View>
        </FadeUp>
        {!isPub ? (
          <FadeUp delay={160} style={styles.mt16}>
            <Button label={nb.profile.edit} variant="ghost" size="sm" icon="edit" block={false} onPress={() => safePush('/profil/rediger')} style={styles.editBtn} />
          </FadeUp>
        ) : preview ? (
          <FadeUp style={[styles.mt16, styles.row10]}>
            {/* what a neighbour sees: "Følg" (and "Ta kontakt" only for someone you already chat with) */}
            <Button label={nb.profile.follow} variant="cyan" icon="user-plus" onPress={previewTap} style={styles.flex} />
          </FadeUp>
        ) : (
          <FadeUp style={[styles.mt16, styles.row10]}>
            {conversation ? (
              <Button label={nb.profile.contact} variant="cyan" icon="msg" onPress={() => safePush(`/chat/${conversation.id}`)} style={styles.flex} />
            ) : null}
            <Button
              label={isFollowing ? nb.profile.following : nb.profile.follow}
              variant={conversation ? 'ghost' : isFollowing ? 'ghost' : 'cyan'}
              icon={isFollowing ? 'check' : 'user-plus'}
              loading={toggleFollow.isPending}
              style={styles.flex}
              onPress={() =>
                toggleFollow.mutate(id, {
                  onSuccess: () => {
                    haptics.light();
                    toast.success(isFollowing ? nb.profile.unfollowedToast : nb.profile.followedToast);
                  },
                })
              }
            />
          </FadeUp>
        )}
      </View>

      {/* stats */}
      <FadeUp delay={200} style={[styles.px, styles.row10, styles.mt22]}>
        {statTiles.map((s) => (
          <View key={s.key} style={[styles.stat, shadow.card]} accessible accessibilityLabel={`${s.value} ${s.label}`}>
            <View style={styles.statVal}>
              {s.star ? <Icon name="star" size={18} color={colors.star} filled /> : null}
              <Text style={[styles.statNum, 'small' in s && s.small && styles.statNumSm]}>{s.value}</Text>
            </View>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </FadeUp>

      {isSelf ? (
        <FadeUp delay={240} style={[styles.px, styles.mt18]}>
          <Segmented
            accessibilityLabel={nb.profile.viewLabel}
            value={view}
            onChange={setView}
            options={[
              { value: 'me', label: nb.profile.viewMe },
              { value: 'public', label: nb.profile.viewPub, icon: 'eye' },
            ]}
          />
          {preview ? (
            <FadeUp style={styles.note}>
              <Icon name="eye" size={15} color={colors.faint} />
              <Text style={text.note}>{nb.profile.previewNote}</Text>
            </FadeUp>
          ) : null}
        </FadeUp>
      ) : null}

      {!isPub ? (
        <FadeUp delay={280} style={[styles.px, styles.mt14]}>
          <View style={[styles.card, styles.vacCard, shadow.card]}>
            <View style={[styles.icirc, styles.icirc44, { backgroundColor: profile.paused ? colors.warnTint : colors.line2 }]}>
              <Icon name="moon" size={22} color={profile.paused ? colors.warn : colors.mute} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.vacTitle}>{nb.profile.vacTitle}</Text>
              <Text style={[text.meta, styles.mt3]}>{profile.paused ? nb.profile.vacOnDesc : nb.profile.vacOffDesc}</Text>
            </View>
            <Toggle value={!!profile.paused} onValueChange={setVacation} accessibilityLabel={nb.profile.vacTitle} disabled={update.isPending} />
          </View>
        </FadeUp>
      ) : null}

      <FadeUp delay={320} style={styles.mt22}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'om', label: nb.profile.tabOm },
            { value: 'rev', label: nb.profile.tabRev(reviewList.length) },
            { value: 'port', label: nb.profile.tabPort },
          ]}
        />
      </FadeUp>

      {tab === 'om' ? (
        <View style={[styles.px, styles.stack14]}>
          {profile.presentation ? (
            <FadeUp style={[styles.card, shadow.card]}>
              <Text style={text.eyebrow}>{nb.profile.presentation}</Text>
              <Text style={[text.body, styles.presText]}>{profile.presentation}</Text>
              {pills.length ? (
                <View style={styles.pills}>
                  {pills.map((pl) => (
                    <Pill key={pl.label} label={pl.label} icon={pl.icon} tone="neutral" />
                  ))}
                </View>
              ) : null}
            </FadeUp>
          ) : pills.length ? (
            <FadeUp style={[styles.card, shadow.card]}>
              <View style={[styles.pills, styles.mt0]}>
                {pills.map((pl) => (
                  <Pill key={pl.label} label={pl.label} icon={pl.icon} tone="neutral" />
                ))}
              </View>
            </FadeUp>
          ) : null}

          {categories.length || extraServices.length ? (
            <FadeUp delay={40} style={[styles.card, shadow.card]}>
              <Text style={text.eyebrow}>{nb.profile.catsEyebrow}</Text>
              <View style={[styles.wrap8, styles.mt12]}>
                {categories.map((c) => (
                  <View key={c} style={styles.catChip}>
                    <CategoryArt category={c} width={26} height={26} radius={13} iconSize={14} />
                    <Text style={styles.catText}>{categoryLabels[c]}</Text>
                  </View>
                ))}
                {extraServices.map((s) => (
                  <View key={s} style={[styles.catChip, styles.catChipPlain]}>
                    <Text style={styles.catText}>{s}</Text>
                  </View>
                ))}
              </View>
              {!isPub ? <TextLink label={nb.profile.seeMyListings} onPress={() => safePush('/mine')} style={styles.mt6} /> : null}
            </FadeUp>
          ) : null}

          <FadeUp delay={80} style={[styles.card, shadow.card]}>
            <View style={styles.between}>
              <Text style={text.eyebrow}>{nb.profile.verifEyebrow}</Text>
              <Text style={[text.meta, styles.f12]}>{nb.profile.tapForDetails}</Text>
            </View>
            <View style={[styles.row8, styles.mt12]}>
              {verifKinds.map((k) => {
                const art = VERIF_ART[k];
                const copy = nb.profile.verif[k];
                return (
                  <PressableScale
                    key={k}
                    accessibilityRole="button"
                    accessibilityLabel={nb.profile.verifAria(copy.title)}
                    onPress={() => setVerif(k)}
                    style={styles.vchip}
                  >
                    <View style={[styles.icirc, styles.icirc34, { backgroundColor: art.bg }]}>
                      <Icon name={art.icon} size={18} color={art.fg} />
                    </View>
                    <Text style={styles.vchipTitle} numberOfLines={1}>{copy.short}</Text>
                    <View style={styles.vchipOk}>
                      <Icon name="check" size={14} color={colors.okText} />
                      <Text style={styles.vchipOkText}>{nb.profile.verified}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </FadeUp>

          {relBars.length ? (
            <FadeUp delay={120} style={[styles.card, shadow.card]}>
              <View style={styles.between}>
                <Text style={text.eyebrow}>{nb.profile.reliability}</Text>
                {relBars.every((b) => b.value >= 95) ? <Pill label={nb.profile.relTop} tone="ok" icon="award" size="sm" /> : null}
              </View>
              <View style={[styles.stack14, styles.mt14]}>
                {relBars.map((b) => (
                  <View key={b.label} style={styles.stack7}>
                    <View style={styles.between}>
                      <View style={styles.relLabel}>
                        <Icon name={b.icon} size={16} color={colors.mute} />
                        <Text style={styles.relText}>{b.label}</Text>
                      </View>
                      <Text style={styles.relVal}>{`${b.value} %`}</Text>
                    </View>
                    <GrowBar fill={b.value / 100} color={colors.toggleOn} />
                  </View>
                ))}
              </View>
              <Text style={[text.meta, styles.f12, styles.mt12]}>
                {rel ? nb.profile.relBasis12(rel.completed) : nb.profile.relBasis(profile.reliability?.completed ?? 0)}
              </Text>
            </FadeUp>
          ) : null}

          {recSkills.length ? (
            <FadeUp delay={160} style={[styles.card, shadow.card]}>
              <Text style={text.eyebrow}>{nb.profile.recsEyebrow}</Text>
              <View style={styles.mt6}>
                {recSkills.map((skill, i) => {
                  const e = endorseList.find((x) => x.skill === skill);
                  const count = e?.count ?? 0;
                  const mine = !!e?.byMe;
                  const art = artForSkill(skill);
                  return (
                    <View key={skill} style={[styles.recRow, i < recSkills.length - 1 && styles.recDivider]}>
                      <CategoryArt category={art} width={40} height={40} radius={13} iconSize={20} />
                      <View style={styles.flex}>
                        <Text style={styles.recLabel}>{skill}</Text>
                        <Text style={text.meta}>{nb.profile.recsCount(count)}</Text>
                      </View>
                      {!isSelf && (canEndorse || mine) ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: mine }}
                          accessibilityLabel={nb.profile.recommendAria(skill, mine)}
                          onPress={() => endorse.mutate(skill)}
                          hitSlop={8}
                          style={styles.recBtnHit}
                        >
                          <Pill
                            label={mine ? nb.profile.recommended : nb.profile.recommend}
                            tone={mine ? 'ok' : 'line'}
                            icon={mine ? 'check' : 'plus'}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <Text style={[text.meta, styles.f12, styles.mt10]}>{nb.profile.recsNote(first)}</Text>
            </FadeUp>
          ) : null}

          {!isPub ? (
            <FadeUp delay={200} style={styles.privCard}>
              <View style={styles.row8c}>
                <Icon name="lock" size={16} color={colors.mute} />
                <Text style={text.eyebrow}>{nb.profile.privateEyebrow}</Text>
              </View>
              <View style={styles.mt6}>
                {account?.phoneMasked ? <KeyValueRow label={nb.profile.privPhone} value={account.phoneMasked} /> : null}
                {account?.emailMasked ? <KeyValueRow label={nb.profile.privEmail} value={account.emailMasked} /> : null}
                <KeyValueRow
                  label={nb.profile.privHome}
                  value={profile.homeNotes ? nb.profile.privHomeShared : nb.profile.privNone}
                  last
                />
              </View>
              <TextLink label={nb.profile.privEdit} onPress={() => safePush('/profil/rediger')} />
            </FadeUp>
          ) : null}
        </View>
      ) : null}

      {tab === 'rev' ? <ProfileReviews profile={profile} reviews={reviewList} /> : null}

      {tab === 'port' ? (
        <View style={[styles.px, styles.pt18]}>
          {portfolio.length ? (
            <>
              <FadeUp>
                <Text style={[text.meta, styles.mb14]}>{nb.profile.portIntro(first)}</Text>
              </FadeUp>
              <View style={styles.grid}>
                {Array.from({ length: Math.ceil(portfolio.length / 2) }, (_, r) => (
                  <View key={r} style={styles.row12}>
                    {[0, 1].map((c) => {
                      const i = r * 2 + c;
                      const item = portfolio[i];
                      return item ? (
                        <FadeUp key={item.id} delay={40 * (i + 1)} style={styles.flex}>
                          <PressableScale accessibilityRole="button" accessibilityLabel={nb.profile.portOpenTitle(item.title)} onPress={() => setPhoto(i)} style={styles.ptile}>
                            <View style={[styles.tile, shadow.card]}>
                              {item.beforeUrl ? (
                                <>
                                  <Image source={{ uri: item.beforeUrl }} style={styles.half} resizeMode="cover" accessibilityIgnoresInvertColors />
                                  <Image source={{ uri: item.afterUrl }} style={styles.half} resizeMode="cover" accessibilityIgnoresInvertColors />
                                  <View style={styles.pdiv} />
                                  <View style={[styles.plab, styles.plabB]}>
                                    <Text style={[styles.plabText, { color: colors.ink2 }]}>{nb.profile.before}</Text>
                                  </View>
                                  <View style={[styles.plab, styles.plabA]}>
                                    <Text style={[styles.plabText, { color: colors.white }]}>{nb.profile.after}</Text>
                                  </View>
                                </>
                              ) : (
                                <Image source={{ uri: item.afterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                              )}
                            </View>
                            <Text style={styles.ptitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            {portfolioWhere(item) ? (
                              <Text style={[text.meta, styles.f12]} numberOfLines={1}>
                                {portfolioWhere(item)}
                              </Text>
                            ) : null}
                          </PressableScale>
                        </FadeUp>
                      ) : (
                        <View key={c} style={styles.flex} />
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          ) : isPub ? (
            <View style={styles.portEmpty}>
              <Icon name="image" size={22} color={colors.mute} />
              <Text style={styles.portEmptyText}>{nb.profile.portEmpty}</Text>
            </View>
          ) : null}
          {!isPub ? (
            <FadeUp delay={200} style={styles.mt18}>
              <Button label={nb.profile.portAdd} variant="ghost" icon="plus" onPress={() => safePush('/profil/rediger')} />
            </FadeUp>
          ) : null}
        </View>
      ) : null}

      <View style={styles.bottom} />

      <VerifSheet
        kind={verif}
        checked={checkedFor(verif ?? 'VIPPS')}
        date={verifDate(verif ?? 'VIPPS')}
        onClose={() => setVerif(null)}
        onReadMore={() => {
          setVerif(null);
          safePush('/verifisering');
        }}
      />
      <PortfolioViewer items={portfolio} index={photo} onIndex={setPhoto} onClose={() => setPhoto(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  px: { paddingHorizontal: screenPadding },
  flex: { flex: 1, minWidth: 0 },
  f12: { fontSize: 12 },
  mt3: { marginTop: 3 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  mt18: { marginTop: 18 },
  mt22: { marginTop: 22 },
  mb14: { marginBottom: 14 },
  pt18: { paddingTop: 18 },
  bottom: { height: 48 },
  row8: { flexDirection: 'row', gap: 8 },
  row8c: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row10: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  row12: { flexDirection: 'row', gap: 12 },
  wrap8: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stack7: { gap: 7 },
  stack14: { gap: 14, paddingTop: 18 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headBtns: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  icirc: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  icirc34: { width: 34, height: 34 },
  icirc44: { width: 44, height: 44 },
  white: { backgroundColor: colors.white },
  vacBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 14,
    borderRadius: 18,
    backgroundColor: colors.warnTint,
    borderWidth: 1,
    borderColor: colors.vacBorder,
  },
  vacBannerText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 18.2, color: colors.vacText },
  vacOff: { height: 36, paddingHorizontal: 12 },
  head: { alignItems: 'center', paddingTop: 14 },
  avBadge: { position: 'absolute', right: -6, bottom: -4, width: 30, height: 30, backgroundColor: colors.cyan },
  name: { ...text.h2, fontSize: 27, lineHeight: 30, letterSpacing: -0.68, marginTop: 20, textAlign: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  vbadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaCol: { marginTop: 8, gap: 4, alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editBtn: { backgroundColor: colors.glassLight },
  stat: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 6,
  },
  statVal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNumSm: { fontSize: 19 },
  statNum: { fontFamily: fonts.display, fontSize: 22, lineHeight: 22, letterSpacing: -0.44, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 15, color: colors.mute, textAlign: 'center' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'center', marginTop: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18 },
  vacCard: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  vacTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 19, color: colors.ink },
  presText: { marginTop: 10, color: colors.ink2 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 5,
    paddingRight: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  catChipPlain: { paddingLeft: 13 },
  catText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  vchip: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    minHeight: 44,
  },
  vchipTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, lineHeight: 16, color: colors.ink },
  vchipOk: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  vchipOkText: { fontFamily: fonts.bodySemi, fontSize: 11.5, lineHeight: 12, color: colors.okText },
  relLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  relText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  relVal: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  recDivider: { borderBottomWidth: 1, borderBottomColor: colors.line2 },
  recLabel: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 18, color: colors.ink },
  recBtnHit: { minHeight: 44, justifyContent: 'center' },
  privCard: {
    padding: 18,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.dashedCardBg,
  },
  grid: { gap: 14 },
  tile: { height: 132, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.track, flexDirection: 'row' },
  ptile: { gap: 6 },
  half: { flex: 1, height: '100%' },
  pdiv: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, marginLeft: -1.5, backgroundColor: colors.white },
  plab: { position: 'absolute', top: 8, height: 20, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: 'center' },
  plabB: { left: 8, backgroundColor: colors.onInk90 },
  plabA: { right: 8, backgroundColor: colors.ink },
  plabText: { fontFamily: fonts.bodyHeavy, fontSize: 10.5, letterSpacing: 0.4, textTransform: 'uppercase' },
  ptitle: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 17.5, color: colors.ink },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  mt0: { marginTop: 0 },
  portEmpty: {
    padding: 22,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
  },
  portEmptyText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
