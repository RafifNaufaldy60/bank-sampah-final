import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import { createBrowserRouter } from 'react-router-dom'
import { store } from './app/store'
import { createAppRoutes } from './router'

const router = createBrowserRouter(createAppRoutes(store))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}><App router={router} /></Provider>
  </StrictMode>,
)
