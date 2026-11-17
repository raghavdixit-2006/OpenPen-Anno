import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useToolbarStore } from './store'
import type { OverlayState } from '../../shared/ipc'
import './styles.css'

function applyState(state: OverlayState): void {
  useToolbarStore.getState().applyState(state)
}

// Subscribed before the first render so no state broadcast can be missed.
window.api.toolbar.onStateChange(applyState)
void window.api.toolbar.getState().then(applyState)

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
