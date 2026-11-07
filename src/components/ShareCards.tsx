import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'qrcode';
import Svg, { Rect } from 'react-native-svg';
import type { Listing } from '@/domain/types';
import { categoryArtId, categoryLabel } from '@/domain/categories';
import { SITE } from '@/config/links';
import { captureViewAsFile, shareImageFile, shareListing } from '@/lib/share';
import { toast } from '@/lib/toast';
import nb from '@/i18n/nb';
import { colors, radius, text } from '@/theme/theme';
import { listingPrice } from '@/components/OppdragCard';
import { BrandMark } from '@/components/BrandMark';
import { BoardArt } from '@/components/art/Scenes';
import { Avatar, Button, CategoryArt, Chip, Icon, Sheet } from '@/components/ui';

const MAX_POSTER_SKILLS = 4;

/** Square QR code, drawn with the app's ink on white. */
export function QrCode({ value, size }: { value: string; size: number }) {
  const matrix = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'M' }).modules, [value]);
  const n = matrix.size;
  const cell = size / n;
  return (
    <Svg width={size} height={size} accessibilityLabel={nb.share.qrA11y}>
      <Rect x={0} y={0} width={size} height={size} fill={colors.white} />
      {Array.from({ length: n * n }, (_, i) =>
        matrix.data[i] ? <Rect key={i} x={(i % n) * cell} y={Math.floor(i / n) * cell} width={cell + 0.3} height={cell + 0.3} fill={colors.ink} /> : null,
      )}
    </Svg>
  );
}

/** Where a QR code on a poster leads. The front page has the store links, so it always works. */
export const profileShareUrl = (id: string) => `${SITE}/?nabo=${id}`;

function useCapture(fallback: { title: string; message: string }) {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const file = await captureViewAsFile(ref.current);
      await shareImageFile(file, fallback);
    } catch {
      // an old build without the picture module: the link still gets it shared
      await Share.share(fallback).catch(() => toast.error(nb.share.failed));
    } finally {
      setBusy(false);
    }
  };
  return { ref, busy, share };
}

/** The oppdrag as a picture for Facebook groups and stories. Approximate area only (rule 6). */
function ListingImageCard({ listing, innerRef }: { listing: Listing; innerRef: React.RefObject<View | null> }) {
  const price = listingPrice(listing);
  const cat = categoryArtId(listing.category.slug);
  return (
    <View ref={innerRef} collapsable={false} style={styles.lcard}>
      <View style={styles.glow} />
      <View style={styles.brand}>
        <BrandMark size={28} showWordmark={false} />
        <Text style={styles.brandText}>MinNabo</Text>
      </View>
      <CategoryArt category={cat} uri={listing.images[0]?.url} width="100%" height={190} radius={22} iconSize={56} />
      <Text style={styles.lkind}>{listing.type === 'SERVICE_OFFER' ? nb.share.cardOffer : nb.share.cardNeed}</Text>
      <Text style={styles.ltitle} numberOfLines={3}>
        {listing.title}
      </Text>
      <View style={styles.lmeta}>
        <Icon name="pin" size={16} color={colors.lime} />
        <Text style={styles.lmetaText} numberOfLines={1}>
          {listing.location.place || listing.location.municipality}
        </Text>
      </View>
      <View style={styles.lfoot}>
        <View style={styles.flex}>
          {price.label ? <Text style={styles.lpriceLabel}>{price.label}</Text> : null}
          <Text style={styles.lprice}>{price.value}</Text>
        </View>
        <Text style={styles.lcat}>{categoryLabel(cat)}</Text>
      </View>
      <Text style={styles.lsite}>{nb.share.cardFoot}</Text>
    </View>
  );
}

/** «Del»: as a link, or as a picture. */
export function ShareListingSheet({ listing, visible, onClose }: { listing: Listing; visible: boolean; onClose: () => void }) {
  const { ref, busy, share } = useCapture({ title: listing.title, message: `${listing.title}\n${SITE}` });
  return (
    <Sheet visible={visible} onClose={onClose} title={nb.share.title} scroll>
      {visible ? (
        <View style={styles.preview}>
          <ListingImageCard listing={listing} innerRef={ref} />
        </View>
      ) : null}
      <View style={styles.btns}>
        {Platform.OS !== 'web' ? <Button label={nb.share.asImage} icon="image" variant="ink" loading={busy} onPress={() => void share()} /> : null}
        <Button
          label={nb.share.asLink}
          icon="share"
          variant="ghost"
          onPress={() => {
            onClose();
            void shareListing(listing.id, listing.title);
          }}
        />
      </View>
    </Sheet>
  );
}

