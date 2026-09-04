# Quảng cáo trong phim của nguồn

## Quảng cáo nằm trong playlist, không nằm trong trang

Nguồn không phát quảng cáo bằng một lớp overlay hay một script nào trên trang —
nó nhồi thẳng vào file `.m3u8`. Một playlist bị chèn trông như thế này:

```m3u8
#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:5.000,
https://ads.example.com/preroll/ad1.ts     <- 15 giây quảng cáo
#EXTINF:5.000,
https://ads.example.com/preroll/ad2.ts
#EXTINF:5.000,
https://ads.example.com/preroll/ad3.ts
#EXT-X-DISCONTINUITY                        <- dấu ngắt giữa hai nguồn
#EXTINF:10.000,
seg1.ts                                     <- từ đây mới là phim
```

Với player thì đây chỉ là một danh sách segment phải phát tuần tự; nó không có
cách nào biết ba segment đầu không thuộc bộ phim. Chặn quảng cáo kiểu trình duyệt
(lọc theo domain) cũng không giúp gì: chặn được thì player mất segment, đứng luôn
ở giây 0 chứ không nhảy vào phim.

Vì vậy chỗ rẻ nhất và chắc nhất để xử lý là **sửa playlist trước khi giao cho
player**. Segment quảng cáo không bị chặn — nó không còn được liệt kê, nên player
chẳng bao giờ tải tới.

## Vì sao lọc ở máy chủ chứ không ở trình duyệt

`hls.js` có `pLoader` cho phép nắn playlist ngay trên trình duyệt, và nếu chỉ có
bản web trên máy tính thì làm ở đó là đủ. Nhưng iOS/Safari và app TV LG phát HLS
bằng player gốc của hệ thống (`video.canPlayType('application/vnd.apple.mpegurl')`)
— ở đó không chèn được JavaScript nào vào giữa. Làm ở máy chủ thì một bản cài đặt
phục vụ mọi thiết bị, kể cả TV.

Chỉ **playlist** đi qua API — vài KB mỗi lần. Mọi đường dẫn segment và key được
ghi lại thành URL tuyệt đối trỏ thẳng CDN của nguồn, nên băng thông Railway gần
như không đổi và CORS vẫn đúng như khi player gọi trực tiếp.

## Ba dấu hiệu nhận quảng cáo

`services/api/src/hls.ts` cắt playlist thành từng block (theo
`#EXT-X-DISCONTINUITY`, theo host/thư mục, theo trạng thái cue) rồi chấm từng
block. Mạnh trước, yếu sau:

1. **`#EXT-X-CUE-OUT` / `#EXT-X-CUE-IN`** (SCTE-35, kèm các biến thể
   `#EXT-X-DATERANGE ... SCTE35-OUT`). Đây là nguồn tự khai "đoạn này là ad
   break" — không cần đoán gì thêm. Bắt được cả quảng cáo đặt cùng CDN với phim.
2. **Từ khoá trong đường dẫn segment**: `/ads/`, `-ad_`, `advert`, `preroll`,
   `bumper`, `sponsor`, `doubleclick`, `googleads`… Các mẫu này neo vào dấu phân
   cách (`/ads?[-_/]`) để không cắt oan những đường dẫn vô can như
   `/adaptive/download-adaptive-1.ts`.
3. **Khác host hoặc khác thư mục so với phần phim**. Quảng cáo gần như luôn được
   chèn từ một CDN khác, nên "chữ ký" `host + thư mục` của nó lệch khỏi chữ ký
   của phần phim. Quy tắc này bắt được cả những block mà tên file cố tình vô can
   (`clip1.ts`, `filler2.ts`).

Quy tắc 3 là quy tắc đoán, nên có hai chốt an toàn. Thứ nhất, nó chỉ bật khi một
chữ ký chiếm **quá nửa tổng thời lượng** playlist — thời lượng được gộp theo chữ
ký chứ không theo block, vì quảng cáo giữa phim chẻ phần phim thành hai block và
xét lẻ thì không block nào quá bán, quy tắc sẽ bị tắt oan. Thứ hai, **không bao
giờ trả playlist rỗng**: nếu mọi block đều bị chấm là quảng cáo thì block dài
nhất được giữ lại. Playlist có cấu trúc lạ thì thà còn quảng cáo còn hơn chết
tập phim.

## Dựng lại playlist cho player không sặc

Cắt segment ra khỏi danh sách là phần dễ. Phần dễ sai là những tag đi kèm:

- **`#EXT-X-KEY`** — quảng cáo hay dùng key AES riêng. Bỏ segment mà bỏ luôn tag
  key thì phần phim sau đó giải mã bằng key sai; nên tag key được phát lại mỗi
  lần key đổi, và phát `METHOD=NONE` khi chuyển từ đoạn có mã hoá sang đoạn không.
- **`#EXT-X-MAP`** — init segment của fMP4, cũng phát lại theo cùng nguyên tắc.
- **`#EXT-X-TARGETDURATION`** — tính lại theo segment còn giữ.
- **`#EXT-X-MEDIA-SEQUENCE`** — nhích lên đúng số segment bị bỏ ở phía trước, nếu
  không player sẽ hiểu sai vị trí mỗi lần playlist làm mới (chỉ ảnh hưởng live).
- **`#EXT-X-DISCONTINUITY`** — dấu ngắt bao quanh block bị cắt phải bỏ theo. Hai
  nửa phim sau khi bỏ quảng cáo giữa là **một mạch thời gian liên tục**; để lại
  dấu ngắt thì `hls.js` reset timeline và người xem thấy giật một nhịp.

