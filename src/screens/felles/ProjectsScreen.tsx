import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import nb from '@/i18n/nb';
import type { CommunityProject, ProjectKind } from '@/domain/community';
import { useDeleteProject, useProjectSupport, useProjects, useSaveProject, useSupportProject } from '@/api/communityQueries';
import { useProfile } from '@/api/queries';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocationScope } from '@/lib/locationScope';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { confirm } from '@/lib/confirm';
import { sharePdf } from '@/lib/pdf';
import { proposalPdfHtml } from '@/lib/proposalPdf';
import { colors, fonts, radius, shadow, text } from '@/theme/theme';
import { Button, Checkbox, Field, GrowBar, Icon, Input, Note, OptionCard, Pill, Sheet, TextLink } from '@/components/ui';
import { FellesPage, TONES } from '@/components/community/FellesPage';

const MAX_STEPS = 8;

/** Nabolagsprosjekter and «Forslag til kommunen»: support, steps, and a PDF for the kommune. */
export function ProjectsScreen() {
  const me = useCurrentUser();
  const { municipality } = useLocationScope();
  const kommune = me.municipality || municipality || '';
  // ?vis=<id> (from «Søk i Fellesskap»): that prosjekt comes first, marked
  const { vis } = useLocalSearchParams<{ vis?: string }>();
  const all = useProjects(kommune).data ?? [];
  const focus = typeof vis === 'string' ? all.find((p) => p.id === vis) : undefined;
  const projects = focus ? [focus, ...all.filter((p) => p.id !== focus.id)] : all;
  const [open, setOpen] = useState(false);
  return (
    <FellesPage
      title={nb.felles.projects.title}
      lead={nb.felles.projects.lead}
      icon="hand"
      tone={TONES.cyan}
      testID="projects"
      footer={<Button label={nb.felles.projects.new} variant="lime" icon="plus" onPress={() => setOpen(true)} />}
    >
      {projects.length === 0 ? <Note icon="hand">{nb.felles.projects.empty}</Note> : null}
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} mine={p.authorId === me.id} kommune={kommune} marked={p.id === focus?.id} />
      ))}
      <NewProjectSheet visible={open} onClose={() => setOpen(false)} kommune={kommune} />
    </FellesPage>
  );
}

