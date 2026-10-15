import { Image, StyleSheet, Text, View } from "react-native";
import nb from "@/i18n/nb";
import { useMinNaboThread } from "@/api/queries";
import { safePush } from "@/lib/nav";
import {
  colors,
  fonts,
  radius,
  screenPadding,
  shadow,
  text,
} from "@/theme/theme";
import { CountBadge, PressableScale, VerifiedIcon } from "@/components/ui";

const logo = require("../../assets/logo-icon.png");

/**
 * The thread with «MinNabo», pinned at the top of Innboks. Shown once MinNabo has written
 * to the person (a message, a news item or a poll) – before that there is nothing to open.
 */
export function MinNaboRow() {
  const { data } = useMinNaboThread();
  const messages = data ?? [];
  const last = messages[messages.length - 1];
  if (!last) return null;
  const unread = messages.filter((m) => m.fromAdmin && !m.readAt).length;
  const preview = `${last.fromAdmin ? "" : nb.minnabo.youPrefix}${last.title ?? last.body}`;

  return (
    <View style={styles.wrap}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={nb.minnabo.rowAria(preview, unread)}
        onPress={() => safePush("/minnabo")}
        scaleTo={0.985}
        style={[styles.row, shadow.card]}
      >
        <View style={styles.logobox}>
          <Image
            source={logo}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{nb.minnabo.name}</Text>
            <VerifiedIcon size={16} />
            <Text style={[text.meta, styles.official]}>
              {nb.minnabo.official}
            </Text>
          </View>
          <Text
            style={[styles.preview, unread > 0 && styles.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>
        {unread > 0 ? <CountBadge count={unread} /> : null}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: screenPadding, marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.limeTint,
  },
  logobox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.limeTint,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 34, height: 34 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  official: { fontSize: 12 },
  preview: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2 },
  previewUnread: { fontFamily: fonts.bodyBold, color: colors.ink },
});
