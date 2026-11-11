// The "What do you have?" search box shared by the Make screen and the
// onboarding quick solve (Requirement 16, Requirement 20.3). It only draws the
// box; parsing (`searchHave`) and what to do with the foods stay with the
// caller. With `onCommit` it also shows the Add button and handles Enter.

import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import styles from './FoodSearchBox.module.css';

export interface FoodSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter and the Add button. Leave out to show the box alone. */
  onCommit?: () => void;
}

export default function FoodSearchBox({ value, onChange, onCommit }: FoodSearchBoxProps) {
  return (
    <div className={styles.row}>
      <TextInput
        label="What do you have?"
        isLabelHidden
        value={value}
        onChange={onChange}
        onEnter={onCommit}
        placeholder="e.g. leftover chicken, rice and peas · something for breakfast"
        autoComplete="off"
        enterKeyHint="done"
      />
      {onCommit && <Button label="Add" onClick={onCommit} isDisabled={value.trim() === ''} />}
    </div>
  );
}
