import { PALETTE, useColorOf } from '../lib/palette'
import styles from './MeetCalendarsSettings.module.css'

export function ColorSwatches({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const colorOf = useColorOf()
  return (
    <div className={styles.swatches}>
      {PALETTE.map((swatch) => (
        <button
          key={swatch.key}
          type="button"
          className={`${styles.swatch} ${value === swatch.key ? styles.swatchOn : ''}`}
          style={{ background: colorOf(swatch.key).dot }}
          onClick={() => onChange(swatch.key)}
          aria-label={swatch.label}
          aria-pressed={value === swatch.key}
          title={swatch.label}
        />
      ))}
    </div>
  )
}