Master playlist thì không cắt gì: nó chỉ trỏ sang các playlist con, nên từng
variant được ghi lại để đi tiếp qua proxy, còn quảng cáo được xử lý ở playlist
con.

## Ba bậc nguồn ở player

Lọc quảng cáo không được phép làm giảm độ tin cậy. `apps/web/src/pages/Watch.tsx`
tụt xuống một bậc mỗi khi bậc đang dùng chết:

```text
clean   /api/stream/episode/:id/playlist.m3u8   playlist đã bóc quảng cáo
direct  m3u8Url của nguồn                       còn quảng cáo, nhưng API hỏng vẫn xem được
embed   trang nhúng của nguồn                   bậc cuối, bên trong mình không kiểm soát gì
```

Với `hls.js` thì tụt bậc khi có lỗi `fatal`; với player gốc thì bắt sự kiện
`error` trên thẻ `<video>`. Tập nào không có `m3u8Url` thì vào thẳng bậc `embed`.

Riêng bậc `embed`, iframe được siết `sandbox="allow-scripts allow-same-origin
allow-presentation allow-forms"` — **cố tình thiếu** `allow-popups` và
`allow-top-navigation`, nên trang nhúng không mở nổi tab quảng cáo và không cướp
được điều hướng, trong khi phần phát phim vẫn chạy.

## Soi xem bộ lọc quyết định thế nào

Khi một tập vẫn còn quảng cáo, hoặc ngược lại bị cắt mất một đoạn phim, dùng
endpoint chẩn đoán thay vì đoán:

```bash
curl "http://localhost:4000/api/stream/episode/123/report" | jq
curl "http://localhost:4000/api/stream/episode/123/report?raw=1" | jq -r .raw
```

Trả về từng block với chữ ký, số segment, thời lượng và **lý do**: `giữ`,
`ad break (CUE-OUT)`, `từ khoá quảng cáo trong URL`, hay `khác nguồn với phần
phim`. `?raw=1` kèm 8 KB đầu của playlist gốc để đối chiếu khi nguồn đổi cách
chèn.

Ngoài ra mỗi response playlist đều mang header `X-Ads-Removed` và
`X-Ads-Removed-Seconds` (đã expose qua CORS), và API log lại mỗi lần cắt được:

```text
[stream] bỏ 3 segment (~15s) quảng cáo: https://.../index.m3u8
```

Nguồn đổi cách chèn thì chỗ cần sửa là `AD_URL_PATTERNS` trong
`services/api/src/hls.ts` — thêm mẫu, thêm một test tương ứng trong
`services/api/test/hls.test.js`, rồi `npm test`.

## Bảo mật của proxy

Một endpoint "lấy hộ URL này" là một lỗ SSRF nếu làm hớ. Ở đây có bốn lớp:

- Route chính chỉ nhận `episodeId` rồi **tự đọc `m3u8_url` từ database** — người
  gọi không đưa URL vào được.
- Playlist con (khi nguồn dùng master playlist) đi qua `/api/stream/hls` và bắt
  buộc có chữ ký HMAC-SHA256 do chính máy chủ này phát ra, so bằng
  `timingSafeEqual`. URL không do mình ký thì trả 403.
- Chỉ nhận `http`/`https`, và hostname được resolve trước để **chặn dải nội bộ**:
  loopback, private, link-local, CGNAT và dải metadata của cloud.
- Trần 4 MB mỗi playlist (đọc theo chunk, quá thì huỷ) và timeout 15 giây, nên
  nguồn lỗi không kéo sập API.

`STREAM_SECRET` là khoá ký nói trên. Không đặt thì mỗi tiến trình tự sinh một
khoá ngẫu nhiên — link con của tiến trình cũ hết hiệu lực sau khi restart, player
rơi xuống bậc dự phòng rồi tải lại, không vỡ gì. Chỉ cần đặt khi chạy nhiều
instance API song song (hoặc muốn link sống qua lần restart).

Playlist đã lọc được cache trong bộ nhớ: 300 giây cho VOD (playlist không đổi
nữa) và 15 giây cho live, tối đa 300 entry.

## Cái không xử lý được ở tầng playlist

Nếu nguồn **nướng quảng cáo vào chính segment của phim** — cùng host, cùng thư
mục, không dấu cue, 15 giây đầu của `seg1.ts` là quảng cáo — thì không bộ lọc
playlist nào bỏ được, vì không có gì để bỏ: nó là một phần của file phim. Lúc đó
`/report` sẽ cho thấy playlist chỉ có **một block duy nhất, verdict `giữ`**, và
đó là dấu hiệu để nhận ra trường hợp này. Cách xử lý còn lại là nhảy qua bằng
`#EXT-X-START` hoặc offset thời gian, tức là phải biết chính xác quảng cáo dài
bao nhiêu — hiện chưa làm.

Tương tự, quảng cáo overlay bên trong trang nhúng (bậc `embed`) nằm trong tài
liệu cross-origin, mình không đọc và không sửa DOM của nó được. Đó là lý do bậc
`embed` chỉ là bậc cuối, và sandbox được siết để ít nhất nó không mở tab.

## Test

```bash
npm test        # ở thư mục gốc — build services/api rồi chạy node --test
```

Bộ test dựng playlist tổng hợp cho từng tình huống: pre-roll từ CDN khác, quảng
cáo giữa phim với tên file vô can, ad break khai bằng CUE-OUT trên cùng CDN,
playlist sạch (phải không chạm gì), key AES riêng của quảng cáo, `EXT-X-MAP` của
fMP4, master playlist, chốt "không bao giờ xoá hết", và hai ca không được cắt oan.
Không cần mạng, không cần database, nên chạy được cả trong CI.
