import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; 
import './css/principal.css'; 
import './css/navbar.css'; // <--- ESTE AL FINAL

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);