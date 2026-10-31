import '@/lib/zod-config';
import { renderApp } from '@/app/bootstrap';
import '@/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root');

renderApp(container, window);
