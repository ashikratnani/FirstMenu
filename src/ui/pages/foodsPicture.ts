// The picture a Foods tile shows (design "Food art", "Art safety on Foods
// tiles"). A food gets its own picture only when no plate-hidden safety rule
// matches it, or when one does and the tile shows that rule's message with the
// picture. A choking-shape picture on a food no such rule matches (Chestnut)
// is swapped for the food's group picture. The safety code is only asked which
// rules match; it is not changed.

import {
  CHOKING_SHAPE_PICTURES,
  FOOD_PICTURES,
  GROUP_PICTURES,
  pictureFor,
  type FoodGroup,
  type FoodPictureEntry,
} from '../../data/foodPictures';
import { PLATE_HIDDEN_RULE_IDS } from '../../domain/plate';
import { screenIngredient } from '../../domain/safety/screen';

export interface FoodTilePicture {
  group: FoodGroup;
  picture: string;
  /** The matching plate-hidden rule's message, shown first under the picture and name. */
  hiddenMessage: string | null;
}

export function foodTilePicture(
  key: string,
  label: string,
  map: Record<string, FoodPictureEntry> = FOOD_PICTURES,
): FoodTilePicture {
  const found = pictureFor(key, map);
  const hidden = [key, label]
    .flatMap((text) => screenIngredient(text, 0))
    .find((finding) => (PLATE_HIDDEN_RULE_IDS as readonly string[]).includes(finding.ruleId));
  if (hidden) return { group: found.group, picture: found.picture, hiddenMessage: hidden.message };
  if (found.own && CHOKING_SHAPE_PICTURES.has(found.picture)) {
    return { group: found.group, picture: GROUP_PICTURES[found.group], hiddenMessage: null };
  }
  return { group: found.group, picture: found.picture, hiddenMessage: null };
}
