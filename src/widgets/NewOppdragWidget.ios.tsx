import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { NEW_OPPDRAG_WIDGET, type NewOppdragWidgetProps } from './types';

/**
 * «Nye oppdrag» on the iPhone home screen: the newest oppdrag in the person's kommune. A tap opens Oppdrag.
 * The widget runs on its own, without the app's code: no imports at run time, so the brand colours from
 * theme.ts (ink #0A1740, lime-deep #3B7300, mute #5F6983, bg #F3F5F1) are written out here.
 */
const NewOppdragWidget = (props: NewOppdragWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const INK = '#0A1740';
  const LIME_DEEP = '#3B7300';
  const MUTE = '#5F6983';
  const BG = '#F3F5F1';
  const small = env.widgetFamily === 'systemSmall';
  const shown = props.items.slice(0, small ? 1 : env.widgetFamily === 'systemLarge' ? 5 : 2);
  return (
    <VStack alignment="leading" spacing={small ? 6 : 8} modifiers={[containerBackground(BG, 'widget'), widgetURL('minnabo:///'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }), padding({ all: 2 })]}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(LIME_DEEP)]}>{props.sub.toUpperCase()}</Text>
      <Text modifiers={[font({ size: small ? 15 : 16, weight: 'bold' }), foregroundStyle(INK), lineLimit(2)]}>{props.heading}</Text>
      {shown.length ? (
        shown.map((item, i) => (
          <HStack key={i} spacing={8}>
            <VStack alignment="leading" spacing={1}>
              <Text modifiers={[font({ size: 13.5, weight: 'semibold' }), foregroundStyle(INK), lineLimit(1)]}>{item.title}</Text>
              <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTE), lineLimit(1)]}>{item.line}</Text>
            </VStack>
            <Spacer />
          </HStack>
        ))
      ) : (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(MUTE), lineLimit(3)]}>{props.empty}</Text>
      )}
      <Spacer />
    </VStack>
  );
};

export default createWidget<NewOppdragWidgetProps>(NEW_OPPDRAG_WIDGET, NewOppdragWidget);
