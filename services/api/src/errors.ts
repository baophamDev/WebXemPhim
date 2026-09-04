/**
 * Một chỗ duy nhất quyết định client được biết gì khi có lỗi.
 *
 * Message của Node/postgres/undici mô tả hạ tầng chứ không mô tả sai sót của người
 * gọi: `connect ECONNREFUSED 127.0.0.1:5432` khai luôn cổng database,
 * `getaddrinfo ENOTFOUND db.abcxyz.supabase.co` khai luôn project ref Supabase, còn
 * `PostgresError` mang theo cả tên bảng, tên cột và câu lệnh. Người xem phim không
 * làm gì được với mấy câu đó, còn người lạ thì đọc xong là vẽ được sơ đồ hạ tầng.
 *
 * Nên: chỉ message do chính mình viết mới ra tới client. Lỗi còn lại trả một câu
 * chung kèm mã `ref`, chi tiết nằm trong log máy chủ — tra bằng mã đó.
 */

/** Lỗi do mình chủ động tạo: message viết cho người đọc nên trả nguyên văn được. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const httpError = (status: number, message: string) => new HttpError(status, message);

/** Lỗi socket/DNS, dù phát ra từ `fetch` hay từ driver postgres. */
const NETWORK_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
  'EHOSTUNREACH', 'ENETUNREACH', 'EPROTO', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECT_TIMEOUT', 'ConnectTimeoutError', 'HeadersTimeoutError'
]);

/** `fetch` gói lỗi thật vào `cause`, có khi lồng hai lớp — phải lần theo chuỗi. */
function marks(error: any): string[] {
  const found: string[] = [];
  for (let current = error, depth = 0; current && depth < 5; current = current.cause, depth += 1) {
    if (typeof current.code === 'string') found.push(current.code);
    if (typeof current.name === 'string') found.push(current.name);
  }
  return found;
}

const isNetworkFailure = (error: unknown) => marks(error).some((mark) => NETWORK_CODES.has(mark));

/**
 * Hỏng khi gọi ra ngoài (provider, CDN playlist). undici bọc mọi lỗi mạng của
 * `fetch` vào `TypeError: fetch failed` (lỗi thật nằm ở `cause`), còn hết thời gian
 * chờ thì ném `AbortError` — không hình dạng nào trùng với lỗi của postgres.js, nên
 * đây là cách tách "nguồn phim hỏng" khỏi "database hỏng" mà không phải soi nội bộ
 * của driver. Cả hai đều là ECONNREFUSED nên chỉ nhìn `code` là không phân biệt được.
 */
function isOutboundFailure(error: any) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return true;
  return error?.name === 'TypeError' && /fetch failed/i.test(String(error?.message ?? ''));
}

export interface Failure {
  status: number;
  /** Câu duy nhất được phép ra tới client. */
  message: string;
  /** true = lỗi của mình, phải ghi log kèm `ref`. false = lỗi của request, log chỉ làm ồn. */
  log: boolean;
}

/**
 * Thứ tự xét: lỗi của request trước (nói thẳng được), rồi lỗi khi gọi ra ngoài, rồi
 * mới tới database. Đặt lỗi ra ngoài trước vì `dbState.ready` còn false trong vài
 * giây đầu và cả lúc Supabase ngủ, trong khi trang chủ vẫn chạy bằng provider —
 * provider chết giữa lúc đó thì phải báo đúng là lỗi nguồn, không phải lỗi DB.
 */
export function describeFailure(error: unknown, options: { dbReady?: boolean } = {}): Failure {
  const raw = error as any;

  // zod: sai tham số của chính request, người gọi sửa được nên nói thẳng.
  const issue = raw?.issues?.[0]?.message;
  if (typeof issue === 'string' && issue) return { status: 400, message: issue, log: false };

  if (error instanceof HttpError) return { status: error.status, message: error.message, log: error.status >= 500 };

  // express.json() dùng http-errors: `expose: true` nghĩa là message viết cho
  // client (body JSON sai cú pháp, body quá lớn), không dính gì tới hạ tầng.
  if (raw?.expose === true && Number.isInteger(raw.status) && raw.status < 500 && typeof raw.message === 'string' && raw.message) {
    return { status: raw.status, message: raw.message, log: false };
  }

  if (isOutboundFailure(raw)) return { status: 502, message: 'Không lấy được dữ liệu từ nguồn, thử lại sau', log: true };
  if (isNetworkFailure(error) || options.dbReady === false) {
    return { status: 503, message: 'Máy chủ đang kết nối lại cơ sở dữ liệu, thử lại sau', log: true };
  }

  const status = Number.isInteger(raw?.status) && raw.status >= 500 ? raw.status : 500;
  return { status, message: 'Máy chủ gặp lỗi khi xử lý yêu cầu', log: true };
}

/** SQLSTATE hay gặp khi cấu hình DATABASE_URL sai. */
const SQLSTATE: Record<string, string> = {
  '28P01': 'sai mật khẩu database',
  '28000': 'thông tin đăng nhập bị từ chối',
  '3D000': 'database không tồn tại',
  '53300': 'hết slot kết nối'
};

/**
 * Lý do ngắn cho `/api/health`: đủ để biết phải sửa DNS, mật khẩu hay firewall,
 * nhưng không kèm host/cổng/tên bảng vì endpoint này công khai. Message đầy đủ vẫn
 * nằm trong log lúc khởi động.
 */
export function shortCause(error: unknown): string {
  const found = marks(error);
  const message = error instanceof Error ? error.message : String(error ?? '');
  for (const mark of found) if (SQLSTATE[mark]) return SQLSTATE[mark];
  if (found.includes('ENOTFOUND') || found.includes('EAI_AGAIN')) return 'không phân giải được tên miền';
  if (found.includes('ECONNREFUSED')) return 'bị từ chối kết nối';
  if (found.includes('ETIMEDOUT') || found.includes('AbortError') || found.includes('ConnectTimeoutError')) return 'hết thời gian chờ';
  if (/password|authentication|SASL/i.test(message)) return 'sai thông tin đăng nhập';
  if (/\bSSL\b|certificate|\bTLS\b/i.test(message)) return 'lỗi SSL';
  if (/DATABASE_URL/.test(message)) return 'thiếu hoặc sai DATABASE_URL';
  return 'lỗi kết nối';
}
