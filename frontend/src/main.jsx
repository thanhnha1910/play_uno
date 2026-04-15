import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import MusicPlayer from './MusicPlayer.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MusicPlayer />
    <App />
  </React.StrictMode>,
)
