import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle } from 'lucide-react';
import { useSaveProgressMutation } from '../api';
import { loadPlayerEngine } from '../chunks';
import { recordProgress } from '../libraryStore';
import { previewFromState, recallMovie, type MoviePreview } from '../preview';
import { useSourceDetail, type SourceDetailState, type SourcePref } from '../useSourceDetail';
import type { TitleHint } from '../match';
import { SubtitlePicker } from '../subs/Panel';
import type { CueSize } from '../subs/store';
import { useSubtitles, type ActiveCue } from '../subs/useSubtitles';
import type { Episode, Movie } from '../types';
import { ErrorState } from '../ui';

/** HLS trực tiếp là đường chính; trang nhúng là đường lùi khi HLS không phát được. */
type Stage = 'direct' | 'embed';

/**
 * Host nhúng đã biết là **chặn iframe** (Cloudflare + X-Frame-Options), vd
 * `*.streamc.xyz` của NguonC. Dựng khung cho nó chỉ ra màn "refused to connect"
 * đen sì, nên thay bằng tấm mời mở ở tab mới — nơi trình duyệt vượt được Cloudflare.
 */
function embedBlocksFrame(url: string): boolean {
  try { return /(^|\.)streamc\.xyz$/i.test(new URL(url).hostname); } catch { return false; }
}

function VideoPlayer({ episode, title, subtitle, cueSize, onProgress }: {
  episode: Episode; title: string; subtitle: ActiveCue | null; cueSize: CueSize;
  onProgress?: (position: number, duration: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const firstStage: Stage = episode.m3u8Url ? 'direct' : 'embed';
  const [stage, setStage] = useState<Stage>(firstStage);
  useEffect(() => setStage(firstStage), [episode.id, firstStage]);
  const degrade = useCallback(() => setStage('embed'), []);
  const source = stage === 'direct' ? episode.m3u8Url : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;
    /**
     * Phụ đề của nguồn hay lẫn thẻ <i> dạng chuỗi, dọn định kỳ cho đỡ rối.
     *
     * Track của mình thì bỏ qua: nó đã đi qua `subs/convert.ts`, ở đó thẻ <i> hợp lệ
     * được giữ **có chủ đích** — dọn thêm một lượt nữa là xoá đúng thứ vừa dựng ra.
     */
    const cleanCues = () => {
      const mine = trackRef.current?.track;
      Array.from(video.textTracks).forEach((track) => {
        if (track === mine) return;
        Array.from(track.cues ?? []).forEach((cue) => {
          if ('text' in cue) cue.text = String(cue.text).replace(/&lt;\/?i&gt;/gi, '').replace(/<\/?i>/gi, '');
        });
      });
    };
    const interval = window.setInterval(cleanCues, 1000);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source;
      video.addEventListener('error', degrade);
      return () => {
        window.clearInterval(interval);
        video.removeEventListener('error', degrade);
        video.removeAttribute('src'); video.load();
      };
    }
    let disposed = false;
    let destroy = () => {};
    // hls.js chỉ tải khi trình duyệt không có HLS native.
    void loadPlayerEngine().then(({ default: Hls }) => {
      if (disposed) return;
      if (!Hls.isSupported()) { setStage('embed'); return; }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      destroy = () => hls.destroy();
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) degrade(); });
    });
    return () => { disposed = true; window.clearInterval(interval); destroy(); };
  }, [episode.id, source, degrade]);

  /**
   * Báo vị trí/thời lượng thật về cho trang. `timeupdate` bắn vài lần mỗi giây,
   * mà mỗi lần ghi là một lần vào localStorage — ghi theo nhịp đó thì một tập
   * phim thành mấy nghìn lần ghi, nên chỉ gửi mỗi 10 giây.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;
    let last = 0;
    const report = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return;
      const now = Date.now();
      if (now - last < 10_000) return;
      last = now;
      onProgress(video.currentTime, duration);
    };
    video.addEventListener('timeupdate', report);
    return () => { video.removeEventListener('timeupdate', report); };
  }, [episode.id, source, onProgress]);

  /**
   * Bật track của mình bằng tay. Thuộc tính `default` chỉ là *gợi ý* cho lượt tải đầu:
   * cả hai đường phát đều dựng lại danh sách textTracks giữa đường — player gốc khi
   * `video.src` được đặt, hls.js khi nó gắn media — và mỗi lần dựng lại thì mọi track
   * về `disabled`. Không bật lại ở đây thì đổi bậc nguồn một cái là phụ đề tắt lặng lẽ.
   *
   * Đồng thời tắt track đang hiện của nguồn: hai lớp chữ đè lên nhau còn khó đọc hơn
   * là không có phụ đề.
   */
  useEffect(() => {
    const video = videoRef.current;
    const element = trackRef.current;
    if (!video || !element || !subtitle) return;
    const show = () => {
      Array.from(video.textTracks).forEach((track) => {
        if (track === element.track) track.mode = 'showing';
        else if (track.mode === 'showing') track.mode = 'disabled';
      });
    };
    show();
    video.addEventListener('loadedmetadata', show);
    element.addEventListener('load', show);
    return () => { video.removeEventListener('loadedmetadata', show); element.removeEventListener('load', show); };
  }, [subtitle?.url, source]);

  if (!source) {
    // Host chặn iframe (streamc của NguonC): khỏi dựng khung chết, mời mở tab mới.
    if (embedBlocksFrame(episode.embedUrl)) {
      return <div className="embed-blocked">
        <ExternalLink />
        <p>Nguồn NguonC (streamc.xyz) chặn phát trong khung. Mở ở tab mới để xem, hoặc đổi sang KKPhim ở trên.</p>
        <a className="button primary" href={episode.embedUrl} target="_blank" rel="noreferrer"><ExternalLink />Mở trình phát ở tab mới</a>
      </div>;
    }
    return <iframe
      src={episode.embedUrl}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      referrerPolicy="no-referrer"
    />;
  }
  return <video ref={videoRef} className={`cue-${cueSize}`} controls autoPlay playsInline title={title}>
    {/* `key` theo URL: kéo lệch giờ sinh ra một blob mới, phải là một thẻ mới chứ
        không phải đổi `src` — đổi src trên thẻ cũ thì Chrome giữ nguyên cue đã nạp.
        `srclang` bắt buộc phải có với kind="subtitles"; không đoán được thì `und`. */}
    {subtitle ? <track
      ref={trackRef} key={subtitle.url} kind="subtitles" src={subtitle.url}
      label={subtitle.label} srcLang={subtitle.lang || 'und'} default
    /> : null}
  </video>;
}

