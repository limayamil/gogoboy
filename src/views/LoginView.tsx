import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { authClient, useAuthSession } from '../lib/auth'
import { LoadingState } from '../components/Feedback'
import styles from './LoginView.module.css'

function mensajeDeAuth(error: { message?: string } | Error | string): string {
  const raw = typeof error === 'string' ? error : error.message || ''
  if (/invalid email or password/i.test(raw)) return 'Correo o contraseña incorrectos'
  if (/user already exists/i.test(raw)) return 'Ese correo ya tiene cuenta'
  return raw || 'No se pudo entrar'
}

export function LoginView() {
  const session = useAuthSession()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session.isPending) return <LoadingState />
  if (session.data) return <Navigate to="/" replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({
              email,
              password,
              name: email.split('@')[0] || 'Yo',
            })
          : await authClient.signIn.email({ email, password })

      if (result.error) {
        setError(mensajeDeAuth(result.error))
      }
    } catch (caught) {
      setError(mensajeDeAuth(caught instanceof Error ? caught : 'No se pudo entrar'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <img src="/brand/logo-mark.webp" alt="" width="48" height="48" />
        <h1>GoGoBoy</h1>
        <p className={styles.lead}>
          {mode === 'login' ? 'Entrá con tu correo' : 'Creá tu cuenta'}
        </p>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <label className={styles.field}>
          <span>Correo</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>

        <button className={styles.primary} type="submit" disabled={submitting}>
          {submitting ? 'Esperá…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button
          className={styles.switch}
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
          }}
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Entrá'}
        </button>
      </form>
    </main>
  )
}
