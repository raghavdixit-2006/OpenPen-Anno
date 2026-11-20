import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Popover from './Popover'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root')

createRoot(container).render(
  <StrictMode>
    <Popover />
  </StrictMode>
)
