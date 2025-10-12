import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SfParkingMap from './SfParkingMap.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SfParkingMap />
  </StrictMode>,
)
