import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BuildCheckPage } from './check/BuildCheckPage.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

// /check es el chequeo de build del relanzamiento; el resto sigue en la app anterior.
const isBuildCheck = /^\/check\/?$/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {isBuildCheck ? <BuildCheckPage /> : <App />}
    </AppErrorBoundary>
  </StrictMode>,
)
