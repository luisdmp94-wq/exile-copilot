import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { BuildCheckPage } from './check/BuildCheckPage.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'
import { sendVisitBeacon } from './lib/visitBeacon.ts'
import { StatsPage } from './stats/StatsPage.tsx'

// /check es el chequeo de build del relanzamiento; el resto sigue en la app anterior.
const isBuildCheck = /^\/check\/?$/.test(window.location.pathname)
// /estadisticas son las cifras del contador anónimo; piden la clave del servidor.
const isStats = /^\/estadisticas\/?$/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {isStats ? <StatsPage /> : isBuildCheck ? <BuildCheckPage /> : <App />}
    </AppErrorBoundary>
  </StrictMode>,
)

// Contador anónimo: solo en la web publicada, y nunca desde la página de cifras.
if (import.meta.env.PROD && !isStats) sendVisitBeacon()
