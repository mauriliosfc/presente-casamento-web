import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app';
import { ToastProvider } from './toast';
import './styles.css';
import './extra.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter basename={import.meta.env.BASE_URL}><ToastProvider><App /></ToastProvider></BrowserRouter></React.StrictMode>);
