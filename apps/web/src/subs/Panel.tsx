/**
 * Bảng phụ đề trong thanh trên của trang xem: chọn track, kéo lệch giờ, cỡ chữ, và ba
 * đường đưa sub vào (chọn file, dán link, tìm tự động).
 *
 * Vì sao file này nằm ở `src/subs/` mà không đi qua `src/ui/index.ts`: barrel đó được
 * mọi trang import nên những gì nó re-export đều rơi vào chunk dùng chung. Bảng này chỉ
 * trang xem cần, mà nó kéo theo cả bộ chuyển đổi phụ đề — để trong barrel là bắt trang
 * chủ tải một thứ nó không bao giờ dùng.
 *
 * Dùng lại đúng bộ CSS `.picker` của header (`ui/pickers.tsx`) với một biến thể rộng
 * hơn: cùng cách mở/đóng, cùng cách đánh dấu mục đang chọn, nên không phải học lại.
 */
import { useRef, useState } from 'react';
import {
  Captions, CaptionsOff, Check, ChevronDown, Download, Link2, LoaderCircle,
  RotateCcw, Search, Trash2, TriangleAlert, Type, Upload
} from 'lucide-react';
import { useLazySearchSubtitlesQuery } from '../api';
import { useDropdown } from '../ui';
import type { CueSize } from './store';
import { explain, type Subtitles } from './useSubtitles';

const SOURCE_LABEL = {
  file: 'file trong máy', url: 'từ link', opensubtitles: 'OpenSubtitles', subdl: 'SubDL'
} as const;
const SIZES: { value: CueSize; label: string }[] = [
  { value: 'sm', label: 'Nhỏ' }, { value: 'md', label: 'Vừa' }, { value: 'lg', label: 'Lớn' }
];
/** Định dạng nào cũng nhận `.txt`: trang chia sẻ hay đổi đuôi để qua bộ lọc upload. */
const ACCEPT = '.srt,.vtt,.ass,.ssa,.sub,.txt';
/** Số bản hiện ra: danh sách của OpenSubtitles có thể hàng trăm, cuộn mãi không hết. */
const MAX_HITS = 12;

const stamp = (value: number) => `${value > 0 ? '+' : ''}${String(value).replace('.', ',')}s`;
const details = (parts: (string | null | false)[]) => parts.filter(Boolean).join(' · ');

