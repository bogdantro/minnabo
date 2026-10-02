import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { toast } from '@/lib/toast';
import {
  categoryColors,
  categoryLabels,
  colors,
  icons,
  screenPadding,
  text,
  type CategoryId,
} from '@/theme/theme';
import {
  AmountInput,
  Avatar,
  Bubble,
  Button,
  Card,
  CategoryArt,
  Checkbox,
  Chip,
  ChipRow,
  Confetti,
  CountBadge,
  DayChips,
  Dialog,
  DrawnCheck,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  IconButton,
  Input,
  KeyValueRow,
  ListGroup,
  ListingCard,
  ListingCardSkeleton,
  ListRow,
  MainHeader,
  NoAccess,
  OfferCard,
  OptionCard,
  PaymentNote,
  PhotoAddTile,
  Pill,
  Radio,
  RangeSlider,
  Screen,
  SectionHeader,
  Segmented,
  SelectBox,
  Sheet,
  Skeleton,
  Stars,
  StatTile,
  StepProgress,
  StickyFooter,
  FooterRow,
  SubHeader,
  SuccessState,
  SystemMessage,
  Tabs,
  TextLink,
  Toggle,
  TypingIndicator,
  VerifiedBadge,
  type IconKey,
  type OfferCardState,
} from '@/components/ui';