/** Three looks, all flat brand colours. */
type PosterLook = 'lime' | 'ink' | 'sky';
const LOOKS: Record<PosterLook, { bg: string; fg: string; sub: string; swatch: string }> = {
  lime: { bg: colors.lime, fg: colors.ink, sub: colors.ink2, swatch: colors.lime },
  ink: { bg: colors.ink, fg: colors.white, sub: colors.onInk78, swatch: colors.ink },
  sky: { bg: colors.cyanTint, fg: colors.ink, sub: colors.ink2, swatch: colors.cyan },
};

/**
 * A poster for the noticeboard in the shop. It looks right from the first second: colour, heading
 * and skills are only there to change if you want to. The QR code leads to the front page, which
 * has the store links, so it works for someone without the app.
 */
export function ProfilePosterSheet({
  visible,
  onClose,
  id,
  name,
  initials,
  avatarUrl,
  place,
  skills,
}: {
  visible: boolean;
  onClose: () => void;
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  place: string;
  skills: string[];
}) {
  const url = profileShareUrl(id);
  const [look, setLook] = useState<PosterLook>('lime');
  const [heading, setHeading] = useState(0);
  const [picked, setPicked] = useState(() => skills.slice(0, MAX_POSTER_SKILLS));
  const headingText = nb.share.posterHeadings[heading];
  const { ref, busy, share } = useCapture({ title: nb.share.posterTitle, message: `${headingText}\n${url}` });
  const l = LOOKS[look];
  const canPicture = Platform.OS !== 'web';

  const toggleSkill = (x: string) =>
    setPicked((cur) => (cur.includes(x) ? cur.filter((s) => s !== x) : cur.length < MAX_POSTER_SKILLS ? [...cur, x] : cur));
  const copy = async () => {
    await Clipboard.setStringAsync(url);
    toast.success(nb.share.posterCopied, { icon: 'check' });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={nb.share.posterSheet} subtitle={nb.share.posterSub} scroll>
      {visible ? (
        <View ref={ref} collapsable={false} style={[styles.poster, { backgroundColor: l.bg }]} testID="poster">
          <View style={styles.pCover}>
            <BoardArt />
          </View>
          <View style={styles.pAvatar}>
            <Avatar initials={initials} uri={avatarUrl} seed={id} size={68} ring={false} />
          </View>
          <View style={styles.pBody}>
            <Text style={[styles.pHeading, { color: l.fg }]}>{headingText}</Text>
            <Text style={[styles.pName, { color: l.fg }]} numberOfLines={1}>
              {[name, place].filter(Boolean).join(' · ')}
            </Text>
            {picked.length ? (
              <View style={styles.pSkills}>
                {picked.map((x) => (
                  <View key={x} style={styles.pSkill}>
                    <Text style={styles.pSkillText}>{x}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.pScan}>
              <View style={styles.pQr}>
                <QrCode value={url} size={124} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.pScanTitle, { color: l.fg }]}>{nb.share.posterScan}</Text>
                <View style={styles.pBrand}>
                  <BrandMark size={22} showWordmark={false} />
                  <Text style={[styles.brandText, { color: l.fg }]}>MinNabo</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.pNote, { color: l.sub }]}>{nb.share.posterNote}</Text>
          </View>
        </View>
      ) : null}

      <Text style={[text.label, styles.pLabel]}>{nb.share.posterLook}</Text>
      <View style={styles.pLooks} accessibilityRole="radiogroup" accessibilityLabel={nb.share.posterLook}>
        {(Object.keys(LOOKS) as PosterLook[]).map((k) => {
          const on = look === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={nb.share.posterLooks[k]}
              onPress={() => setLook(k)}
              style={[styles.pLook, on && styles.pLookOn]}
            >
              <View style={[styles.pSwatch, { backgroundColor: LOOKS[k].swatch }]}>{on ? <Icon name="check" size={14} color={k === 'ink' ? colors.white : colors.ink} strokeWidth={3} /> : null}</View>
              <Text style={styles.pLookText}>{nb.share.posterLooks[k]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[text.label, styles.pLabel]}>{nb.share.posterHeadingLabel}</Text>
      <View style={styles.pChips}>
        {nb.share.posterHeadings.map((h, i) => (
          <Chip key={h} label={h} selected={heading === i} onPress={() => setHeading(i)} />
        ))}
      </View>

      {skills.length ? (
        <>
          <View style={styles.pLabelRow}>
            <Text style={text.label}>{nb.share.posterSkillsLabel}</Text>
            <Text style={text.hint}>{nb.share.posterSkillsHint}</Text>
          </View>
          <View style={styles.pChips}>
            {skills.map((x) => (
              <Chip key={x} label={x} selected={picked.includes(x)} onPress={() => toggleSkill(x)} />
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.pActions}>
        {canPicture ? (
          <Button label={nb.share.posterShare} icon="share" size="lg" loading={busy} onPress={() => void share()} />
        ) : (
          <>
            <Text style={[text.meta, styles.pWeb]}>{nb.share.posterWebNote}</Text>
            <Button label={nb.share.posterShareLink} icon="share" size="lg" onPress={() => void Share.share({ title: nb.share.posterTitle, message: `${headingText}\n${url}` }).catch(() => undefined)} />
          </>
        )}
        <Button label={nb.share.posterCopy} icon="copy" variant="ghost" onPress={() => void copy()} />
      </View>
    </Sheet>
  );
}

export function PosterRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <Icon name="share" size={18} color={colors.limeDeep} />
      </View>
      <View style={styles.flex}>
        <Text style={text.label}>{nb.share.posterSheet}</Text>
        <Text style={text.meta}>{nb.share.posterRowSub}</Text>
      </View>
      <Icon name="right" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  preview: { marginBottom: 16 },
  btns: { gap: 10 },
  lcard: { backgroundColor: colors.ink, borderRadius: radius.listingCard, padding: 18, gap: 10, overflow: 'hidden' },
  glow: { position: 'absolute', right: -70, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.lime, opacity: 0.3 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontFamily: text.h3.fontFamily, fontSize: 17, letterSpacing: -0.4, color: colors.white },
  lkind: { ...text.eyebrow, color: colors.lime, marginTop: 4 },
  ltitle: { fontFamily: text.h1.fontFamily, fontSize: 25, lineHeight: 29, letterSpacing: -0.6, color: colors.white },
  lmeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lmetaText: { flex: 1, fontFamily: text.bodySemi.fontFamily, fontSize: 14.5, color: colors.onInk78 },
  lfoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 4 },
  lpriceLabel: { fontFamily: text.body.fontFamily, fontSize: 12.5, color: colors.onInk62 },
  lprice: { fontFamily: text.h1.fontFamily, fontSize: 24, letterSpacing: -0.5, color: colors.white },
  lcat: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.onInk78 },
  lsite: { fontFamily: text.body.fontFamily, fontSize: 12.5, color: colors.onInk62 },
  poster: { borderRadius: radius.listingCard, overflow: 'hidden' },
  pCover: { height: 118 },
  pAvatar: { position: 'absolute', left: 16, top: 82, padding: 3, borderRadius: 40, backgroundColor: colors.white },
  pBody: { paddingHorizontal: 18, paddingTop: 42, paddingBottom: 16, gap: 8 },
  pHeading: { fontFamily: text.h1.fontFamily, fontSize: 32, lineHeight: 35, letterSpacing: -0.9 },
  pName: { fontFamily: text.bodySemi.fontFamily, fontSize: 15 },
  pSkills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  pSkill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.white },
  pSkillText: { fontFamily: text.label.fontFamily, fontSize: 12.5, color: colors.ink },
  pScan: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  pQr: { padding: 8, borderRadius: radius.m, backgroundColor: colors.white },
  pScanTitle: { fontFamily: text.h3.fontFamily, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  pBrand: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  pNote: { ...text.small, marginTop: 4 },
  pLabel: { marginTop: 18, marginBottom: 8 },
  pLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18, marginBottom: 8 },
  pLooks: { flexDirection: 'row', gap: 8 },
  pLook: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.m, borderWidth: 1.5, borderColor: colors.line },
  pLookOn: { borderColor: colors.ink },
  pSwatch: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pLookText: { fontFamily: text.label.fontFamily, fontSize: 13.5, color: colors.ink },
  pChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pActions: { gap: 10, marginTop: 20 },
  pWeb: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.limeTint, alignItems: 'center', justifyContent: 'center' },
});
