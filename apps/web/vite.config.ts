import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    /**
     * es2017 thay vì mặc định 'modules' (Chrome 87+), và đây là cấu hình duy nhất
     * — không còn nhánh riêng cho TV nữa.
     *
     * App trên TV LG là hosted web app: appinfo.json trỏ thẳng vào URL Vercel, nên
     * TV nạp đúng bundle production này chứ không phải một bản build riêng. Trình
     * duyệt của webOS là Chromium bị đóng băng theo đời máy: webOS 4–5 (2018–2020)
     * là Chromium 68, webOS 6 (2021) là 79, webOS 22 mới lên 87. Cả 68 và 79 đều
     * dưới mốc Chrome 80 — nơi `?.` và `??` mới có — nên bundle mặc định làm mấy
     * đời máy đó trắng trang. Hạ target là cách rẻ nhất để một bản deploy chạy được
     * cả TV cũ: esbuild chỉ hạ cú pháp, không thêm polyfill, nên bundle gần như
     * không to thêm.
     *
     * Giới hạn: webOS 1–3 (Chromium 38) thì es2017 không cứu được, vì đời đó chỉ
     * hiểu ES5 và còn chưa nạp được `<script type="module">` (Chrome 61 mới có).
     * Muốn hỗ trợ thì phải thêm @vitejs/plugin-legacy, không phải đổi target.
     */
    target: 'es2017',
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api': 'http://localhost:4000' },
  },
});
