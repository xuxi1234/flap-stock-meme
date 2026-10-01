import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import NFTPage from './NFTPage';
import './standalone.css';
createRoot(document.getElementById('root')!).render(<StrictMode><NFTPage/></StrictMode>);