/** Section card like `.cd` in Komponenter.dc.html: number, title, spec. */
function Section({ no, title, spec, children }: { no: string; title: string; spec?: string; children: ReactNode }) {
  return (
    <Card pad style={styles.section}>
      <View style={styles.ch}>
        <Text style={styles.no}>{no}</Text>
        <Text style={[text.h3, styles.flex]}>{title}</Text>
      </View>
      {spec ? <Text style={[text.meta, styles.spec]}>{spec}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

function Cap({ children }: { children: string }) {
  return <Text style={styles.cap}>{children}</Text>;
}

function Demo({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <View style={styles.demo}>
      {children}
      <Cap>{caption}</Cap>
    </View>
  );
}

const CATS = Object.keys(categoryLabels) as CategoryId[];
const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((d) => ({ key: d, label: d }));

/**
 * Hidden dev route `/komponenter` – every redesign component with its variants,
 * mirroring design/screens/Komponenter.dc.html. Not in the tab bar or menu.
 */
export function KomponenterScreen() {
  const [live, setLive] = useState<'idle' | 'loading' | 'done'>('idle');
  const [cat, setCat] = useState<CategoryId>('hage');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('Nordre Ål');
  const [tel, setTel] = useState('12 34 5');
  const [desc, setDesc] = useState('Plenen er ca. 300 m². Løvet rakes i sekker som står i garasjen. Gressklipper finnes.');
  const [amt, setAmt] = useState('1500');
  const [days, setDays] = useState<string[]>(['Lør', 'Søn']);
  const [seg, setSeg] = useState<'morgen' | 'dag' | 'kveld'>('dag');
  const [km, setKm] = useState(10);
  const [notify, setNotify] = useState(true);
  const [terms, setTerms] = useState(false);
  const [kind, setKind] = useState<'budget' | 'offers'>('budget');
  const [savedA, setSavedA] = useState(false);
  const [savedB, setSavedB] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [reach, setReach] = useState<'kommune' | 'naboer' | 'innlandet'>('kommune');
  const [dialog, setDialog] = useState(false);
  const [offer, setOffer] = useState<OfferCardState>('pending');
  const [step, setStep] = useState(2);
  const [tab, setTab] = useState<'om' | 'vurderinger' | 'portfolio'>('om');
  const [play, setPlay] = useState(0);
  const [option, setOption] = useState(0);

  const telOk = tel.replace(/\D/g, '').length === 8;

  const runLive = () => {
    if (live !== 'idle') return;
    setLive('loading');
    setTimeout(() => {
      setLive('done');
      setTimeout(() => setLive('idle'), 1600);
    }, 1300);
  };

  return (
    <Screen
      scroll
      spacer="foot"
      header={<SubHeader title="Komponenter" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      footer={
        <StickyFooter>
          <PaymentNote text="Utkastet lagres automatisk underveis." />
          <FooterRow>
            <Button
              label="Tilbake"
              variant="ghost"
              icon="back"
              disabled={step === 1}
              onPress={() => setStep((s) => Math.max(1, s - 1))}
              style={styles.flex}
            />
            <Button
              label={step < 4 ? 'Neste' : 'Forhåndsvis'}
              iconRight={step < 4 ? 'arrow' : 'eye'}
              onPress={() => setStep((s) => Math.min(4, s + 1))}
              style={styles.flex}
            />
          </FooterRow>
        </StickyFooter>
      }
      contentStyle={styles.content}
    >
      <Section no="01" title="Farger" spec="Lime = oppdrag og primærhandling · Cyan = lenker · Ink = tekst">
        <View style={styles.wrap}>
          {(
            ['ink', 'ink2', 'mute', 'bg', 'surface', 'lime', 'limeDeep', 'limeTint', 'cyan', 'cyan2', 'cyanDeep', 'cyanTint', 'star', 'danger', 'ok', 'warn'] as const
          ).map((k) => (
            <View key={k} style={styles.swatch}>
              <View style={[styles.swatchTile, { backgroundColor: colors[k] }]} />
              <Text style={text.metaBold}>{k}</Text>
              <Text style={text.small}>{colors[k]}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section no="02" title="Typografi" spec="Bricolage Grotesque · Figtree">
        <Text style={text.display34}>Nær deg.</Text>
        <Text style={text.h1}>Klippe plen</Text>
        <Text style={text.h2}>Mine avtaler</Text>
        <Text style={text.h3}>Folk som trenger hjelp</Text>
        <Text style={text.h4}>Klippe plen og rake løv</Text>
        <Text style={text.body}>Enkelt, trygt og lokalt.</Text>
        <Text style={text.meta}>Nordre Ål · ca. 1,2 km</Text>
        <Text style={text.eyebrow}>Hei, Mari</Text>
        <Text style={text.num}>1 400 kr</Text>
      </Section>

      <Section no="03" title="Knapper" spec="Pilleform · 52 px standard · trykk skalerer til 97 %">
        <View style={styles.wrap}>
          <Demo caption="Lime · oppdrag"><Button label="Gi tilbud" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Cyan · sekundær handling"><Button label="Legg i kalender" variant="cyan" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Ink · nøytral sterk"><Button label="Fortsett" variant="ink" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Ghost · sekundær"><Button label="Send melding" variant="ghost" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Soft · dempet"><Button label="Avbryt" variant="soft" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Danger · destruktiv"><Button label="Slett" variant="danger" icon="trash" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Dangerghost · rapporter"><Button label="Rapporter" variant="dangerGhost" icon="flag" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Vipps · kun innlogging"><Button label="Logg inn med Vipps" variant="vipps" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Tekst · lenkeknapp"><Button label="Hopp over" variant="text" block={false} onPress={() => {}} /></Demo>
        </View>
        <View style={styles.wrap}>
          <Demo caption="btn-sm · 40"><Button label="Liten" variant="ink" size="sm" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Standard · 52"><Button label="Standard" variant="ink" block={false} onPress={() => {}} /></Demo>
          <Demo caption="btn-lg · 58"><Button label="Stor" variant="ink" size="lg" block={false} onPress={() => {}} /></Demo>
          <Demo caption="Deaktivert · 38 %"><Button label="Gi tilbud" disabled block={false} onPress={() => {}} /></Demo>
          <Demo caption="Live · trykk → laster → ferdig">
            <Button
              label={live === 'done' ? 'Sendt!' : 'Send tilbud'}
              icon={live === 'done' ? 'check' : 'send'}
              loading={live === 'loading'}
              loadingLabel="Sender …"
              block={false}
              style={styles.live}
              onPress={runLive}
            />
          </Demo>
        </View>
        <Demo caption="Block · full bredde"><Button label="Gi tilbud" icon="send" onPress={() => {}} /></Demo>
        <Text style={text.label}>IconButton</Text>
        <View style={styles.row}>
          <Demo caption="Standard"><IconButton icon="back" accessibilityLabel="Tilbake" onPress={() => {}} /></Demo>
          <Demo caption="Med prikk"><IconButton icon="bell" accessibilityLabel="Varsler, 2 uleste" dot onPress={() => {}} /></Demo>
          <Demo caption="Dark"><IconButton icon="more" variant="dark" accessibilityLabel="Flere valg" onPress={() => {}} /></Demo>
          <View style={styles.glassStage}>
            <CategoryArt category="hage" style={StyleSheet.absoluteFill} />
            <IconButton icon="share" variant="glass" accessibilityLabel="Del" onPress={() => {}} />
          </View>
          <Cap>Glass (over bilde)</Cap>
        </View>
        <Text style={text.label}>TextLink</Text>
        <View style={styles.row}>
          <TextLink label="Se alle" onPress={() => {}} />
          <TextLink label="Les vilkårene" icon={null} onPress={() => {}} />
        </View>
      </Section>

      <Section no="04" title="Piller og merker" spec="26 px høye · 12 px fet">
        <View style={styles.wrap}>
          <Pill label="Trenger hjelp" tone="need" dot />
          <Pill label="Åpent oppdrag" tone="need" dot />
          <Pill label="Dugnad" icon="users" />
          <Pill label="Gjentakende" icon="repeat" />
          <Pill label="Lavest pris" icon="tag" tone="line" />
          <Pill label="Nytt tilbud" tone="dark" dot dotColor={colors.lime} />
          <Pill label="Tilbud godtatt" tone="ok" icon="check" />
          <Pill label="Endring forespurt" tone="warn" icon="edit" />
          <Pill label="Avslått" tone="danger" icon="x" />
          <Pill label="Pauset" icon="pause" />
          <Pill label="Fullført" tone="line" icon="checks" />
          <Pill label="6 nye" tone="accent" icon="sparkle" />
          <Pill label="Stor pille" tone="ok" size="lg" />
        </View>
        <View style={styles.row}>
          <VerifiedBadge onPress={() => toast.info('Verifisert med Vipps')} />
          <Stars rating={4.9} count={32} />
          <View>
            <Icon name="msg" size={22} color={colors.ink2} />
            <CountBadge count={3} style={styles.countAbs} />
          </View>
        </View>
        <PaymentNote text="Oppdrag er alltid lime." />
      </Section>

      <Section no="05" title="Felter" spec="56 px høye · 17 px radius · fokus = cyan ring · feil = rød ramme og tekst">
        <Field label="Tittel" hint="Standard">
          <Input placeholder="F.eks. Klippe plen" value={title} onChangeText={setTitle} />
        </Field>
        <Field label="Område" hint="Trykk for fokus">
          <Input value={place} onChangeText={setPlace} icon="pin" />
        </Field>
        <Field label="Telefon" hint="Feil" error={telOk ? null : 'Skriv inn 8 siffer'}>
          <Input value={tel} onChangeText={(v) => setTel(v.replace(/[^\d ]/g, '').slice(0, 11))} keyboardType="number-pad" error={!telOk} />
        </Field>
        <Field label="Beskrivelse" hint={`${desc.length} / 500`} help="Ikke del adressen din her.">
          <Input multiline maxLength={500} value={desc} onChangeText={setDesc} />
        </Field>
        <Field label="Budsjett" hint="NOK">
          <AmountInput value={amt} onChangeText={setAmt} />
          <PaymentNote text="Avtales direkte mellom dere. MinNabo håndterer ikke betaling." />
        </Field>
        <Field label="Kommune" hint="Trykk for å bytte">
          <SelectBox value="Lillehammer" icon="pin" onPress={() => setSheet(true)} />
        </Field>
        <Field label="Dager" hint={days.length ? `${days.length} valgt` : 'Ingen valgt'}>
          <DayChips
            days={DAYS}
            selected={days}
            onToggle={(k) => setDays((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]))}
          />
        </Field>
        <Field label="Tidspunkt" hint="Segmentert">
          <Segmented
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'morgen', label: 'Morgen' },
              { value: 'dag', label: 'Dag' },
              { value: 'kveld', label: 'Kveld' },
            ]}
          />
        </Field>
        <Field label="Rekkevidde" hint={`${km} km`}>
          <RangeSlider value={km} min={1} max={50} onChange={setKm} accessibilityLabel="Rekkevidde" formatValue={(v) => `${v} km`} />
          <View style={styles.between}>
            <Text style={text.meta}>1 km</Text>
            <Text style={text.meta}>50 km</Text>
          </View>
        </Field>
        <Field label="Valg" hint="Bryter · avkrysning · radio">
          <View style={styles.between}>
            <Text style={text.bodySemi}>Varsle meg om nye oppdrag</Text>
            <Toggle value={notify} onValueChange={setNotify} accessibilityLabel="Varsle meg om nye oppdrag" />
          </View>
          <View style={styles.row}>
            <Checkbox checked={terms} onChange={setTerms} accessibilityLabel="Jeg godtar vilkårene" />
            <Text style={text.bodySemi}>Jeg godtar vilkårene</Text>
          </View>
          <View style={styles.row}>
            <OptionCard selected={kind === 'budget'} onPress={() => setKind('budget')} accessibilityLabel="Budsjett" style={styles.flex}>
              <Radio selected={kind === 'budget'} />
              <Text style={text.bodySemi}>Budsjett</Text>
            </OptionCard>
            <OptionCard selected={kind === 'offers'} onPress={() => setKind('offers')} accessibilityLabel="Ønsker tilbud" style={styles.flex}>
              <Radio selected={kind === 'offers'} />
              <Text style={text.bodySemi}>Ønsker tilbud</Text>
            </OptionCard>
          </View>
        </Field>
        <Field label="Bilder" hint="Legg til">
          <View style={styles.row}>
            <CategoryArt category="hage" width={72} height={72} radius={16} iconSize={22} />
            <CategoryArt category="maling" width={72} height={72} radius={16} iconSize={22} />
            <PhotoAddTile size={72} onPress={() => toast.info('Velg bilde')} />
          </View>
        </Field>
        <Text style={text.label}>OptionCard</Text>
        {['Jeg trenger hjelp', 'Jeg vil hjelpe andre', 'Begge deler'].map((l, i) => (
          <OptionCard key={l} selected={option === i} onPress={() => setOption(i)} accessibilityLabel={l}>
            <View style={styles.optIcon}>
              <Icon name={(['clip', 'hand', 'users'] as IconKey[])[i]} color={colors.limeDeep} />
            </View>
            <Text style={[text.h4, styles.flex]}>{l}</Text>
            <Radio selected={option === i} />
          </OptionCard>
        ))}
        <Text style={text.label}>Underline-faner</Text>
        <Tabs
          inset={false}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'om', label: 'Om' },
            { value: 'vurderinger', label: 'Vurderinger', count: 12 },
            { value: 'portfolio', label: 'Portefølje' },
          ]}
        />
      </Section>

      <Section no="06" title="Topplinjer" spec="Statuslinjen holdes fri · 56 px topp i appen">
        <View style={styles.bar}>
          <MainHeader initials="MH" unread unreadCount={2} onBell={() => {}} onAvatar={() => {}} />
        </View>
        <View style={styles.bar}>
          <SubHeader
            title="Mine avtaler"
            onBack={() => {}}
            right={<IconButton icon="more" accessibilityLabel="Flere valg" onPress={() => {}} />}
          />
        </View>
      </Section>

      <Section no="07" title="Seksjonsoverskrift" spec="Ikonbrikke · tittel · undertittel · lenke">
        <SectionHeader
          inset={false}
          style={styles.noMargin}
          icon="clip"
          title="Folk som trenger hjelp"
          subtitle="Småjobber du kan ta i nærheten"
          actionLabel="Se alle"
          onAction={() => {}}
        />
      </Section>

      <Section no="08" title="Skjeletter" spec="Puls 1,3 s · samme form som innholdet">
        <ListingCardSkeleton />
        <View style={styles.row}>
          <Skeleton width={88} height={36} radius={18} />
          <Skeleton width={88} height={36} radius={18} />
        </View>
      </Section>

      <Section no="09" title="Listing-kort" spec="Pris og betaling avtales direkte mellom dere.">
        <ListingCard
          title="Klippe plen og rake løv"
          category="hage"
          ownerName="Kari Holm"
          ownerRating={4.9}
          place="Nordre Ål · 1,2 km"
          schedule="Lør 3. okt · ca. 2 t"
          priceLabel="Budsjett"
          priceValue="400 kr"
          saved={savedA}
          onToggleSave={() => {
            const next = !savedA;
            setSavedA(next);
            if (next) toast.success('Lagret i Lagrede', { icon: 'heart', action: { label: 'Angre', onPress: () => setSavedA(false) } });
          }}
          onPress={() => toast.info('Åpner oppdraget')}
        />
        <ListingCard
          title="Montere garderobeskap"
          category="montering"
          ownerName="Thea Lund"
          ownerRating={5}
          place="Søre Ål · 3,1 km"
          schedule="Denne uka · fleksibel"
          priceValue="Ønsker tilbud"
          extraBadge={{ label: 'Gjentakende', icon: 'repeat' }}
          saved={savedB}
          onToggleSave={() => setSavedB((s) => !s)}
          onPress={() => {}}
        />
        <ListingCard
          title="Bære sofa til 3. etasje"
          category="flytting"
          place="Stampesletta · 2,8 km"
          priceLabel="Budsjett"
          priceValue="350 kr"
          statusBadge={{ label: 'Tilbud sendt', tone: 'dark' }}
          onPress={() => {}}
        />
      </Section>

      <Section no="10" title="Kategori-chips" spec={`Enkeltvalg · valgt: ${categoryLabels[cat]}`}>
        <View style={styles.wrapTight}>
          {CATS.map((c) => (
            <Chip key={c} label={categoryLabels[c]} category={c} selected={cat === c} onPress={() => setCat(c)} />
          ))}
        </View>
        <Text style={text.label}>Rad (horisontal) · små · tint</Text>
        <View style={styles.bleed}>
          <ChipRow>
            <Chip label="Alle" size="sm" selected onPress={() => {}} />
            <Chip label="Nye" size="sm" tone="lime" selected onPress={() => {}} />
            <Chip label="Besvart" size="sm" tone="cyan" selected onPress={() => {}} />
            <Chip label="Uleste" size="sm" onPress={() => {}} />
            <Chip label="Filtre" icon="sliders" onPress={() => {}} />
          </ChipRow>
        </View>
      </Section>

      <Section no="11" title="Avatarer" spec="Initialer · cyan ring · pålogget-prikk">
        <View style={styles.rowEnd}>
          <Demo caption="28"><Avatar initials="JL" colorKey="b" size={28} /></Demo>
          <Demo caption="40"><Avatar initials="SN" colorKey="a" /></Demo>
          <Demo caption="48"><Avatar initials="EM" colorKey="c" size={48} /></Demo>
          <Demo caption="64"><Avatar initials="AS" colorKey="g" size={64} /></Demo>
          <Demo caption="88"><Avatar initials="MH" me size={88} /></Demo>
        </View>
        <View style={styles.row}>
          {(['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const).map((k) => (
            <Avatar key={k} initials={k.toUpperCase() + 'X'} colorKey={k} size={32} ring={false} />
          ))}
          <Avatar initials="MH" me size={32} ring={false} />
          <Avatar initials="JL" colorKey="b" size={32} online />
        </View>
      </Section>

      <Section no="12" title="Lister" spec="Rad 60 px · ikonbrikke 40 · skillelinje fra 68 px">
        <ListGroup>
          <ListRow icon="user" title="Min profil" subtitle="Mari Haugen" onPress={() => {}} />
          <ListRow icon="bell" title="Varsler" right={<CountBadge count={3} />} onPress={() => {}} />
          <ListRow icon="moon" title="Feriemodus" right={<Toggle value={notify} onValueChange={setNotify} accessibilityLabel="Feriemodus" />} />
          <ListRow icon="logout" title="Logg ut" danger onPress={() => setDialog(true)} />
        </ListGroup>
        <Card pad>
          <KeyValueRow label="Pris" value="1 400 kr" />
          <KeyValueRow label="Tid" value="Lør 10. okt kl. 10:00" />
          <KeyValueRow label="Varighet" value="ca. 5 t" last />
        </Card>
        <View style={styles.row}>
          <StatTile value="4,9" label="Snitt" />
          <StatTile value="32" label="Vurderinger" />
          <StatTile value="98 %" label="Møtte opp" />
        </View>
      </Section>

      <Section no="13" title="Ark / Dialog / Toast" spec="Prøv live">
        <View style={styles.wrap}>
          <Button label="Åpne ark" icon="up" variant="ink" size="sm" block={false} onPress={() => setSheet(true)} />
          <Button label="Vis toast" icon="bell" variant="ghost" size="sm" block={false} onPress={() => toast.success('Endringene er lagret')} />
          <Button
            label="Toast med Angre"
            icon="heart"
            variant="ghost"
            size="sm"
            block={false}
            onPress={() => toast.success('Lagret', { icon: 'heart', action: { label: 'Angre', onPress: () => toast.info('Angret') } })}
          />
          <Button label="Feil-toast" variant="ghost" size="sm" block={false} onPress={() => toast.error('Kunne ikke lagre')} />
          <Button label="Dialog" icon="trash" variant="dangerGhost" size="sm" block={false} onPress={() => setDialog(true)} />
        </View>
      </Section>

      <Section no="14" title="Chat" spec="MinNabo håndterer ikke betaling">
        <View style={styles.chat}>
          <Bubble outgoing={false} time="Jonas · 18:02">Hei Mari! Jeg har malt flere gjerder i sommer.</Bubble>
          <Bubble outgoing time="18:04" status="read">Så fint! Send gjerne et tilbud.</Bubble>
          <SystemMessage icon={offer === 'accepted' ? 'check' : offer === 'declined' ? 'x' : 'sparkle'}>
            {offer === 'accepted' ? 'Du godtok tilbudet · avtale opprettet' : offer === 'declined' ? 'Du avslo tilbudet' : 'Jonas sendte et tilbud'}
          </SystemMessage>
          <OfferCard
            state={offer}
            fromLine="fra Jonas Lie · 19:26"
            price="1 400 kr"
            when="Lør 10. okt kl. 10:00"
            duration="ca. 5 t"
            message="Hei Mari! Jeg har malt flere gjerder i Nordre Ål i sommer."
            caveat="Maling/beis kjøpes av deg. Utsettes ved regn."
            acceptedAt="30. sep kl. 19:42"
            canRespond
            onAccept={() => setOffer('accepted')}
            onDecline={() => setOffer('declined')}
            onUndoDecline={() => setOffer('pending')}
            onOpenAgreement={() => setOffer('pending')}
          />
          <TypingIndicator name="Jonas" />
        </View>
      </Section>

      <Section no="15" title="Veiviser" spec="Fremdrift · steg · fast bunnfelt (nederst)">
        <StepProgress step={step} total={4} stepName={['Kategori', 'Beskrivelse', 'Tid og sted', 'Pris'][step - 1]} />
      </Section>

      <Section no="16" title="Ikoner" spec="Lucide · 2 px strek · theme.icons">
        <View style={styles.wrapTight}>
          {(Object.keys(icons) as IconKey[]).map((k) => (
            <View key={k} style={styles.icon}>
              <Icon name={k} size={18} color={k in categoryColors ? categoryColors[k as CategoryId].fg : colors.ink} />
              <Text style={styles.iconName}>{k}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section no="17" title="Tilstander" spec="Tom · feil · ingen tilgang · suksess">
        <View style={styles.state}><EmptyState icon="clip" title="Ingen oppdrag i Lillehammer akkurat nå" body="Prøv å utvide rekkevidden." actionLabel="Utvid rekkevidde" actionIcon="map" onAction={() => {}} /></View>
        <View style={styles.state}><ErrorState onRetry={() => {}} /></View>
        <View style={styles.state}><NoAccess onAction={() => {}} /></View>
        <View style={styles.state}>
          <SuccessState title="Tilbudet er sendt!" body="Kari får beskjed nå. Du får varsel når hun svarer." playKey={play}>
            <PaymentNote text="Pris og betaling avtales direkte mellom dere." />
            <Button label="Spill av igjen" variant="text" icon="refresh" block={false} onPress={() => setPlay((p) => p + 1)} />
          </SuccessState>
          <Confetti playKey={play} />
        </View>
        <DrawnCheck size={104} playKey={play} />
      </Section>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Velg rekkevidde">
        <Segmented
          value={reach}
          onChange={(v) => {
            setReach(v);
            setSheet(false);
            toast.success(`Rekkevidde: ${{ kommune: 'Min kommune', naboer: 'Nabokommuner', innlandet: 'Innlandet' }[v]}`);
          }}
          options={[
            { value: 'kommune', label: 'Min kommune' },
            { value: 'naboer', label: 'Nabokommuner' },
            { value: 'innlandet', label: 'Innlandet' },
          ]}
        />
      </Sheet>
      <Dialog
        visible={dialog}
        onClose={() => setDialog(false)}
        icon="trash"
        title="Slette annonsen?"
        body="Dette kan ikke angres."
        confirmLabel="Slett"
        onConfirm={() => {
          setDialog(false);
          toast.success('Annonsen er slettet');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, gap: 16, paddingTop: 6 },
  flex: { flex: 1 },
  section: { gap: 0 },
  ch: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  no: {
    ...text.pill,
    color: colors.mute,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  spec: { marginTop: 6 },
  sectionBody: { marginTop: 14, gap: 12 },
  cap: { ...text.small, fontFamily: text.chipSm.fontFamily },
  demo: { gap: 5, alignItems: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  wrapTight: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  rowEnd: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { minWidth: 158 },
  glassStage: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  countAbs: { position: 'absolute', top: -6, right: -10 },
  swatch: { width: 72, gap: 2 },
  swatchTile: { height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline },
  optIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
  bar: { marginHorizontal: -18, backgroundColor: colors.bg, borderRadius: 16, overflow: 'hidden' },
  noMargin: { marginTop: 0, marginBottom: 0 },
  bleed: { marginHorizontal: -18 },
  chat: { gap: 8, backgroundColor: colors.bg, borderRadius: 18, padding: 12, marginHorizontal: -6 },
  icon: { width: 64, alignItems: 'center', gap: 4, paddingVertical: 4 },
  iconName: { ...text.small, fontSize: 10 },
  state: { height: 440, backgroundColor: colors.bg, borderRadius: 18, overflow: 'hidden' },
});
