import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './pages/App';
import './index.css'; // <-- IMPORTANT: Import your Tailwind/DaisyUI CSS file here!

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
