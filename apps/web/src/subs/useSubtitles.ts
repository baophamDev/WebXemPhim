/**
 * Toàn bộ trạng thái phụ đề của một tập, gom vào một hook.
 *
 * Vì sao là hook chứ không phải state rải trong `Watch.tsx`: ba thứ dưới đây phải luôn
 * khớp nhau nhưng lại ở ba tầng khác nhau — danh sách track (IndexedDB), track đang bật
 * (localStorage) và blob URL đang gắn vào `<video>` (RAM, phải thu hồi tay). Rải chúng
 * ra trang xem thì mỗi lần đổi tập là một cơ hội quên mất một trong ba.
 *
 * Hook không chạm DOM của player: nó chỉ trả về `{url,label,lang}` để `VideoPlayer` tự
 * dựng `<track>`. Nhờ vậy chỗ gắn phụ đề vẫn nằm trong JSX, không phải một effect đi
 * tạo thẻ — và trên player gốc của iOS/webOS thì `<track>` là đường duy nhất chạy được.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFetchSubtitleMutation, useFetchSubtitleUrlMutation } from '../api';
import type { Episode, SubtitleHit } from '../types';
import { base64ToBytes, prepareSubtitle, shiftVtt, type PreparedSubtitle } from './convert';
import {
  addTrack, deleteTrack, isPersistent, listTracks, readActiveTrack, readCueSize,
  updateTrack, writeActiveTrack, writeCueSize,
  type CueSize, type StoredTrack, type TrackSource
} from './store';

/** Lỗi từ RTK Query có vài hình dạng; người xem chỉ cần đúng một câu. */
export function explain(error: unknown): string {
  const box = error as { data?: { error?: string; message?: string }; error?: string; status?: number | string } | null;
  return box?.data?.error ?? box?.data?.message ?? box?.error
    ?? (box?.status ? `lỗi ${box.status}` : 'không rõ nguyên nhân');
}

/** Offset chỉ cần tới phần trăm giây — số lẻ dài hơn chỉ làm nút hiện ra chữ rác. */
const round = (seconds: number) => Math.round(seconds * 100) / 100;

/** Nguồn nào trả sub về; `provider` là chuỗi tự do nên phải kẹp lại. */
const asSource = (provider: string): TrackSource => (provider === 'subdl' ? 'subdl' : 'opensubtitles');

/**
 * Một câu tổng kết cho cả lượt gắn nhiều file. Phải nói ra cả phần *không* gắn được:
 * chọn 24 file rồi chỉ thấy 20 cái xuất hiện mà không có lời nào là bug, không phải
 * tính năng.
 */
