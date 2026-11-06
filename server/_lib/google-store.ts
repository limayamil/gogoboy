import type { GoogleAccountStatus } from '../../src/shared/types.ts'
import { sql } from './db.ts'

/** Lo que vive en la base. `refreshTokenEnc` no sale de server/. */
export interface StoredGoogleAccount {
  id: string
  email: string
  refreshTokenEnc: string
  status: GoogleAccountStatus
}

export interface StoredGoogleCalendar {
  id: string
  accountId: string
  calendarId: string
  name: string
  colorKey: string
  position: number
}

export interface GoogleStore {
  listAccounts(): Promise<StoredGoogleAccount[]>
  getAccount(id: string): Promise<StoredGoogleAccount | null>
  /** Reconectar la misma cuenta pisa el token y vuelve a 'ok'; los calendarios elegidos quedan. */
  upsertAccount(email: string, refreshTokenEnc: string): Promise<StoredGoogleAccount>
  setAccountStatus(id: string, status: GoogleAccountStatus): Promise<void>
  /** Borra la cuenta y, por la FK en cascada, solo sus calendarios. */
  removeAccount(id: string): Promise<boolean>
  listCalendars(): Promise<StoredGoogleCalendar[]>
  getCalendar(id: string): Promise<StoredGoogleCalendar | null>
  addCalendar(input: Omit<StoredGoogleCalendar, 'id' | 'position'>): Promise<StoredGoogleCalendar>
  updateCalendar(id: string, next: { name: string; colorKey: string }): Promise<StoredGoogleCalendar | null>
  removeCalendar(id: string): Promise<boolean>
}

type Row = Record<string, unknown>

function mapAccount(row: Row): StoredGoogleAccount {
  return {
    id: row.id as string,
    email: row.email as string,
    refreshTokenEnc: row.refresh_token_enc as string,
    status: row.status === 'reconectar' ? 'reconectar' : 'ok',
  }
}

function mapCalendar(row: Row): StoredGoogleCalendar {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    calendarId: row.calendar_id as string,
    name: row.name as string,
    colorKey: row.color_key as string,
    position: Number(row.position),
  }
}

export const googleStore: GoogleStore = {
  async listAccounts() {
    return ((await sql`select * from google_accounts order by created_at`) as Row[]).map(mapAccount)
  },

  async getAccount(id) {
    const [row] = (await sql`select * from google_accounts where id = ${id}`) as Row[]
    return row ? mapAccount(row) : null
  },

  async upsertAccount(email, refreshTokenEnc) {
    const [row] = (await sql`
      insert into google_accounts (email, refresh_token_enc)
      values (${email}, ${refreshTokenEnc})
      on conflict (email) do update
        set refresh_token_enc = excluded.refresh_token_enc, status = 'ok', updated_at = now()
      returning *
    `) as Row[]
    return mapAccount(row)
  },

  async setAccountStatus(id, status) {
    await sql`update google_accounts set status = ${status}, updated_at = now() where id = ${id}`
  },

  async removeAccount(id) {
    return ((await sql`delete from google_accounts where id = ${id} returning id`) as Row[]).length > 0
  },

  async listCalendars() {
    return ((await sql`select * from google_calendars order by position, created_at`) as Row[]).map(mapCalendar)
  },

  async getCalendar(id) {
    const [row] = (await sql`select * from google_calendars where id = ${id}`) as Row[]
    return row ? mapCalendar(row) : null
  },

  async addCalendar(input) {
    const [row] = (await sql`
      insert into google_calendars (account_id, calendar_id, name, color_key, position)
      values (
        ${input.accountId}, ${input.calendarId}, ${input.name}, ${input.colorKey},
        (select coalesce(max(position), -1) + 1 from google_calendars)
      )
      on conflict (account_id, calendar_id) do update
        set name = excluded.name, color_key = excluded.color_key
      returning *
    `) as Row[]
    return mapCalendar(row)
  },

  async updateCalendar(id, next) {
    const [row] = (await sql`
      update google_calendars set name = ${next.name}, color_key = ${next.colorKey}
      where id = ${id}
      returning *
    `) as Row[]
    return row ? mapCalendar(row) : null
  },

  async removeCalendar(id) {
    return ((await sql`delete from google_calendars where id = ${id} returning id`) as Row[]).length > 0
  },
}
