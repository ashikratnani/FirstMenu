// A recipe's plate on its food-group colored band (design "Food art", "Main
// foods and plates"): up to 3 food pictures on a round plate, or the generic
// bowl alone. A Not yet recipe keeps all its main foods, greys every picture
// and shows the hourglass beside the plate on the lavender Not yet band.
// `isNotYet` is required (build it with plateNotYetCheck), so no page can leave
// it out. Decorative: it adds no text.

import { GROUP_PICTURES } from '../../data/foodPictures';
import { plateFoods, plateGroup } from '../../domain/plate';
import type { Recipe } from '../../domain/types';
import FoodPicture from './FoodPicture';
import StatePicture from './StatePicture';
import styles from './Plate.module.css';

export interface PlateProps {
  recipe: Recipe;
  /** Leaves a Not yet food off the plate; `() => false` for a Not yet recipe. */
  isNotYet: (key: string) => boolean;
  /** The recipe is Not yet: greyed pictures, the hourglass and the lavender band. */
  notYet?: boolean;
  /** Plate diameter in px (about 112 on cards, 160 on the recipe page). */
  size?: number;
}

export default function Plate({ recipe, isNotYet, notYet = false, size = 112 }: PlateProps) {
  const foods = plateFoods(recipe, isNotYet);
  const band = notYet ? 'not-yet' : plateGroup(recipe, isNotYet);
  const pictures = foods.length > 0 ? foods.map((f) => f.picture) : [GROUP_PICTURES.other];
  const px = Math.round(size * (pictures.length === 1 ? 0.55 : pictures.length === 2 ? 0.42 : 0.4));
  return (
    <div className={styles.band} style={{ backgroundColor: `var(--fm-color-group-${band})` }} data-band={band}>
      <div className={styles.plate} style={{ width: size, height: size }}>
        {pictures.map((name) => (
          <FoodPicture key={name} name={name} size={px} greyed={notYet} />
        ))}
      </div>
      {notYet && <StatePicture state="not-yet" size={Math.round(size * 0.4)} />}
    </div>
  );
}
