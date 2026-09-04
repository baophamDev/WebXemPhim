/**
 * ESLint (flat config) cho cả hai workspace.
 *
 * Một file ở gốc thay vì mỗi workspace một file: hai bên dùng chung gần hết quy
 * tắc, và `npm run lint` ở gốc quét một lượt là xong. Phần khác nhau (globals
 * của browser vs Node, quy tắc hook của React) tách thành từng khối `files`.
 *
 * Không bật lint theo kiểu (type-aware): nó phải dựng lại program của tsc nên
 * chậm gấp nhiều lần, mà phần bắt lỗi kiểu đã có `npm run typecheck` lo trọn.
 */
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/** Quy tắc chung cho mọi file TypeScript trong repo. */
const shared = {
  // Tên bắt đầu bằng "_" là cố ý không dùng: `(_req, res)`, `(_r, _e, slug)`.
  '@typescript-eslint/no-unused-vars': ['error', {
    argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_'
  }],
  // Cảnh báo chứ không chặn: `any` còn đúng ở vài chỗ ranh giới dữ liệu.
  '@typescript-eslint/no-explicit-any': 'warn',
  // `catch {}` để bỏ qua lỗi không quan trọng là mẫu có thật trong code này.
  'no-empty': ['error', { allowEmptyCatch: true }],
  'prefer-const': 'error',
  'no-var': 'error',
  // 'smart' vẫn cho phép `== null` — cách ngắn nhất để bắt cả null và undefined.
  eqeqeq: ['error', 'smart']
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/node_modules/**', '.tools/**', '.runtime/**',
      // Script phục vụ TV chạy như <script> cổ điển với biến toàn cục của webOS,
      // không phải module: lint bằng luật ESM ở đây chỉ sinh báo động giả.
      'apps/web/public/**',
      'BaoNhanCinema/**', 'data/**', 'supabase/**'
    ]
  },

  // ---- apps/web: React 19, chạy trong trình duyệt -------------------------
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, ...shared }
  },
  // vite.config.ts chạy bằng Node lúc build, không phải trong trình duyệt.
  { files: ['apps/web/vite.config.ts'], languageOptions: { globals: globals.node } },

  // ---- services/api: Express 5 trên Node ---------------------------------
  {
    files: ['services/api/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
    rules: shared
  },
  // Adapter nhận JSON của nguồn ngoài: `any` ở đây là cố ý — zod mới là chỗ
  // chốt kiểu, đặt kiểu tay cho payload chưa kiểm tra chỉ tạo cảm giác an toàn.
  {
    files: ['services/api/src/providers/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' }
  },

  // ---- Test: JS thuần, chạy bằng node --test -----------------------------
  {
    files: ['services/api/test/**/*.js', 'apps/web/test/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }], 'prefer-const': 'error' }
  }
);
