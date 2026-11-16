import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxSize, paddingAll, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';
import { NEW_OPPDRAG_WIDGET, type NewOppdragWidgetProps } from './types';

/**
 * «Nye oppdrag» on the Android home screen: the newest oppdrag in the person's kommune. A tap opens the app.
 * The widget runs on its own, without the app's code: no imports at run time, so the brand colours from
 * theme.ts (ink #0A1740, lime-deep #3B7300, mute #5F6983, bg #F3F5F1) are written out here.
 */
const NewOppdragWidget = (props: NewOppdragWidgetProps) => {
  'widget';
  const INK = '#0A1740';
  const LIME_DEEP = '#3B7300';
  const MUTE = '#5F6983';
  const BG = '#F3F5F1';
  const shown = props.items.slice(0, 3);
  return (
    <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxSize(), clip(Shapes.RoundedCorner(22)), background(BG), paddingAll(14)]}>
      <Text color={LIME_DEEP} style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 }}>
        {props.sub.toUpperCase()}
      </Text>
      <Text color={INK} maxLines={2} style={{ fontSize: 16, fontWeight: 'bold' }}>
        {props.heading}
      </Text>
      {shown.length ? (
        shown.map((item, i) => (
          <Column key={i}>
            <Text color={INK} maxLines={1} style={{ fontSize: 13.5, fontWeight: '600' }}>
              {item.title}
            </Text>
            <Text color={MUTE} maxLines={1} style={{ fontSize: 12 }}>
              {item.line}
            </Text>
          </Column>
        ))
      ) : (
        <Text color={MUTE} maxLines={3} style={{ fontSize: 13 }}>
          {props.empty}
        </Text>
      )}
    </Column>
  );
};

export default createWidget<NewOppdragWidgetProps>(NEW_OPPDRAG_WIDGET, NewOppdragWidget);