function ProjectCard({ project: p, mine, kommune, marked }: { project: CommunityProject; mine: boolean; kommune: string; marked?: boolean }) {
  const author = useProfile(p.authorId).data;
  const support = useProjectSupport(p.id).data;
  const toggle = useSupportProject(p.id);
  const save = useSaveProject(kommune);
  const remove = useDeleteProject(kommune);
  const [showName, setShowName] = useState(false);
  const closed = !!p.closedAt;
  const proposal = p.kind === 'PROPOSAL';

  const back = () =>
    toggle.mutate(
      { on: !support?.mine, showName },
      { onSuccess: () => haptics.success(), onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)) },
    );
  const step = (done: number) => save.mutate({ id: p.id, kind: p.kind, title: p.title, body: p.body, steps: p.steps, stepsDone: done, municipality: p.municipality });

  return (
    <View style={[styles.card, shadow.card, closed && styles.dim, marked && styles.marked]} testID={`project-${p.id}`}>
      <View style={styles.pills}>
        <Pill label={nb.felles.projects.kinds[p.kind]} tone={proposal ? 'accent' : undefined} size="sm" icon={proposal ? 'file' : 'hand'} />
        {closed ? <Pill label={nb.felles.projects.closed} size="sm" /> : null}
        {p.sentAt ? <Pill label={nb.felles.projects.sent} tone="ok" icon="check" size="sm" /> : null}
      </View>
      <Text style={styles.title}>{p.title}</Text>
      {p.body ? <Text style={[text.body, styles.ink2]}>{p.body}</Text> : null}
      {author ? <Text style={text.hint}>{nb.felles.projects.by(author.displayName.split(' ')[0])}</Text> : null}

      {p.steps.length ? (
        <View style={styles.steps}>
          <GrowBar fill={p.stepsDone / p.steps.length} color={colors.cyanDeep} />
          <Text style={text.meta}>{nb.felles.projects.steps(p.stepsDone, p.steps.length)}</Text>
          {p.steps.map((s, i) => {
            const done = i < p.stepsDone;
            return (
              <Pressable
                key={`${i}-${s}`}
                disabled={!mine || closed}
                accessibilityRole={mine ? 'checkbox' : 'text'}
                accessibilityState={mine ? { checked: done } : undefined}
                accessibilityLabel={s}
                onPress={() => step(done ? i : i + 1)}
                style={styles.stepRow}
              >
                <View style={[styles.stepDot, done && styles.stepDotOn]}>{done ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}</View>
                <Text style={[styles.stepText, done && styles.stepDone]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        {!closed ? (
          <Button
            label={support?.mine ? nb.felles.projects.supported : nb.felles.projects.support}
            variant={support?.mine ? 'ink' : 'lime'}
            size="sm"
            block={false}
            icon={support?.mine ? 'check' : 'thumb'}
            loading={toggle.isPending}
            onPress={back}
          />
        ) : null}
        <Text style={[text.meta, styles.flex]}>{nb.felles.projects.supporters(support?.count ?? 0)}</Text>
      </View>
      {proposal && !closed && !support?.mine ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: showName }} onPress={() => setShowName((v) => !v)} style={styles.nameRow}>
          <Checkbox checked={showName} />
          <Text style={[text.meta, styles.flex]}>{nb.felles.projects.showName}</Text>
        </Pressable>
      ) : null}

      {mine ? (
        <View style={styles.ownerRow}>
          {proposal ? (
            <TextLink
              label={nb.felles.projects.pdf}
              icon="download"
              onPress={() => void sharePdf(proposalPdfHtml(p, support?.count ?? 0, support?.names ?? []), nb.felles.projects.pdfTitle(p.title))}
            />
          ) : null}
          {proposal && !p.sentAt ? (
            <TextLink label={nb.felles.projects.markSent} icon="send" onPress={() => save.mutate({ id: p.id, kind: p.kind, title: p.title, body: p.body, steps: p.steps, municipality: p.municipality, sent: true })} />
          ) : null}
          {!closed ? (
            <TextLink label={nb.felles.projects.close} icon="check" onPress={() => save.mutate({ id: p.id, kind: p.kind, title: p.title, body: p.body, steps: p.steps, municipality: p.municipality, closed: true })} />
          ) : null}
          <TextLink
            label={nb.felles.projects.remove}
            icon="trash"
            onPress={async () => {
              if (await confirm({ title: nb.felles.projects.removeConfirm, confirmLabel: nb.felles.projects.remove, destructive: true })) remove.mutate(p.id);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function NewProjectSheet({ visible, onClose, kommune }: { visible: boolean; onClose: () => void; kommune: string }) {
  const save = useSaveProject(kommune);
  const [kind, setKind] = useState<ProjectKind>('PROJECT');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const submit = () =>
    save.mutate(
      { kind, title, body, steps, municipality: kommune },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(nb.felles.projects.saved);
          setTitle('');
          setBody('');
          setSteps(['']);
          onClose();
        },
        onError: (e) => toast.error(serverMessage(e, nb.toast.genericError)),
      },
    );
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={nb.felles.projects.new}
      titleSize="h2"
      scroll
      heightRatio={0.92}
      footer={<Button label={nb.felles.projects.save} variant="lime" icon="send" disabled={title.trim().length < 4} loading={save.isPending} onPress={submit} />}
    >
      <View style={styles.kinds} accessibilityRole="radiogroup">
        {(['PROJECT', 'PROPOSAL'] as ProjectKind[]).map((k) => (
          <OptionCard key={k} selected={kind === k} onPress={() => setKind(k)} accessibilityLabel={nb.felles.projects.kinds[k]} style={styles.flex}>
            <Text style={styles.kindTitle}>{nb.felles.projects.kinds[k]}</Text>
            <Text style={text.hint}>{nb.felles.projects.kindSub[k]}</Text>
          </OptionCard>
        ))}
      </View>
      <Field label={nb.felles.projects.titleLabel} style={styles.mt12}>
        <Input value={title} onChangeText={setTitle} maxLength={90} placeholder={nb.felles.projects.titlePh} accessibilityLabel={nb.felles.projects.titleLabel} />
      </Field>
      <Field label={nb.felles.projects.bodyLabel} style={styles.mt12}>
        <Input value={body} onChangeText={setBody} maxLength={1500} multiline placeholder={nb.felles.projects.bodyPh} accessibilityLabel={nb.felles.projects.bodyLabel} />
      </Field>
      <Text style={[text.label, styles.mt12]}>{nb.felles.projects.stepsLabel}</Text>
      {steps.map((s, i) => (
        <Input
          key={i}
          value={s}
          onChangeText={(v) => setSteps((list) => list.map((x, j) => (j === i ? v : x)))}
          maxLength={80}
          placeholder={nb.felles.projects.stepPh(i + 1)}
          accessibilityLabel={nb.felles.projects.stepPh(i + 1)}
          containerStyle={styles.mt8}
        />
      ))}
      {steps.length < MAX_STEPS ? <TextLink label={nb.felles.projects.addStep} icon="plus" onPress={() => setSteps((l) => [...l, ''])} style={styles.mt8} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ink2: { color: colors.ink2 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  dim: { opacity: 0.75 },
  card: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 10 },
  marked: { borderWidth: 2, borderColor: colors.lime },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, color: colors.ink },
  steps: { gap: 6, padding: 12, borderRadius: radius.tile, backgroundColor: colors.surface2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepDotOn: { backgroundColor: colors.cyanDeep, borderColor: colors.cyanDeep },
  stepText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.ink },
  stepDone: { color: colors.mute, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  ownerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.line2 },
  kinds: { flexDirection: 'row', gap: 10 },
  kindTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink, marginBottom: 2 },
});
