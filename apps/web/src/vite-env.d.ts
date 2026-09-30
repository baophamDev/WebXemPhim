/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /**
   * Địa chỉ API do vỏ Android chèn vào index.html khi người dùng đổi máy chủ
   * trong app. Vắng mặt ở mọi nền tảng khác — lúc đó dùng VITE_API_URL.
   */
  __API_BASE__?: string;
  /**
   * Cầu JavaScript của vỏ Android. Chỉ có khi trang đang chạy trong app Android;
   * nơi gọi phải tự kiểm tra trước (xem nút "Máy chủ" trong ui/Shell.tsx).
   */
  CinemaNative?: { openServerDialog(): void };
}
