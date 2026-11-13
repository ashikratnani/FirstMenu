// One Fluent Emoji picture file as a decorative <img> (design "Food art",
// "Picture files"): alt="", width and height set to the displayed size, lazy
// and async. The text next to it always carries the meaning. `greyed` is the
// Not yet look: a grayscale filter and lower opacity on the picture only,
// never on text.

import { artUrl } from './artUrl';
import styles from './FoodPicture.module.css';

export interface FoodPictureProps {
  /** File name in public/art/foods/ without ".webp", e.g. "carrot". */
  name: string;
  /** Displayed size in px (the file is 128 px). */
  size?: number;
  greyed?: boolean;
}

export default function FoodPicture({ name, size = 62, greyed = false }: FoodPictureProps) {
  return (
    <img
      className={greyed ? `${styles.picture} ${styles.greyed}` : styles.picture}
      src={artUrl('foods', name)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}