/**
 * Phần vẽ ra màn hình xem, tách khỏi `Watch` vì nó chỉ dựng được khi **đã** có tập.
 *
 * Hook phụ đề và việc ghi tiến trình đều cần một `episode` chắc chắn tồn tại, mà hook
 * thì không được gọi sau một câu `return` sớm — nhồi cả hai vào `Watch` là phải cho
 * chúng nhận `Episode | null` rồi tự đoán xem có nên làm gì không.
 */
/** Bản mô tả tối thiểu khi mở thẳng link xem mà chưa có dữ liệu phim nào. */
function snapshotOf(slug: string, name: string): MoviePreview {
  return {
    id: 0, provider: 'local', providerId: null, slug, name, originName: null, description: null,
    type: 'single', status: null, year: null, duration: null, quality: null, language: null,
    posterUrl: null, thumbUrl: null, trailerUrl: null, rating: null, viewCount: 0,
    tmdbId: null, imdbId: null, genres: [], countries: [], actors: [], directors: []
  };
}

/**
 * Thanh đổi nguồn phát. Tách riêng để dùng được cả khi đang xem (trong `Screen`)
 * lẫn khi một nguồn ép tay vừa thất bại (màn lỗi vẫn phải cho đổi sang nguồn khác,
 * không được để người xem kẹt).
 */
function SourceSwitch({ detail }: { detail: SourceDetailState }) {
  return <div className="source-switch" role="group" aria-label="Nguồn phát">
    <span className="source-switch-label">Nguồn</span>
    {detail.sources.map((item) => <button
      key={item.id} type="button"
      className={detail.sourceId === item.id ? 'chip active' : 'chip'}
      aria-pressed={detail.sourceId === item.id}
      disabled={detail.isFetching}
      onClick={() => detail.setSource(item.id)}
      title={`Phát bằng ${item.label}`}
    >{detail.isFetching && detail.pref === item.id ? <LoaderCircle className="spin" /> : null}{item.label}</button>)}
  </div>;
}

