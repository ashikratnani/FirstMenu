// Week home screen (Task 6.1 placeholder). Per design "Theme mapping" this is a
// plain, bright grid of seven day cards with no themed scene (no haunted-house,
// night or skull imagery). The real week view with meal slots, badges and cards
// arrives in task 10. The app name heading and the not-medical-advice
// disclaimer live in the shared Layout (header and footer respectively), so
// Home only renders the week grid.
import styles from './Home.module.css';

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export default function Home() {
  return (
    <>
      <h1>This week</h1>
      <ol className={styles.weekGrid}>
        {DAY_NAMES.map((day) => (
          <li key={day} className={styles.dayCard}>
            <h2 className={styles.dayName}>{day}</h2>
            <p className={styles.dayNote}>No meals planned yet.</p>
          </li>
        ))}
      </ol>
    </>
  );
}
