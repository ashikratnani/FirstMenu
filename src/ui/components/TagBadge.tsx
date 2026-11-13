// A nutrition tag as a colored chip (design "Food art", "Colors"). The tag's
// name is always shown, so color is never the only signal. Colors are the
// --fm-color-tag-* tokens in theme.css, each pair checked at 4.5:1.

import { Badge } from '@astryxdesign/core/Badge';
import type { NutritionTag } from '../../domain/nutrition';
import { tagLabel } from '../pages/makeView';

export default function TagBadge({ tag }: { tag: NutritionTag }) {
  return (
    <Badge
      label={tagLabel(tag)}
      style={{
        backgroundColor: `var(--fm-color-tag-${tag}-bg)`,
        color: `var(--fm-color-tag-${tag}-text)`,
      }}
    />
  );
}
