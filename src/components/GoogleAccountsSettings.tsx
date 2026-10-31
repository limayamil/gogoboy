import { useState } from 'react'
import {
  useAddGoogleCalendar,
  useConnectGoogle,
  useDisconnectGoogle,
  useGoogleAccounts,
  useRemoveGoogleCalendar,
  useUpdateGoogleCalendar,
} from '../lib/meet-store'
import { PALETTE, useColorOf } from '../lib/palette'
import { errorMessage } from '../lib/toast'
import type { GoogleAccount, GoogleCalendarOption } from '../shared/types'
import { ColorSwatches } from './ColorSwatches'
import styles from './MeetCalendarsSettings.module.css'

/**
 * Cuentas de Google conectadas por OAuth: para calendarios de Workspace, donde la
 * dirección iCal secreta no existe. Sin las variables de Google en el servidor
 * (`configured: false`) y sin cuentas, no se dibuja nada.
 */
export function GoogleAccountsSettings() {
  const google = useGoogleAccounts()
  const connect = useConnectGoogle()

  if (!google.data) {
    return google.isError ? <p className={styles.error}>{errorMessage(google.error)}</p> : null
  }
  const { configured, accounts } = google.data
  if (!configured) return null

  return (
    <div className={styles.google}>
      <p className={styles.subheading}>Cuentas de Google</p>
      {accounts.map((account) => (
        <AccountBlock key={account.id} account={account} onReconnect={() => connect.mutate()} />
      ))}
      <button type="button" className={styles.connect} onClick={() => connect.mutate()} disabled={connect.isPending}>
        <GoogleMark />
        {connect.isPending ? 'Abriendo Google…' : 'Conectar cuenta de Google'}
      </button>
      {connect.isError ? <p className={styles.error}>{errorMessage(connect.error)}</p> : null}
      {accounts.length === 0 ? (
        <p className={styles.hint}>Para calendarios de la empresa, que no tienen dirección iCal.</p>
      ) : null}
    </div>
  )
}

function AccountBlock({ account, onReconnect }: { account: GoogleAccount; onReconnect: () => void }) {
  const disconnect = useDisconnectGoogle()

  function confirmDisconnect() {
    if (!window.confirm(`¿Desconectar ${account.email}? Sus calendarios dejan de aparecer.`)) return
    disconnect.mutate(account.id)
  }

  return (
    <div className={styles.account}>
      <div className={styles.accountHeader}>
        <span className={styles.accountEmail} title={account.email}>
          {account.email}
        </span>
        {account.status === 'reconectar' ? (
          <button type="button" className={styles.reconnect} onClick={onReconnect}>
            Reconectar
          </button>
        ) : null}
        <button type="button" className={styles.link} onClick={confirmDisconnect} disabled={disconnect.isPending}>
          Desconectar
        </button>
      </div>
      {account.status === 'reconectar' ? (
        <p className={styles.hint}>Google ya no da acceso a esta cuenta. Reconectala para volver a ver sus reuniones.</p>
      ) : null}
      {account.error ? <p className={styles.error}>{account.error}</p> : null}
      <ul className={styles.list}>
        {account.calendars.map((option, index) => (
          <CalendarOption key={option.calendarId} account={account} option={option} index={index} />
        ))}
      </ul>
    </div>
  )
}

function CalendarOption({ account, option, index }: { account: GoogleAccount; option: GoogleCalendarOption; index: number }) {
  const add = useAddGoogleCalendar()
  const remove = useRemoveGoogleCalendar()
  const colorOf = useColorOf()
  const [editing, setEditing] = useState(false)
  // El tilde cambia al instante; la lista vuelve de Google recién después del refetch.
  const [pending, setPending] = useState<boolean | null>(null)
  const selection = option.selection
  const done = { onSettled: () => setPending(null) }

  function toggle() {
    setPending(!selection)
    if (selection) {
      remove.mutate(selection.id, done)
      return
    }
    add.mutate(
      {
        accountId: account.id,
        calendarId: option.calendarId,
        name: option.summary.slice(0, 60),
        colorKey: PALETTE[(index + 4) % PALETTE.length].key,
      },
      done,
    )
  }

  if (editing && selection) {
    return (
      <li>
        <GoogleCalendarForm selection={selection} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className={styles.row}>
      <input
        type="checkbox"
        className={styles.check}
        checked={pending ?? Boolean(selection)}
        onChange={toggle}
        disabled={pending !== null}
        aria-label={`Mostrar ${option.summary}`}
      />
      {selection ? <span className={styles.dot} style={{ background: colorOf(selection.colorKey).dot }} /> : null}
      <span className={styles.rowText}>
        <span className={styles.name}>{selection?.name ?? option.summary}</span>
        {selection && selection.name !== option.summary ? <span className={styles.masked}>{option.summary}</span> : null}
        {!selection && option.primary ? <span className={styles.masked}>Principal</span> : null}
      </span>
      {selection ? (
        <button type="button" className={styles.link} onClick={() => setEditing(true)}>
          Editar
        </button>
      ) : null}
    </li>
  )
}

function GoogleCalendarForm({
  selection,
  onDone,
}: {
  selection: NonNullable<GoogleCalendarOption['selection']>
  onDone: () => void
}) {
  const update = useUpdateGoogleCalendar()
  const [name, setName] = useState(selection.name)
  const [colorKey, setColorKey] = useState(selection.colorKey)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return setError('Ponele un nombre.')
    try {
      await update.mutateAsync({ id: selection.id, patch: { name: trimmed, colorKey } })
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>Nombre</span>
        <input className={styles.input} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} autoFocus />
      </label>
      <div className={styles.field}>
        <span className={styles.label}>Color</span>
        <ColorSwatches value={colorKey} onChange={setColorKey} />
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={onDone} disabled={update.isPending}>
          Cancelar
        </button>
        <button type="submit" className={styles.primary} disabled={update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.4 0-11.7-4.1-13.6-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
