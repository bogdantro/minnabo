import type { NewOppdragWidgetProps } from './types';

/** On the web (and in tests) there is no home screen: the widget is a no-op with the same shape. */
const NewOppdragWidget = {
  updateSnapshot(props: NewOppdragWidgetProps) {
    void props;
  },
};

export default NewOppdragWidget;
