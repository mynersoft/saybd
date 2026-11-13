import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
