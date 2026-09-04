/**
 * Hai cái vỏ bọc route dùng chung. Tách ra khỏi `server.ts` vì `server.ts` mở
 * cổng và nối DB ngay lúc import, nên không kiểm thử được — còn đây là hàm thuần,
 * `test/http.test.js` gọi trực tiếp với req/res giả.
 */
import type express from 'express';

/**
 * Bắt lỗi của handler async và đẩy sang middleware lỗi của Express.
 *
 * Express 5 tự bắt promise bị reject, nhưng viết rõ ra vẫn có lý: nó cố định
 * đường đi của lỗi (`next(error)` → middleware lỗi ở cuối `server.ts`) thay vì
 * phụ thuộc vào hành vi của phiên bản đang cài.
 */
export const asyncRoute = (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => handler(req, res).catch(next);

/**
 * Route chỉ đọc: gói lại để **chỉ câu trả lời thành công** mang Cache-Control.
 *
 * Vì sao gắn header sau khi đã có dữ liệu trong tay chứ không phải middleware gắn
 * trước: handler ném lỗi (nguồn ngoài chết, DB chưa nối lại) thì header vẫn còn
 * nguyên trên response, và một cái 502 nhất thời được trình duyệt giữ lại vài
 * phút — lỗi nhất thời thành lỗi dính, người dùng bấm thử lại cũng vô ích. Làm
 * theo cách này thì không có nhánh nào cache được lỗi.
 *
 * `Vary: Origin` là bắt buộc: CORS trả `Access-Control-Allow-Origin` theo origin
 * của người gọi, thiếu Vary thì cache chung có thể đưa lại header của origin khác
 * và trình duyệt chặn. `x-catalog-source` đi kèm vì `preferredCatalog()` cũng đọc
 * header đó — web gửi nguồn qua `?source=` (tự chia khoá cache rồi), nhưng ai gọi
 * bằng curl kèm header thì không được ăn lại bản của nguồn khác.
 *
 * `stale-while-revalidate` là phần đáng giá nhất: hết hạn rồi thì trình duyệt vẫn
 * vẽ ngay bản cũ và đi lấy bản mới ở nền, nên lần mở lại nào cũng có hình liền.
 */
export const cachedRoute = (seconds: number, load: (req: express.Request) => Promise<unknown>) =>
  asyncRoute(async (req, res) => {
    const body = await load(req);
    res.header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    res.header('Vary', 'Origin, x-catalog-source');
    res.json(body);
  });
