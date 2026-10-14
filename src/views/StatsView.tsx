import { useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '../components/Feedback'
import { IconChart, IconChevronRight } from '../components/Icons'
import { Modal } from '../components/Modal'
import { DAY_NAMES } from '../lib/dates'
import { useColorOf } from '../lib/palette'
import {
  computeTaskStats,
  computeWeekDetail,
  formatWeekSpan,
  plural,
  type CategoryStat,
  type WeekDetail,
} from '../lib/stats'
import { useAppState } from '../lib/store'
import type { Category, Task } from '../shared/types'
import styles from './StatsView.module.css'

export function StatsView() {
  const { data, isPending, error } = useAppState()
  const colorOf = useColorOf()
  const [openMonday, setOpenMonday] = useState<string | null>(null)
  const stats = useMemo(
    () => computeTaskStats(data?.tasks ?? [], data?.categories ?? []),
    [data?.tasks, data?.categories],
  )

  const maxCategory = stats.byCategory[0]?.count ?? 0
  const maxWeek = stats.weeks.reduce((max, week) => Math.max(max, week.count), 0)
  const currentWeek = stats.weeks.find((week) => week.isCurrent)
  const delta = stats.thisWeekCount - stats.lastWeekCount

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <IconChart size={22} />
          Estadísticas
        </h1>
        <p className={styles.subtitle}>
          Tareas hechas a lo largo del tiempo, incluidas las que ya caducaron el lunes.
        </p>
      </header>

      {isPending ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      {!isPending && !error && stats.total === 0 ? (
        <div className={styles.empty}>
          <img
            className={styles.emptyIllustration}
            src="/images/empty-week.webp"
            alt=""
            width="760"
            height="507"
          />
          <p className={styles.emptyTitle}>Todavía no hay tareas hechas</p>
          <p className={styles.emptyText}>
            Cuando completes alguna, acá vas a ver el total, de qué listas salieron y cómo
            venía cada semana.
          </p>
        </div>
      ) : null}

      {!isPending && !error && stats.total > 0 ? (
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="stats-general">
            <h2 id="stats-general" className={styles.sectionTitle}>
              General
            </h2>
            <p className={styles.hero}>
              <span className={styles.heroNumber}>{stats.total}</span>
              <span className={styles.heroLabel}>
                {stats.total === 1 ? 'tarea hecha' : 'tareas hechas'}
              </span>
            </p>

            <h3 className={styles.subhead}>Por lista</h3>
            <CategoryBars rows={stats.byCategory} max={maxCategory} colorOf={colorOf} />
          </section>

          <div id="stats-weeks-block" className={styles.history}>
            <section className={styles.highlights} aria-label="Esta semana">
              <button
                type="button"
                className={`${styles.chipCard} ${styles.chipButton}`}
                onClick={() => setOpenMonday(stats.thisMonday)}
                aria-label={`Ver detalle de esta semana, ${plural(stats.thisWeekCount, 'tarea', 'tareas')}`}
              >
                <p className={styles.chipLabel}>Esta semana</p>
                <p className={styles.chipValue}>{plural(stats.thisWeekCount, 'tarea', 'tareas')}</p>
                {currentWeek ? (
                  <p className={styles.chipHint}>{plural(currentWeek.listCount, 'lista', 'listas')}</p>
                ) : (
                  <p className={styles.chipHint}>Todavía ninguna hecha</p>
                )}
              </button>
              <button
                type="button"
                className={`${styles.chipCard} ${styles.chipButton}`}
                onClick={() => setOpenMonday(stats.lastMonday)}
                aria-label={`Ver detalle de la semana pasada, ${plural(stats.lastWeekCount, 'tarea', 'tareas')}`}
              >
                <p className={styles.chipLabel}>Semana pasada</p>
                <p className={styles.chipValue}>{plural(stats.lastWeekCount, 'tarea', 'tareas')}</p>
                <p className={styles.chipHint}>
                  {delta === 0
                    ? 'Igual que ahora'
                    : delta > 0
                      ? `${delta} más esta semana`
                      : `${Math.abs(delta)} menos esta semana`}
                </p>
              </button>
              {stats.mostProductiveWeekdays.length > 0 ? (
                <article className={styles.chipCard}>
                  <p className={styles.chipLabel}>Día más productivo</p>
                  <p className={styles.chipValue}>
                    {joinWeekdays(stats.mostProductiveWeekdays.map((day) => day.label))}
                  </p>
                  <p className={styles.chipHint}>
                    {plural(stats.mostProductiveWeekdays[0].count, 'tarea hecha', 'tareas hechas')}
                  </p>
                </article>
              ) : null}
            </section>

            <section className={styles.card} aria-labelledby="stats-weeks">
              <h2 id="stats-weeks" className={styles.sectionTitle}>
                Por semana
              </h2>
              {stats.weeks.length === 0 ? (
                <p className={styles.weeksEmpty}>
                  Hay tareas hechas sin fecha de cierre, así que no se pueden agrupar por semana.
                </p>
              ) : (
                <ul className={styles.weeks}>
                  {stats.weeks.map((week) => {
                    const width = maxWeek === 0 ? 0 : Math.round((week.count / maxWeek) * 100)
                    const span = formatWeekSpan(week.monday, week.sunday)
                    return (
                      <li key={week.monday}>
                        <button
                          type="button"
                          className={styles.weekButton}
                          onClick={() => setOpenMonday(week.monday)}
                          aria-label={`Ver detalle de ${span}, ${plural(week.count, 'tarea', 'tareas')}`}
                        >
                          <div className={styles.weekMeta}>
                            <span className={styles.weekRange}>
                              {span}
                              {week.isCurrent ? (
                                <span className={styles.nowBadge}>Esta semana</span>
                              ) : null}
                            </span>
                            <span className={styles.weekCounts}>
                              {plural(week.count, 'tarea', 'tareas')}
                              {' · '}
                              {plural(week.listCount, 'lista', 'listas')}
                              <IconChevronRight size={16} />
                            </span>
                          </div>
                          <div className={styles.barTrack} aria-hidden="true">
                            <span className={styles.weekFill} style={{ width: `${width}%` }} />
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {openMonday ? (
        <WeekStatsModal
          monday={openMonday}
          tasks={data?.tasks ?? []}
          categories={data?.categories ?? []}
          isCurrent={openMonday === stats.thisMonday}
          onClose={() => setOpenMonday(null)}
        />
      ) : null}
    </div>
  )
}

function WeekStatsModal({
  monday,
  tasks,
  categories,
  isCurrent,
  onClose,
}: {
  monday: string
  tasks: Task[]
  categories: Category[]
  isCurrent: boolean
  onClose: () => void
}) {
  const colorOf = useColorOf()
  const detail = useMemo(
    () => computeWeekDetail(tasks, categories, monday),
    [tasks, categories, monday],
  )
  const maxCategory = detail.byCategory[0]?.count ?? 0
  const maxDay = detail.weekdays.reduce((max, day) => Math.max(max, day.count), 0)
  const title = isCurrent
    ? `Esta semana · ${formatWeekSpan(detail.monday, detail.sunday)}`
    : formatWeekSpan(detail.monday, detail.sunday)

  return (
    <Modal title={title} onClose={onClose}>
      <WeekDetailBody
        detail={detail}
        maxCategory={maxCategory}
        maxDay={maxDay}
        colorOf={colorOf}
      />
    </Modal>
  )
}

function WeekDetailBody({
  detail,
  maxCategory,
  maxDay,
  colorOf,
}: {
  detail: WeekDetail
  maxCategory: number
  maxDay: number
  colorOf: (key: string | null | undefined) => { dot: string }
}) {
  if (detail.total === 0) {
    return (
      <p className={styles.weeksEmpty}>Nada hecha esa semana.</p>
    )
  }

  return (
    <>
      <p className={styles.hero}>
        <span className={styles.heroNumber}>{detail.total}</span>
        <span className={styles.heroLabel}>
          {detail.total === 1 ? 'tarea hecha' : 'tareas hechas'}
        </span>
      </p>

      <div>
        <h3 className={styles.subhead}>Por lista</h3>
        <CategoryBars rows={detail.byCategory} max={maxCategory} colorOf={colorOf} />
      </div>

      <div>
        <h3 className={styles.subhead}>Por día</h3>
        <ul className={styles.days}>
          {detail.weekdays.map((day) => {
            const height = maxDay === 0 ? 0 : Math.round((day.count / maxDay) * 100)
            return (
              <li key={day.index} className={styles.day}>
                <span className={styles.dayCount}>{day.count}</span>
                <span className={styles.dayTrack} aria-hidden="true">
                  <span className={styles.dayFill} style={{ height: `${height}%` }} />
                </span>
                <span className={styles.dayName}>{DAY_NAMES[day.index]}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

function CategoryBars({
  rows,
  max,
  colorOf,
}: {
  rows: CategoryStat[]
  max: number
  colorOf: (key: string | null | undefined) => { dot: string }
}) {
  return (
    <ul className={styles.bars}>
      {rows.map((row) => {
        // Sin categoria no tiene clave: el fallback de la paleta pintaria coral.
        const color = row.colorKey ? colorOf(row.colorKey) : { dot: 'var(--ink-faint)' }
        const width = max === 0 ? 0 : Math.round((row.count / max) * 100)
        return (
          <li key={row.categoryId ?? 'sin-categoria'} className={styles.barRow}>
            <div className={styles.barMeta}>
              <span className={styles.barName}>
                <span className={styles.dot} style={{ background: color.dot }} />
                {row.name}
              </span>
              <span className={styles.barCount}>{plural(row.count, 'tarea', 'tareas')}</span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${width}%`, background: color.dot }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function joinWeekdays(labels: string[]): string {
  const pretty = labels.map((label) => label.charAt(0).toUpperCase() + label.slice(1))
  if (pretty.length === 1) return pretty[0]
  if (pretty.length === 2) return `${pretty[0]} y ${pretty[1]}`
  return `${pretty.slice(0, -1).join(', ')} y ${pretty.at(-1)}`
}
