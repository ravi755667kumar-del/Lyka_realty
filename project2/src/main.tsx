import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSecurityShield } from './lib/security';

// Initialize Enterprise Anti-Inspect & Security Shield immediately
initSecurityShield();

createRoot(document.getElementById('root')!).render(<App />);
