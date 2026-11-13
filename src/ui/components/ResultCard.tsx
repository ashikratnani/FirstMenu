// One result on the Make screen (Requirement 3.8): title, time (marked "about"
// when estimated), effort, nutrition tags and a mystery-door badge naming each
// untried food. A recipe missing foods names them and offers "I have this"
// (Req 3.4). The whole card links to the recipe page. The button sits beside
// the link, never inside it, so no interactive element is nested.

import { Badge } from '@astryxdesign/core/Badge';
import TagBadge from './TagBadge';
import { Button } from '@astryxdesign/core/Button';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import type { MakeResult } from '../../domain/make';
import { foodLabel } from '../../domain/foods';
import { effortLabel, foodList, tagLabel, timeLabel } from '../pages/makeView';
import styles from './ResultCard.module.css';

export interface ResultCardProps {
  result: MakeResult;
  /** "New food: egg" text for untried foods, if any. */
  doorText?: string | null;
  /** Show the missing foods and "I have this" buttons (Missing one, More ideas). */
  showMissing?: boolean;
  onHave?: (food: string) => void;
}

export default function ResultCard({ result, doorText, showMissing, onHave }: ResultCardProps) {
  const { recipe, tags, missing } = result;
  const time = timeLabel(result);
  const effort = effortLabel(result.effort);
  const missingText = showMissing && missing.length > 0 ? `Missing: ${foodList(missing)}` : null;

  // The link's accessible name carries every visible state (Req 14.3).
  const name = [
    recipe.title,
    time,
    effort,
    tags.length > 0 ? tags.map(tagLabel).join(', ') : null,
    doorText ?? null,
    missingText,
  ]
    .filter((part): part is string => part !== null)
    .join('. ');

  return (
    <li className={styles.item}>
      <ClickableCard label={name} href={`/recipes/${recipe.id}`} padding={3} width="100%">
        <span className={styles.body}>
          <span className={styles.title}>{recipe.title}</span>
          <span className={styles.meta}>
            {time} · {effort}
          </span>
          {(tags.length > 0 || doorText) && (
            <span className={styles.badges}>
              {tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
              {doorText && <Badge variant="orange" label={doorText} />}
            </span>
          )}
          {missingText && <span className={styles.missing}>{missingText}</span>}
        </span>
      </ClickableCard>
      {showMissing && missing.length > 0 && onHave && (
        <div className={styles.actions}>
          {missing.map((food) => (
            <Button
              key={food}
              label={`I have this: ${foodLabel(food)}`}
              variant="ghost"
              size="sm"
              onClick={() => onHave(food)}
            />
          ))}
        </div>
      )}
    </li>
  );
}
