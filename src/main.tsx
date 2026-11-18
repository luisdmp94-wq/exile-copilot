import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'
import { sendVisitBeacon } from './lib/visitBeacon.ts'
import { LangProvider } from './i18n/LangProvider.tsx'
import { reloadOnceForNewVersion } from './lib/reloadForNewVersion.ts'

// Estas dos páginas casi nadie las abre: van en archivos aparte para no
// cargarlas con la portada.
const BuildCheckPage = lazy(() =>
  import('./check/BuildCheckPage.tsx').then((module) => ({ default: module.BuildCheckPage })),
)
const StatsPage = lazy(() =>
  import('./stats/StatsPage.tsx').then((module) => ({ default: module.StatsPage })),
)

// /check es el chequeo de build del relanzamiento; el resto sigue en la app anterior.
const isBuildCheck = /^\/check\/?$/.test(window.location.pathname)
// /estadisticas son las cifras del contador anónimo; piden la clave del servidor.
const isStats = /^\/estadisticas\/?$/.test(window.location.pathname)

// Tras subir una versión nueva, los trozos antiguos de la web ya no existen:
// se recarga una vez para coger la nueva en vez de caerse.
window.addEventListener('vite:preloadError', () => {
  void reloadOnceForNewVersion()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <LangProvider>
        <Suspense fallback={null}>
          {isStats ? <StatsPage /> : isBuildCheck ? <BuildCheckPage /> : <App />}
        </Suspense>
      </LangProvider>
    </AppErrorBoundary>
  </StrictMode>,
)

// Contador anónimo: solo en la web publicada, y nunca desde la página de cifras.
if (import.meta.env.PROD && !isStats) sendVisitBeacon()
