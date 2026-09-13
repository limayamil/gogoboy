import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '../components/Feedback'
import { useAuthSession } from '../lib/auth'

export function RequireAuth() {
  const session = useAuthSession()
  const location = useLocation()

  if (session.isPending) return <LoadingState />
  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
