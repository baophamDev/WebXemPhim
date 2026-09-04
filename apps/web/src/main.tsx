import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import App from './App';
import './styles.css';
/**
 * Chỉ còn BrowserRouter. Trước đây có nhánh HashRouter cho bản .ipk đóng gói vì nó
 * nạp index.html bằng file:// (location.pathname là đường dẫn thật trong máy nên
 * không khớp route nào). Bản webOS giờ là hosted web app trỏ vào URL Vercel — origin
 * https bình thường, pushState dùng được, và vercel.json đã có rewrite cho SPA.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider></React.StrictMode>);
