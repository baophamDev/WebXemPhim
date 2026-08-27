import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { useGetMovieQuery, useSaveProgressMutation } from '../api';
import type { Episode } from '../types';
import { ErrorState } from '../ui';

function VideoPlayer({ episode, title }: { episode: Episode; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fallback, setFallback] = useState(!episode.m3u8Url);
  useEffect(() => setFallback(!episode.m3u8Url), [episode.id, episode.m3u8Url]);
  useEffect(() => {
    if (fallback) return;
    const video = videoRef.current;
    if (!video || !episode.m3u8Url) return;
    // Phụ đề của nguồn hay lẫn thẻ <i> dạng chuỗi, dọn định kỳ cho đỡ rối.
    const cleanCues = () => Array.from(video.textTracks).forEach((track) => Array.from(track.cues ?? []).forEach((cue) => {
      if ('text' in cue) cue.text = String(cue.text).replace(/&lt;\/?i&gt;/gi, '').replace(/<\/?i>/gi, '');
    }));
    const interval = window.setInterval(cleanCues, 1000);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = episode.m3u8Url;
      return () => { window.clearInterval(interval); video.removeAttribute('src'); video.load(); };
    }
    let disposed = false;
    let destroy = () => {};
    // hls.js chỉ tải khi thật sự cần phát HLS — nó nặng hơn cả phần còn lại của trang.
    void import('hls.js').then(({ default: Hls }) => {
      if (disposed) return;
      if (!Hls.isSupported()) { setFallback(true); return; }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      destroy = () => hls.destroy();
      hls.loadSource(episode.m3u8Url!);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) setFallback(true); });
    });
    return () => { disposed = true; window.clearInterval(interval); destroy(); };
  }, [episode.id, episode.m3u8Url, fallback]);

  if (fallback) {
    return <iframe src={episode.embedUrl} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" />;
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