export function SubtitlePicker({ subs, episodeId }: { subs: Subtitles; episodeId: number }) {
  const { open, setOpen, box } = useDropdown();
  const [pasting, setPasting] = useState(false);
  const [link, setLink] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  // Tìm sub là hành động, không phải dữ liệu của trang: chỉ chạy khi người xem bấm.
  const [find, found] = useLazySearchSubtitlesQuery();
  const { tracks, active, activeId, busy, notice, persistent } = subs;

  const label = active ? active.label : 'Phụ đề';
  return <div className="picker sub-picker" ref={box}>
    <button
      type="button" className="icon-button picker-button" onClick={() => { if (open) subs.clearNotice(); setOpen(!open); }}
      aria-expanded={open} aria-haspopup="menu"
      title={active ? `Phụ đề: ${active.label}${active.offset ? ` (lệch ${stamp(active.offset)})` : ''}` : 'Phụ đề: đang tắt'}
    >
      {active ? <Captions /> : <CaptionsOff />}
      <span className="picker-value">{label}</span>
      {busy ? <LoaderCircle className="spin" /> : <ChevronDown className="picker-caret" />}
    </button>
    {open ? <div className="picker-menu sub-menu" role="menu">
      <p className="picker-hint">
        Phụ đề gắn tay được lưu trong trình duyệt này, chỉ mình bạn thấy.
        {tracks.length ? '' : ' Chọn file .srt/.ass, dán link, hoặc bấm tìm tự động.'}
      </p>
      {/* Không lưu được thì phải nói **trước** khi người xem gắn cả bộ 24 tập. */}
      {persistent ? null : <p className="picker-hint warn">
        <TriangleAlert /> Trình duyệt đang không cho lưu — sub vẫn xem được ngay, nhưng đóng tab là mất.
      </p>}

      <div className="sub-list">
        <button
          type="button" role="menuitemradio" aria-checked={!activeId}
          className={activeId ? '' : 'on'} onClick={() => subs.select('')}
        >
          <span className="dot off" /><b>Tắt phụ đề</b><small>chỉ còn sub sẵn trong phim</small>
          {activeId ? null : <Check className="picker-tick" />}
        </button>
        {tracks.map((track) => <span className="sub-row" key={track.id}>
          <button
            type="button" role="menuitemradio" aria-checked={track.id === activeId}
            className={track.id === activeId ? 'on' : ''} onClick={() => subs.select(track.id)}
          >
            <span className={track.id === activeId ? 'dot ok' : 'dot alt'} />
            <b>{track.label}</b>
            <small>{details([
              track.lang || null, `${track.cues} câu`, SOURCE_LABEL[track.source],
              !!track.offset && `lệch ${stamp(track.offset)}`
            ])}</small>
            {track.id === activeId ? <Check className="picker-tick" /> : null}
          </button>
          <button type="button" className="sub-drop" onClick={() => void subs.remove(track.id)} aria-label={`Xoá ${track.label}`} title="Xoá">
            <Trash2 />
          </button>
        </span>)}
      </div>

      {/* Lệch giờ là thứ hay phải sửa nhất: bản dịch của nhóm khác thường lệch 1-3 giây. */}
      {active ? <div className="sub-tools">
        <span>Lệch giờ</span>
        <button type="button" onClick={() => subs.nudge(-1)} title="Phụ đề hiện sớm hơn 1 giây">-1</button>
        <button type="button" onClick={() => subs.nudge(-0.5)}>-0,5</button>
        <b>{stamp(active.offset)}</b>
        <button type="button" onClick={() => subs.nudge(0.5)}>+0,5</button>
        <button type="button" onClick={() => subs.nudge(1)} title="Phụ đề hiện muộn hơn 1 giây">+1</button>
        <button type="button" onClick={subs.resetOffset} disabled={!active.offset} aria-label="Về 0" title="Về 0"><RotateCcw /></button>
      </div> : null}

      <div className="sub-tools">
        <span><Type /> Cỡ chữ</span>
        {SIZES.map(({ value, label: name }) => <button
          key={value} type="button" aria-pressed={subs.size === value}
          className={subs.size === value ? 'on' : ''} onClick={() => subs.setSize(value)}
        >{name}</button>)}
      </div>

      <div className="sub-actions">
        <button type="button" onClick={() => picker.current?.click()}><Upload />Chọn file</button>
        <button type="button" className={pasting ? 'on' : ''} onClick={() => setPasting(!pasting)}><Link2 />Dán link</button>
        <button type="button" onClick={() => void find({ episodeId, lang: 'vi' })} disabled={found.isFetching}><Search />Tìm tự động</button>
      </div>
      <input
        ref={picker} type="file" multiple hidden accept={ACCEPT}
        onChange={(event) => {
          if (event.target.files?.length) void subs.addFiles(event.target.files);
          // Xoá giá trị đi: chọn lại **đúng file vừa chọn** thì onChange mới còn nổ.
          event.target.value = '';
        }}
      />
      {pasting ? <form
        className="sub-url"
        onSubmit={(event) => { event.preventDefault(); void subs.addUrl(link); setLink(''); }}
      >
        <input
          value={link} onChange={(event) => setLink(event.target.value)} aria-label="Link phụ đề"
          placeholder="https://… .srt, .vtt hoặc .zip" inputMode="url" autoComplete="off"
        />
        <button type="submit" disabled={!link.trim() || busy}>Tải</button>
      </form> : null}

      {found.isFetching ? <p className="picker-hint"><LoaderCircle className="spin" /> Đang hỏi các nguồn phụ đề…</p> : null}
      {found.error ? <p className="picker-hint warn"><TriangleAlert /> Không tìm được: {explain(found.error)}</p> : null}
      {found.data && !found.isFetching ? <div className="sub-hits">
        {/* Thiếu khoá API là chuyện thường — trả về danh sách rỗng mà không nói gì thì
            trông y như nguồn đã chết. */}
        {found.data.providers.filter((state) => !state.ok).map((state) => <p className="picker-hint" key={state.name}>
          {state.name}: {state.note ?? 'chưa dùng được'}
        </p>)}
        {found.data.hits.length ? found.data.hits.slice(0, MAX_HITS).map((hit) => <button
          key={`${hit.provider}:${hit.id}`} type="button" disabled={busy} onClick={() => void subs.addHit(hit)}
        >
          <Download />
          <b>{hit.name}</b>
          <small>{details([
            hit.langLabel, hit.provider, hit.release,
            hit.downloads ? `${hit.downloads} lượt tải` : null,
            hit.hearingImpaired && 'kèm chú thích âm thanh'
          ])}</small>
        </button>) : <p className="picker-hint">Không có bản nào khớp tập này.</p>}
      </div> : null}
      {notice ? <p className="sub-notice" role="status">{notice}</p> : null}
    </div> : null}
  </div>;
}

