import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BusinessProfile } from '@/api/ApiClient';
import nb from '@/i18n/nb';
import { useMyBusinessProfile, useSubmitBusinessProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { categoryLabels, colors, fonts, radius, screenPadding, shadow, text, type CategoryId } from '@/theme/theme';
import { isValidOrgNr, lookupOrgNr, type BrregCompany } from '@/lib/brreg';
import { dayMonth, daysAgo, formatTime } from '@/lib/datetime';
import { haptics } from '@/lib/haptics';
import { safePush } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { slugForArtId } from '@/domain/categories';
import {
  Button,
  CategoryArt,
  Checkbox,
  ErrorText,
  FadeUp,
  Field,
  Icon,
  Input,
  KeyValueRow,
  RowSkeleton,
  ScaleIn,
  Screen,
  Spinner,
  StickyFooter,
  SubHeader,
  TextLink,
  type IconName,
} from '@/components/ui';

const CATS = Object.keys(categoryLabels) as CategoryId[];
type Lookup = { state: 'idle' } | { state: 'looking' } | { state: 'found'; company: BrregCompany } | { state: 'notFound' } | { state: 'error' };

const groupOrg = (d: string) => d.replace(/(\d{3})(?=\d)/g, '$1 ');
const groupPhone = (d: string) => d.replace(/^(\d{3})(\d{0,2})(\d{0,3})$/, (_m, a, b, c) => [a, b, c].filter(Boolean).join(' '));

/** For bedrifter (design/screens/Bedrift.dc.html). */
export function BedriftRegistreringScreen() {
  const router = useRouter();
  const { data: existing, isLoading } = useMyBusinessProfile();
  const [editing, setEditing] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/innstillinger'));

  const showStatus = existing && !editing;
  return showStatus ? (
    <Screen scroll spacer="none" header={<SubHeader title={nb.bedrift.title} onBack={back} />}>
      <Status biz={existing} onBack={() => router.replace('/innstillinger')} onEdit={() => setEditing(true)} />
    </Screen>
  ) : isLoading ? (
    <Screen header={<SubHeader title={nb.bedrift.title} onBack={back} />}>
      <View style={[styles.px, styles.mt8]}>
        <RowSkeleton />
      </View>
    </Screen>
  ) : (
    <Form back={back} prefill={existing ?? undefined} onSent={() => setEditing(false)} />
  );
}

function Form({ back, prefill, onSent }: { back: () => void; prefill?: BusinessProfile; onSent: () => void }) {
  const me = useCurrentUser();
  const submit = useSubmitBusinessProfile();
  const [digits, setDigits] = useState(prefill?.orgNr ?? '');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  // null = untouched → falls back to my name once the profile has loaded
  const [contactEdit, setContact] = useState<string | null>(prefill?.contactPerson ?? null);
  const contact = contactEdit ?? me.displayName ?? '';
  const [email, setEmail] = useState(prefill?.email ?? '');
  const [phone, setPhone] = useState(prefill ? groupPhone(prefill.phone.replace(/\D/g, '').slice(-8)) : '');
  const [cats, setCats] = useState<CategoryId[]>(() =>
    prefill ? CATS.filter((c) => prefill.categorySlugs.includes(slugForArtId(c))) : [],
  );
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const seq = useRef(0);

  const runLookup = async (d: string) => {
    const mine = ++seq.current;
    setLookup({ state: 'looking' });
    try {
      const company = await lookupOrgNr(d);
      if (mine !== seq.current) return;
      setLookup(company ? { state: 'found', company } : { state: 'notFound' });
    } catch {
      if (mine === seq.current) setLookup({ state: 'error' });
    }
  };

  // A prefilled org number (re-submit) is looked up once on open.
  const prefilled = useRef(prefill?.orgNr);
  useEffect(() => {
    if (prefilled.current && isValidOrgNr(prefilled.current)) void runLookup(prefilled.current);
  }, []);

  const onOrg = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 9);
    setDigits(d);
    if (d.length === 9 && isValidOrgNr(d)) void runLookup(d);
    else {
      seq.current++;
      setLookup({ state: 'idle' });
    }
  };

  const orgErr = (() => {
    if (digits.length === 9 && !/^[89]/.test(digits)) return nb.bedrift.errOrgStart;
    if (digits.length === 9 && !isValidOrgNr(digits)) return nb.bedrift.errOrgInvalid;
    if (lookup.state === 'notFound') return nb.bedrift.errOrgNotFound;
    if (lookup.state === 'error') return nb.bedrift.errOrgLookup;
    if (tried && digits.length < 9) return digits.length ? nb.bedrift.errOrgLength : nb.bedrift.errOrgEmpty;
    if (tried && lookup.state === 'looking') return nb.bedrift.errOrgNotLooked;
    return null;
  })();
  const phoneDigits = phone.replace(/\D/g, '');
  const ok = {
    org: lookup.state === 'found',
    contact: contact.trim().length >= 2,
    email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim()),
    phone: phoneDigits.length === 8,
    cats: cats.length > 0,
    consent,
  };
  const allOk = Object.values(ok).every(Boolean);

  const send = () => {
    if (submit.isPending) return;
    if (!allOk || lookup.state !== 'found') {
      setTried(true);
      haptics.warning();
      return;
    }
    submit.mutate(
      {
        orgNr: digits,
        companyName: lookup.company.name,
        contactPerson: contact.trim(),
        email: email.trim(),
        phone: `+47${phoneDigits}`,
        categorySlugs: cats.map(slugForArtId),
      },
      {
        onSuccess: () => {
          haptics.success();
          onSent();
        },
        onError: () => toast.error(nb.bedrift.failed, { bottom: 130 }),
      },
    );
  };

  return (
    <Screen
      scroll
      spacer="foot"
      header={<SubHeader title={nb.bedrift.title} onBack={back} />}
      footer={
        <StickyFooter>
          <Button
            label={submit.isPending ? nb.bedrift.sending : nb.bedrift.submit}
            variant="cyan"
            size="lg"
            icon="send"
            loading={submit.isPending}
            onPress={send}
          />
        </StickyFooter>
      }
    >
      <FadeUp style={[styles.px, styles.mt8]}>
        <View style={styles.hero}>
          <View style={styles.glow} />
          <View style={styles.heroIcon}>
            <Icon name="building" size={24} color={colors.ink} />
          </View>
          <Text style={[text.h2, styles.white, styles.mt14]} accessibilityRole="header">
            {nb.bedrift.heroTitle}
          </Text>
          <Text style={styles.heroBody}>{nb.bedrift.heroBody}</Text>
          <View style={styles.benefits}>
            {nb.bedrift.benefits.map((b) => (
              <View key={b.title} style={styles.ben}>
                <View style={styles.benIcon}>
                  <Icon name={b.icon as IconName} size={18} color={colors.lime} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.benTitle}>{b.title}</Text>
                  <Text style={styles.benSub}>{b.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </FadeUp>

      <View style={[styles.px, styles.form]}>
        <Text style={text.eyebrow}>{nb.bedrift.about}</Text>
        <Field label={nb.bedrift.orgNr} hint={nb.bedrift.orgNrHint} error={orgErr} help={lookup.state === 'looking' ? undefined : nb.bedrift.orgNrHelp}>
          <View>
            <Input
              value={groupOrg(digits)}
              onChangeText={onOrg}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="123 456 789"
              autoComplete="off"
              error={!!orgErr}
              accessibilityLabel={nb.bedrift.orgNr}
              style={styles.orgInput}
            />
            <View style={styles.statR} pointerEvents="none">
              {lookup.state === 'looking' ? <Spinner size={20} color={colors.cyanDeep} /> : null}
              {lookup.state === 'found' ? (
                <ScaleIn>
                  <View style={styles.okDot}>
                    <Icon name="check" size={14} color={colors.white} />
                  </View>
                </ScaleIn>
              ) : null}
            </View>
          </View>
          {lookup.state === 'looking' ? <Text style={styles.looking}>{nb.bedrift.looking}</Text> : null}
        </Field>

        {lookup.state === 'found' ? (
          <FadeUp style={styles.gap14}>
            <Field label={nb.bedrift.companyName} hint={nb.bedrift.fromRegistry}>
              <View style={styles.ro}>
                <Icon name="building" size={18} color={colors.mute} />
                <Text style={styles.roText}>{lookup.company.name}</Text>
              </View>
            </Field>
            {lookup.company.address || lookup.company.form ? (
              <View style={styles.found}>
                <View style={styles.foundIcon}>
                  <Icon name="map" size={16} color={colors.ok} />
                </View>
                <Text style={styles.foundText}>
                  {lookup.company.address ? <Text style={styles.foundStrong}>{`${lookup.company.address}\n`}</Text> : null}
                  {[[lookup.company.postalCode, lookup.company.city].filter(Boolean).join(' '), lookup.company.form].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ) : null}
          </FadeUp>
        ) : null}

        <View style={styles.divider} />
        <Text style={text.eyebrow}>{nb.bedrift.contact}</Text>
        <Field label={nb.bedrift.contactPerson} error={tried && !ok.contact ? nb.bedrift.errContact : null}>
          <Input value={contact} onChangeText={setContact} placeholder={nb.bedrift.contactPersonPh} error={tried && !ok.contact} accessibilityLabel={nb.bedrift.contactPerson} />
        </Field>
        <Field label={nb.bedrift.email} error={tried && !ok.email ? nb.bedrift.errEmail : null}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder={nb.bedrift.emailPh}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={tried && !ok.email}
            accessibilityLabel={nb.bedrift.email}
          />
        </Field>
        <Field label={nb.bedrift.phone} error={tried && !ok.phone ? nb.bedrift.errPhone : null}>
          <Input
            value={phone}
            onChangeText={(t) => setPhone(groupPhone(t.replace(/\D/g, '').slice(0, 8)))}
            prefix="+47"
            placeholder={nb.bedrift.phonePh}
            keyboardType="phone-pad"
            inputMode="tel"
            error={tried && !ok.phone}
            accessibilityLabel={nb.bedrift.phone}
          />
        </Field>

        <View style={styles.divider} />
        <View style={styles.labelRow}>
          <Text style={text.label}>{nb.bedrift.categories}</Text>
          <Text style={text.hint}>{nb.bedrift.catCount(cats.length)}</Text>
        </View>
        <View style={styles.cats}>
          {CATS.map((c) => {
            const on = cats.includes(c);
            return (
              <Pressable
                key={c}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={categoryLabels[c]}
                onPress={() => setCats((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
                style={[styles.chip, on && styles.chipOn]}
              >
                <CategoryArt category={c} width={28} height={28} radius={14} iconSize={14} />
                <Text style={[styles.chipText, on && styles.white]}>{categoryLabels[c]}</Text>
              </Pressable>
            );
          })}
        </View>
        {tried && !ok.cats ? <ErrorText>{nb.bedrift.errCats}</ErrorText> : null}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel={nb.bedrift.consentAria}
          onPress={() => setConsent((c) => !c)}
          style={styles.consent}
        >
          <View pointerEvents="none">
            <Checkbox checked={consent} />
          </View>
          <Text style={styles.consentText}>
            {nb.bedrift.consentPre}
            <Text style={styles.bold}>{nb.bedrift.consentLink}</Text>.
          </Text>
        </Pressable>
        {tried && !consent ? <ErrorText>{nb.bedrift.errConsent}</ErrorText> : null}
        <TextLink label={nb.bedrift.readTerms} icon="arrowur" onPress={() => safePush('/vilkar')} />
      </View>
    </Screen>
  );
}

function Status({ biz, onBack, onEdit }: { biz: BusinessProfile; onBack: () => void; onEdit: () => void }) {
  const approved = biz.status === 'APPROVED';
  const rejected = biz.status === 'REJECTED';
  const sentWhen = daysAgo(biz.createdAt) === 0 ? `I dag kl. ${formatTime(biz.createdAt)}` : `${dayMonth(biz.createdAt)} kl. ${formatTime(biz.createdAt)}`;
  const catNames = CATS.filter((c) => biz.categorySlugs.includes(slugForArtId(c))).map((c) => categoryLabels[c]).join(', ');
  return (
    <View style={[styles.px, styles.mt14]}>
      <View style={styles.statusHead}>
        <ScaleIn>
          <View style={[styles.statusIcon, shadow.medium]}>
            <Icon name={approved ? 'verified' : rejected ? 'alert' : 'hourglass'} size={40} color={approved ? colors.ok : rejected ? colors.danger : colors.cyanDeep} />
          </View>
        </ScaleIn>
        <FadeUp delay={100}>
          <Text style={[text.h1, styles.centerText, styles.mt10]} accessibilityRole="header">
            {approved ? nb.bedrift.approvedTitle : rejected ? nb.bedrift.rejectedTitle : nb.bedrift.pendingTitle}
          </Text>
        </FadeUp>
        <FadeUp delay={140}>
          <Text style={[text.body, styles.ink2, styles.centerText]}>
            {approved ? nb.bedrift.approvedBody : rejected ? nb.bedrift.rejectedBody : nb.bedrift.pendingBody}
          </Text>
        </FadeUp>
      </View>

      <FadeUp delay={180} style={[styles.card, styles.pad, styles.mt22, shadow.card]}>
        <TlRow state="done" icon="check" title={nb.bedrift.tlSent} sub={sentWhen} />
        <TlRow state={approved ? 'done' : rejected ? 'todo' : 'now'} icon="hourglass" title={nb.bedrift.tlReview} sub={nb.bedrift.tlReviewSub} />
        <TlRow state={approved ? 'done' : 'todo'} icon="verified" title={nb.bedrift.tlDone} sub={nb.bedrift.tlDoneSub} last />
      </FadeUp>

      <FadeUp delay={220} style={[styles.card, styles.kvCard, styles.mt12, shadow.card]}>
        <KeyValueRow label={nb.bedrift.kvName} value={biz.companyName} />
        <KeyValueRow label={nb.bedrift.kvOrg} value={groupOrg(biz.orgNr)} />
        <KeyValueRow label={nb.bedrift.kvContact} value={biz.contactPerson} />
        <KeyValueRow label={nb.bedrift.kvCats} value={catNames || '–'} last />
      </FadeUp>

      {!approved && !rejected ? (
        <FadeUp delay={260} style={styles.notify}>
          <Icon name="bell" size={18} color={colors.cyanDeep} />
          <Text style={styles.notifyText}>{nb.bedrift.notify}</Text>
        </FadeUp>
      ) : null}
      <View style={styles.mt20}>
        {rejected ? <Button label={nb.bedrift.edit} variant="cyan" onPress={onEdit} style={styles.mb10} /> : null}
        <Button label={nb.bedrift.back} variant="ink" onPress={onBack} />
      </View>
      <View style={styles.bottom} />
    </View>
  );
}

function TlRow({ state, icon, title, sub, last }: { state: 'done' | 'now' | 'todo'; icon: IconName; title: string; sub: string; last?: boolean }) {
  const dot = state === 'done' ? { bg: colors.toggleOn, fg: colors.white } : state === 'now' ? { bg: colors.cyanTint, fg: colors.cyanDeep } : { bg: colors.neutralPill, fg: colors.faint };
  return (
    <View style={[styles.tli, last && styles.tliLast]}>
      {!last ? <View style={[styles.tliLine, state === 'done' && styles.tliLineDone]} /> : null}
      <View style={[styles.tliDot, { backgroundColor: dot.bg }]}>
        <Icon name={state === 'done' ? 'check' : icon} size={16} color={dot.fg} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.tliTitle}>{title}</Text>
        <Text style={[text.meta, styles.mt3]}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  px: { paddingHorizontal: screenPadding },
  mt3: { marginTop: 3 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt14: { marginTop: 14 },
  mt20: { marginTop: 20 },
  mt22: { marginTop: 22 },
  mb10: { marginBottom: 10 },
  gap14: { gap: 14 },
  white: { color: colors.white },
  ink2: { color: colors.ink2 },
  bold: { fontFamily: fonts.bodyBold, color: colors.ink },
  centerText: { textAlign: 'center' },
  bottom: { height: 40 },
  hero: { overflow: 'hidden', borderRadius: 28, backgroundColor: colors.ink, paddingVertical: 22, paddingHorizontal: 20 },
  glow: { position: 'absolute', right: -70, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.lime, opacity: 0.3 },
  heroIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  heroBody: { marginTop: 6, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.onInk78 },
  benefits: { gap: 14, marginTop: 18 },
  ben: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  benIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.onInk10, alignItems: 'center', justifyContent: 'center' },
  benTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  benSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18.2, color: colors.onInk78, marginTop: 2 },
  form: { gap: 18, marginTop: 26 },
  orgInput: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.2 },
  statR: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  okDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  looking: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.cyanDeep },
  ro: { height: 56, borderRadius: radius.input, backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  roText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  found: { borderRadius: 18, backgroundColor: colors.okTint, padding: 14, flexDirection: 'row', gap: 12 },
  foundIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  foundText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19.6, color: colors.okText },
  foundStrong: { fontFamily: fonts.bodyBold, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line2, marginVertical: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -6 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingLeft: 4, paddingRight: 13, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4 },
  consentText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20.3, color: colors.ink2 },
  statusHead: { alignItems: 'center', gap: 10 },
  statusIcon: { width: 96, height: 96, borderRadius: 30, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.card },
  pad: { padding: 18 },
  kvCard: { paddingVertical: 4, paddingHorizontal: 18 },
  tli: { flexDirection: 'row', gap: 14, paddingBottom: 22 },
  tliLast: { paddingBottom: 0 },
  tliLine: { position: 'absolute', left: 16, top: 34, bottom: 0, width: 2, backgroundColor: colors.line },
  tliLineDone: { backgroundColor: colors.todayBorder },
  tliDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tliTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  notify: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: colors.cyanTint },
  notifyText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19.6, color: colors.cyanDeep },
});