function Screen({ slug, title, movie, episode, episodes, detail }: {
  slug: string; title: string; movie: Movie | null; episode: Episode; episodes: Episode[]; detail: SourceDetailState;
}) {
  const navigate = useNavigate();
  const [save] = useSaveProgressMutation();
  const started = useRef(Date.now());
  /** Vị trí/thời lượng đo được từ trình phát, để lần ghi cuối không đè mất. */
  const measured = useRef({ position: 1, duration: 0 });
  const subs = useSubtitles({ movieSlug: slug, episode, episodes });
  const snapshot = useMemo(() => movie ?? snapshotOf(slug, title), [movie, slug, title]);

  /**
   * Ghi tiến trình xuống **máy** cho mọi tập — kể cả tập id âm đến thẳng từ nguồn,
   * thứ không gửi được lên API. Thiếu nhánh này thì phim xem qua đường dự phòng
   * không bao giờ xuất hiện trong "Xem tiếp": kho không có `episode_id` để gắn vào.
   */
  const remember = useCallback((position: number, duration: number, completed: boolean) => {
    if (!completed) {
      measured.current = {
        position: Math.max(position, measured.current.position),
        duration: Math.max(duration, measured.current.duration)
      };
    }
    recordProgress({
      movie: snapshot, episodeId: episode.id, episodeName: episode.name,
      position: completed ? 0 : measured.current.position, duration: measured.current.duration,
      completed, updatedAt: Date.now()
    });
  }, [snapshot, episode.id, episode.name]);
  // Hiệu ứng dưới chỉ được chạy lại khi **đổi tập**, không phải khi bản mô tả phim
  // về muộn hơn vài trăm ms — nên nó đọc callback qua ref.
  const rememberRef = useRef(remember);
  rememberRef.current = remember;

  // Tập đã có trong kho (id dương) thì ghi thêm lên API; tập của nguồn (id âm)
  // chỉ có bản trên máy.
  const trackable = episode.id > 0;
  useEffect(() => {
    measured.current = { position: 1, duration: 0 };
    rememberRef.current(1, 0, false);
    started.current = Date.now();
    if (trackable) save({ episodeId: episode.id, position: 1, duration: 0 });
    return () => {
      const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      rememberRef.current(seconds, 0, false);
      if (trackable) save({ episodeId: episode.id, position: seconds, duration: 0 });
    };
  }, [episode.id, trackable, save]);

  const index = episodes.findIndex((item) => item.id === episode.id);
  const activeLabel = detail.sources.find((item) => item.id === detail.sourceId)?.label ?? '';
  return <div className="watch-page">
    <div className="watch-header">
      <Link to={`/movie/${slug}`}><ArrowLeft /><span>Quay lại</span></Link>
      <div><b>{title}</b><small>{episode.serverName.trim()} · {episode.name}</small></div>
      <div className="watch-tools">
        {/* Đổi nguồn phát bằng tay: một nguồn sập (vd NguonC bị Cloudflare chặn) thì
            bấm nguồn khác, trang tự tìm lại đúng phim ở nguồn đó theo tên. */}
        <SourceSwitch detail={detail} />
        <SubtitlePicker subs={subs} episodeId={episode.id} />
        {/* Danh sách tập đến cùng request phim; chưa có thì ẩn ô chọn chứ không hiện ô rỗng. */}
        {episodes.length > 1 ? <label>
          <span>Tập</span>
          <select value={episode.id} onChange={(event) => navigate(`/watch/${slug}/${event.target.value}`)} aria-label="Chọn tập">
            {episodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <ChevronDown />
        </label> : null}
      </div>
    </div>
    {!episode.m3u8Url ? <div className="watch-note">
      <span>Nguồn “{activeLabel}” nhúng từ trang ngoài. Xem mượt nhất là đổi sang <b>KKPhim</b> ở trên (phát thẳng trong khung); NguonC thì mở ở tab mới.</span>
    </div> : null}
    <div className="player-frame">
      <VideoPlayer
        episode={episode} title={`${title} — ${episode.name}`} subtitle={subs.cue} cueSize={subs.size}
        onProgress={(position, duration) => remember(position, duration, false)}
      />
    </div>
    <div className="watch-footer">
      {index > 0 ? <Link to={`/watch/${slug}/${episodes[index - 1].id}`}><ChevronLeft />Tập trước</Link> : <span />}
      <button onClick={() => {
        rememberRef.current(0, 0, true);
        if (trackable) save({ episodeId: episode.id, position: 0, duration: 0, completed: true });
      }}><Check />Đã xem</button>
      {index >= 0 && index < episodes.length - 1 ? <Link to={`/watch/${slug}/${episodes[index + 1].id}`}>Tập sau<ChevronRight /></Link> : <span />}
    </div>
  </div>;
}

/**
 * Lấy chi tiết phim thẳng từ nguồn (không còn backend) và cho đổi nguồn bằng tay.
 *
 * `useSourceDetail` tự chọn nguồn phát được (ưu tiên m3u8 của KKPhim), hoặc theo
 * nguồn người xem đã ghim. Tập trên URL mang id âm của **một** nguồn; đổi nguồn thì
 * id đó không còn trong danh sách mới, nên hiệu ứng dưới nhảy tới tập **cùng số** ở
 * nguồn mới rồi thay URL — nhờ vậy nút tập trước/sau và ô chọn vẫn khớp.
 */
export default function Watch() {
  const { slug = '', episodeId = '' } = useParams();
  const id = Number(episodeId);
  const location = useLocation();
  const navigate = useNavigate();
  const preview = useMemo(() => previewFromState(location.state) ?? recallMovie(slug), [location.state, slug]);
  const initialPref = (location.state as { source?: SourcePref } | null)?.source ?? 'auto';
  const hint = useMemo<TitleHint>(() => ({
    name: preview?.name ?? '', originName: preview?.originName ?? null, year: preview?.year ?? null, slug
  }), [preview?.name, preview?.originName, preview?.year, slug]);
  const detail = useSourceDetail(slug, hint, initialPref);
  const episodes = detail.data?.episodes ?? [];
  const movie: Movie | null = detail.data?.movie ?? preview ?? null;
  const episode = episodes.find((item) => item.id === id) ?? null;

  // Nhớ số tập đang xem để khi đổi nguồn (id khác hệ) còn nhảy đúng tập.
  const lastNumber = useRef<number | null>(null);
  useEffect(() => { if (episode?.episodeNumber != null) lastNumber.current = episode.episodeNumber; }, [episode?.id, episode?.episodeNumber]);

  // Đổi nguồn/F5: id trên URL không thuộc danh sách nguồn hiện tại → nhảy tới tập
  // cùng số (hoặc tập đầu) và thay URL, không thêm một mục history mới.
  useEffect(() => {
    if (!episodes.length || episodes.some((item) => item.id === id)) return;
    const want = lastNumber.current;
    const next = (want != null && episodes.find((item) => item.episodeNumber === want)) || episodes[0];
    navigate(`/watch/${slug}/${next.id}`, { replace: true, state: location.state });
  }, [episodes, id, slug, navigate, location.state]);

  if (!episode) {
    // Nguồn ép tay thất bại (hoặc không nguồn nào có): vẫn phải cho đổi nguồn khác,
    // không để người xem kẹt ở màn lỗi. Còn đang tải/chờ nhảy tập thì hiện vòng xoay.
    if (detail.error && !episodes.length) {
      return <div className="watch-page">
        <div className="watch-header">
          <Link to={`/movie/${slug}`}><ArrowLeft /><span>Quay lại</span></Link>
          <div><b>{movie?.name || 'Phim'}</b><small>Nguồn này không phát được</small></div>
          <div className="watch-tools"><SourceSwitch detail={detail} /></div>
        </div>
        <div className="watch-loading"><ErrorState message={detail.error} onRetry={() => detail.setSource('auto')} /></div>
      </div>;
    }
    return <div className="watch-loading"><LoaderCircle className="spin" /></div>;
  }
  return <Screen
    slug={slug} title={movie?.name || 'Đang tải tên phim'} movie={movie}
    episode={episode} episodes={episodes} detail={detail}
  />;
}
