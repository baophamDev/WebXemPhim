import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { apiBaseUrl, useGetMovieQuery, useSaveProgressMutation } from '../api';
import type { Episode } from '../types';
import { ErrorState } from '../ui';

/**
 * Thang nguồn, tụt dần một bậc mỗi khi bậc đang dùng chết:
 *   clean  — playlist đã bóc quảng cáo do API dựng lại (xem docs/ads.md)
 *   direct — m3u8 gốc: còn quảng cáo, nhưng vẫn xem được khi API hỏng
 *   embed  — trang nhúng của nguồn, bậc cuối vì bên trong mình không kiểm soát gì
 * Lọc quảng cáo không được phép làm giảm độ tin cậy, nên phải có đường lùi.
 */
type Stage = 'clean' | 'direct' | 'embed';

function VideoPlayer({ episode, title }: { episode: Episode; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const firstStage: Stage = episode.m3u8Url ? 'clean' : 'embed';
  const [stage, setStage] = useState<Stage>(firstStage);
  useEffect(() => setStage(firstStage), [episode.id, firstStage]);
  const degrade = useCallback(() => setStage((current) => (current === 'clean' ? 'direct' : 'embed')), []);
  const source = stage === 'clean' ? `${apiBaseUrl}/stream/episode/${episode.id}/playlist.m3u8`
    : stage === 'direct' ? episode.m3u8Url : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;
    // Phụ đề của nguồn hay lẫn thẻ <i> dạng chuỗi, dọn định kỳ cho đỡ rối.
    const cleanCues = () => Array.from(video.textTracks).forEach((track) => Array.from(track.cues ?? []).forEach((cue) => {
      if ('text' in cue) cue.text = String(cue.text).replace(/&lt;\/?i&gt;/gi, '').replace(/<\/?i>/gi, '');
    }));
    const interval = window.setInterval(cleanCues, 1000);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Player gốc (Safari/iOS, một số TV) không cho chèn gì vào giữa — chỉ biết
      // nó chết qua sự kiện error rồi tụt bậc.
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
    // hls.js chỉ tải khi thật sự cần phát HLS — nó nặng hơn cả phần còn lại của trang.
    void import('hls.js').then(({ default: Hls }) => {
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

  if (!source) {
    // sandbox cố tình thiếu allow-popups và allow-top-navigation: trang nhúng
    // không mở nổi tab quảng cáo hay cướp điều hướng, phần phát phim vẫn chạy.
    return <iframe
      src={episode.embedUrl}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      referrerPolicy="no-referrer"
    />;
  }
  return <video ref={videoRef} controls autoPlay playsInline title={title} />;
}

/**
 * Chỉ một request: lấy phim là có luôn danh sách tập. Trước đây trang này gọi
 * /episodes/:id để kiểm tra tập tồn tại rồi mới gọi phim — hai chặng nối tiếp
 * khiến người xem phải chờ hai lần.
 */
export default function Watch() {
  const { slug = '', episodeId = '' } = useParams();
  const navigate = useNavigate();
  const result = useGetMovieQuery(slug);
  const [save] = useSaveProgressMutation();
  const started = useRef(Date.now());
  const movie = result.data?.movie;
  const episode = movie?.episodes?.find((item) => item.id === Number(episodeId));

  useEffect(() => {
    if (!episode) return;
    save({ episodeId: episode.id, position: 1, duration: 0 });
    started.current = Date.now();
    return () => { save({ episodeId: episode.id, position: Math.max(1, Math.round((Date.now() - started.current) / 1000)), duration: 0 }); };
  }, [episode?.id]);

  if (result.isLoading) return <div className="watch-loading"><LoaderCircle className="spin" /></div>;
  if (!movie || !episode) return <div className="watch-loading"><ErrorState message="Tập phim không còn tồn tại." /></div>;
  const episodes = movie.episodes ?? [];
  const index = episodes.findIndex((item) => item.id === episode.id);

  return <div className="watch-page">
    <div className="watch-header">
      <Link to={`/movie/${slug}`}><ArrowLeft /><span>Quay lại</span></Link>
      <div><b>{movie.name}</b><small>{episode.serverName.trim()} · {episode.name}</small></div>
      <label>
        <span>Tập</span>
        <select value={episode.id} onChange={(event) => navigate(`/watch/${slug}/${event.target.value}`)} aria-label="Chọn tập">
          {episodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <ChevronDown />
      </label>
    </div>
    <div className="player-frame"><VideoPlayer episode={episode} title={`${movie.name} — ${episode.name}`} /></div>
    <div className="watch-footer">
      {index > 0 ? <Link to={`/watch/${slug}/${episodes[index - 1].id}`}><ChevronLeft />Tập trước</Link> : <span />}
      <button onClick={() => save({ episodeId: episode.id, position: 0, duration: 0, completed: true })}><Check />Đã xem</button>
      {index < episodes.length - 1 ? <Link to={`/watch/${slug}/${episodes[index + 1].id}`}>Tập sau<ChevronRight /></Link> : <span />}
    </div>
  </div>;
}
