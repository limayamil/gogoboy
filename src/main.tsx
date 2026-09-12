import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { ThemeProvider } from './app/theme'
import { TodayView } from './views/TodayView'
import { CategoriesView } from './views/CategoriesView'
import { WeekView } from './views/WeekView'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un solo usuario en una sola pestania: no hace falta refrescar al volver al foco.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
      // Sin esto, React Query "pausa" las queries cuando cree que el navegador esta
      // offline: un estado que no es ni carga ni error, y que hacia que la app
      // mostrara una pantalla vacia como si todo estuviera bien.
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<TodayView />} />
              <Route path="/categorias" element={<CategoriesView />} />
              <Route path="/semana" element={<WeekView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