function report(here: number, elsewhere: number, skipped: string[]): string | null {
  const parts: string[] = [];
  if (here) parts.push(`đã gắn ${here} phụ đề vào tập này`);
  if (elsewhere) parts.push(`${elsewhere} phụ đề thuộc tập khác (mở tập đó là thấy)`);
  if (skipped.length) parts.push(`bỏ qua ${skipped.join(', ')}`);
  if (!parts.length) return null;
  const text = parts.join('; ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

export interface ActiveCue { url: string; label: string; lang: string }

export interface Subtitles {
  tracks: StoredTrack[];
  active: StoredTrack | null;
  activeId: string;
  /** Bản đã dịch theo offset, đóng thành blob — đưa thẳng vào `<track src>`. */
  cue: ActiveCue | null;
  size: CueSize;
  /** `false` nghĩa là đóng tab là mất sub; UI phải nói trước, không để tự phát hiện. */
  persistent: boolean;
  busy: boolean;
  notice: string | null;
  clearNotice(): void;
  select(id: string): void;
  addFiles(files: FileList | File[]): Promise<void>;
  addHit(hit: SubtitleHit): Promise<void>;
  addUrl(url: string): Promise<void>;
  nudge(seconds: number): void;
  resetOffset(): void;
  setSize(size: CueSize): void;
  remove(id: string): Promise<void>;
}

export function useSubtitles({ movieSlug, episode, episodes }: {
  movieSlug: string; episode: Episode; episodes: Episode[];
}): Subtitles {
  const [tracks, setTracks] = useState<StoredTrack[]>([]);
  const [activeId, setActiveId] = useState('');
  const [size, setSizeState] = useState<CueSize>(readCueSize);
  const [persistent, setPersistent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fetchSubtitle] = useFetchSubtitleMutation();
  const [fetchSubtitleUrl] = useFetchSubtitleUrlMutation();

  /**
   * Đọc lại danh sách của tập đang xem. Lựa chọn cũ đọc từ localStorage **trước** khi
   * IndexedDB trả lời — đồng bộ nên không có nhịp nào phụ đề bị tắt rồi bật lại — rồi
   * đối chiếu lại sau, vì tab khác có thể đã xoá đúng track đó.
   */
  const refresh = useCallback(async (episodeId: number, prefer?: string) => {
    const list = await listTracks(episodeId);
    setPersistent(isPersistent());
    setTracks(list);
    setActiveId((current) => {
      const wanted = prefer ?? current;
      const keep = list.some((track) => track.id === wanted) ? wanted : '';
      if (keep !== current) writeActiveTrack(episodeId, keep);
      return keep;
    });
  }, []);

  useEffect(() => {
    // Đổi tập là đổi hẳn tập dữ liệu: xoá ngay để không có nhịp nào sub của tập trước
    // còn dính trên tập sau.
    setTracks([]);
    setNotice(null);
    setActiveId(readActiveTrack(episode.id));
    void refresh(episode.id);
  }, [episode.id, refresh]);

  const active = useMemo(() => tracks.find((track) => track.id === activeId) ?? null, [tracks, activeId]);
  const activeRef = useRef<StoredTrack | null>(null);
  useEffect(() => { activeRef.current = active; }, [active]);

  /**
   * Offset không sửa được bằng thuộc tính nào của `<track>` — cách duy nhất chạy trên
   * cả hls.js và player gốc là dựng lại file VTT với mốc thời gian đã dịch.
   */
  const vtt = useMemo(() => (active ? shiftVtt(active.vtt, active.offset) : ''), [active?.id, active?.vtt, active?.offset]);
  const [url, setUrl] = useState('');
  const live = useRef('');
  useEffect(() => {
    const next = vtt ? URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })) : '';
    // Thu hồi bản trước **sau khi** đã có bản mới, chứ không thu hồi trong cleanup:
    // revoke trong cleanup để lại một nhịp `<track>` trỏ vào URL đã chết, và Safari
    // lúc đó bỏ luôn phụ đề thay vì tải lại.
    if (live.current) URL.revokeObjectURL(live.current);
    live.current = next;
    setUrl(next);
  }, [vtt]);
  useEffect(() => () => { if (live.current) URL.revokeObjectURL(live.current); }, []);

  const cue = useMemo<ActiveCue | null>(
    () => (url && active ? { url, label: active.label, lang: active.lang } : null),
    [url, active]
  );

  /**
   * Ghi offset xuống IndexedDB thì hoãn lại: kéo sub là bấm liên tiếp, mỗi cú bấm một
   * transaction là phí, mà chờ ghi xong mới đổi hình thì nút có cảm giác lag. State
   * đổi ngay, ổ đĩa theo sau.
   */
  const timer = useRef<number | undefined>(undefined);
  const waiting = useRef<{ id: string; offset: number } | null>(null);
  const flush = useCallback(async () => {
    const pending = waiting.current;
    if (!pending) return;
    window.clearTimeout(timer.current);
    waiting.current = null;
    await updateTrack(pending.id, { offset: pending.offset });
  }, []);
  // Đổi tập hay thoát trang ngay sau khi kéo offset: hẹn giờ chưa kịp chạy, ghi luôn.
  useEffect(() => () => { void flush(); }, [flush]);

  const applyOffset = useCallback((seconds: number) => {
    const current = activeRef.current;
    if (!current) return;
    const offset = round(seconds);
    if (offset === current.offset) return;
    setTracks((list) => list.map((track) => (track.id === current.id ? { ...track, offset } : track)));
    waiting.current = { id: current.id, offset };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 600);
  }, [flush]);
  const nudge = useCallback((seconds: number) => applyOffset((activeRef.current?.offset ?? 0) + seconds), [applyOffset]);
  const resetOffset = useCallback(() => applyOffset(0), [applyOffset]);

  const select = useCallback((id: string) => {
    setActiveId(id);
    writeActiveTrack(episode.id, id);
  }, [episode.id]);
  const setSize = useCallback((next: CueSize) => { setSizeState(next); writeCueSize(next); }, []);
  const clearNotice = useCallback(() => setNotice(null), []);
  const remove = useCallback(async (id: string) => {
    await flush();
    await deleteTrack(id);
    setPersistent(isPersistent());
    await refresh(episode.id);
  }, [episode.id, flush, refresh]);

  /** Tên file nói tập nào thì gắn vào tập đó; `null` là không đoán được. */
  const matchEpisode = useCallback((hint: number | null) => {
    if (hint === null) return null;
    // Cùng một số tập thường có ở nhiều server; ưu tiên server đang xem để sub không
    // rơi vào một bản khác của đúng tập đó.
    return episodes.find((item) => item.episodeNumber === hint && item.serverName === episode.serverName)
      ?? episodes.find((item) => item.episodeNumber === hint)
      ?? null;
  }, [episodes, episode.serverName]);

  /** Một chỗ duy nhất ghi track xuống ổ đĩa, nên mọi đường vào đều lưu cùng một hình dạng. */
  const keep = useCallback(async (prepared: PreparedSubtitle, episodeId: number, source: TrackSource, over?: { lang?: string; label?: string }) => {
    const saved = await addTrack({
      episodeId, movieSlug, source,
      label: over?.label || prepared.label, lang: over?.lang || prepared.lang,
      format: prepared.format, vtt: prepared.vtt, encoding: prepared.encoding, cues: prepared.cues
    });
    setPersistent(isPersistent());
    return saved;
  }, [movieSlug]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    setNotice(null);
    try {
      await flush();
      const skipped: string[] = [];
      let here = 0;
      let elsewhere = 0;
      let last = '';
      for (const file of list) {
        const prepared = prepareSubtitle(await file.arrayBuffer(), file.name);
        if (!prepared.cues) { skipped.push(`${file.name} (không có câu nào đọc được)`); continue; }
        // Một file là một hành động rõ ràng: gắn vào tập đang xem, kể cả khi tên file
        // ghi số tập khác. Nhiều file thì không thể cùng thuộc một tập, lúc đó mới
        // phải khớp theo tên — và file nào không khớp được thì nói ra, không im lặng
        // đổ hết lên tập này.
        const target = list.length === 1 ? episode : matchEpisode(prepared.episode);
        if (!target) { skipped.push(`${file.name} (không rõ thuộc tập nào)`); continue; }
        const saved = await keep(prepared, target.id, 'file');
        if (target.id === episode.id) { here += 1; last = saved.id; } else elsewhere += 1;
      }
      await refresh(episode.id, last || undefined);
      setNotice(report(here, elsewhere, skipped));
    } catch (error) {
      setNotice(`Không đọc được phụ đề: ${explain(error)}`);
    } finally {
      setBusy(false);
    }
  }, [episode, matchEpisode, flush, keep, refresh]);

  const addHit = useCallback(async (hit: SubtitleHit) => {
    setBusy(true);
    setNotice(null);
    try {
      await flush();
      const file = await fetchSubtitle({ provider: hit.provider, id: hit.id }).unwrap();
      const prepared = prepareSubtitle(base64ToBytes(file.base64), file.filename);
      if (!prepared.cues) { setNotice('Bản này tải về không có câu nào — thử bản khác.'); return; }
      // Nguồn *biết* sub của nó là tiếng gì, tên file thì chỉ đoán được — tin nguồn.
      const saved = await keep(prepared, episode.id, asSource(hit.provider), { lang: hit.lang, label: hit.langLabel });
      await refresh(episode.id, saved.id);
      setNotice(`Đã gắn "${saved.label}" · ${saved.cues} câu.`);
    } catch (error) {
      setNotice(`Không tải được phụ đề: ${explain(error)}`);
    } finally {
      setBusy(false);
    }
  }, [episode.id, fetchSubtitle, flush, keep, refresh]);

  const addUrl = useCallback(async (link: string) => {
    const target = link.trim();
    if (!target) return;
    setBusy(true);
    setNotice(null);
    try {
      await flush();
      const file = await fetchSubtitleUrl({ url: target }).unwrap();
      const prepared = prepareSubtitle(base64ToBytes(file.base64), file.filename);
      if (!prepared.cues) { setNotice('Link này không dẫn tới file phụ đề đọc được.'); return; }
      const saved = await keep(prepared, episode.id, 'url');
      await refresh(episode.id, saved.id);
      setNotice(`Đã gắn "${saved.label}" · ${saved.cues} câu.`);
    } catch (error) {
      setNotice(`Không tải được từ link: ${explain(error)}`);
    } finally {
      setBusy(false);
    }
  }, [episode.id, fetchSubtitleUrl, flush, keep, refresh]);

  return {
    tracks, active, activeId, cue, size, persistent, busy, notice,
    clearNotice, select, addFiles, addHit, addUrl, nudge, resetOffset, setSize, remove
  };
}
