import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Episode, Movie } from './types.js';

const dbFile = resolve(process.env.DB_FILE ?? './data/cinema.db');
mkdirSync(dirname(dbFile), { recursive: true });
export const db = new DatabaseSync(dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vsmov_id INTEGER UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    origin_name TEXT,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'single',
    status TEXT,
    year INTEGER,
    duration TEXT,
    quality TEXT,
    language TEXT,
    poster_url TEXT,
    thumb_url TEXT,
    trailer_url TEXT,
    rating REAL,
    view_count INTEGER NOT NULL DEFAULT 0,
    tmdb_id TEXT,
    imdb_id TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS movie_genres (movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE, name TEXT NOT NULL, UNIQUE(movie_id, name));
  CREATE TABLE IF NOT EXISTS movie_countries (movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE, name TEXT NOT NULL, UNIQUE(movie_id, name));
  CREATE TABLE IF NOT EXISTS movie_people (movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE, kind TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(movie_id, kind, name));
  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    server_name TEXT NOT NULL,
    name TEXT NOT NULL,
    episode_number INTEGER,
    embed_url TEXT NOT NULL,
    m3u8_url TEXT,
    UNIQUE(movie_id, server_name, name)
  );
  CREATE TABLE IF NOT EXISTS watch_progress (
    device_id TEXT NOT NULL,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    position_seconds REAL NOT NULL DEFAULT 0,
    duration_seconds REAL NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(device_id, episode_id)
  );
  CREATE TABLE IF NOT EXISTS favorites (device_id TEXT NOT NULL, movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(device_id, movie_id));
  CREATE TABLE IF NOT EXISTS sync_state (id INTEGER PRIMARY KEY CHECK(id = 1), status TEXT NOT NULL DEFAULT 'idle', page INTEGER NOT NULL DEFAULT 0, total_pages INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0, error TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  INSERT OR IGNORE INTO sync_state(id) VALUES (1);
`);

const scalar = (value: unknown) => value == null ? null : String(value);
const list = (value: unknown): string[] => Array.isArray(value) ? value.map((x) => typeof x === 'string' ? x : String((x as { name?: unknown })?.name ?? '')).filter(Boolean) : [];

export function upsertMovie(input: any): number {
  const movie = input.movie ?? input;
  const tmdb = movie.tmdb ?? {};
  const imdb = movie.imdb ?? {};
  const stmt = db.prepare(`INSERT INTO movies(vsmov_id,slug,name,origin_name,description,type,status,year,duration,quality,language,poster_url,thumb_url,trailer_url,rating,view_count,tmdb_id,imdb_id,raw_json,updated_at)
    VALUES(@vsmovId,@slug,@name,@originName,@description,@type,@status,@year,@duration,@quality,@language,@posterUrl,@thumbUrl,@trailerUrl,@rating,@viewCount,@tmdbId,@imdbId,@rawJson,CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET vsmov_id=excluded.vsmov_id,name=excluded.name,origin_name=excluded.origin_name,description=excluded.description,type=excluded.type,status=excluded.status,year=excluded.year,duration=excluded.duration,quality=excluded.quality,language=excluded.language,poster_url=excluded.poster_url,thumb_url=excluded.thumb_url,trailer_url=excluded.trailer_url,rating=excluded.rating,view_count=excluded.view_count,tmdb_id=excluded.tmdb_id,imdb_id=excluded.imdb_id,raw_json=excluded.raw_json,updated_at=CURRENT_TIMESTAMP`);
  stmt.run({ vsmovId: movie._id ?? null, slug: movie.slug, name: movie.name ?? movie.origin_name ?? movie.slug, originName: movie.origin_name ?? null, description: movie.content ?? null, type: movie.type ?? 'single', status: movie.status ?? null, year: movie.year ?? null, duration: movie.time ?? null, quality: movie.quality ?? null, language: movie.lang ?? null, posterUrl: typeof movie.poster_url === 'string' ? movie.poster_url : null, thumbUrl: typeof movie.thumb_url === 'string' ? movie.thumb_url : null, trailerUrl: movie.trailer_url ?? null, rating: Number(tmdb.vote_average ?? 0) || null, viewCount: movie.view ?? 0, tmdbId: scalar(tmdb.id), imdbId: scalar(imdb.id), rawJson: JSON.stringify(movie) });
  const row = db.prepare('SELECT id FROM movies WHERE slug=?').get(movie.slug) as { id: number };
  db.prepare('DELETE FROM movie_genres WHERE movie_id=?').run(row.id);
  db.prepare('DELETE FROM movie_countries WHERE movie_id=?').run(row.id);
  db.prepare('DELETE FROM movie_people WHERE movie_id=?').run(row.id);
  for (const name of list(movie.category)) db.prepare('INSERT OR IGNORE INTO movie_genres(movie_id,name) VALUES(?,?)').run(row.id, name);
  for (const name of list(movie.country)) db.prepare('INSERT OR IGNORE INTO movie_countries(movie_id,name) VALUES(?,?)').run(row.id, name);
  for (const name of list(movie.actor)) db.prepare('INSERT OR IGNORE INTO movie_people(movie_id,kind,name) VALUES(?,?,?)').run(row.id, 'actor', name);
  for (const name of list(movie.director)) db.prepare('INSERT OR IGNORE INTO movie_people(movie_id,kind,name) VALUES(?,?,?)').run(row.id, 'director', name);
  return row.id;
}

export function upsertEpisodes(movieId: number, groups: any[] = []) {
  db.prepare('DELETE FROM episodes WHERE movie_id=?').run(movieId);
  for (const group of groups) for (const ep of group.server_data ?? []) {
    const number = Number.parseInt(String(ep.name ?? '').replace(/\D/g, ''), 10);
    db.prepare('INSERT OR IGNORE INTO episodes(movie_id,server_name,name,episode_number,embed_url,m3u8_url) VALUES(?,?,?,?,?,?)').run(movieId, group.server_name ?? 'Default', ep.name ?? ep.filename ?? 'Full', Number.isFinite(number) ? number : null, ep.link_embed, ep.link_m3u8 ?? null);
  }
}

function enrich(row: any): Movie {
  const genres = db.prepare('SELECT name FROM movie_genres WHERE movie_id=?').all(row.id).map((x: any) => x.name);
  const countries = db.prepare('SELECT name FROM movie_countries WHERE movie_id=?').all(row.id).map((x: any) => x.name);
  const actors = db.prepare("SELECT name FROM movie_people WHERE movie_id=? AND kind='actor'").all(row.id).map((x: any) => x.name);
  const directors = db.prepare("SELECT name FROM movie_people WHERE movie_id=? AND kind='director'").all(row.id).map((x: any) => x.name);
  return { id: row.id, vsmovId: row.vsmov_id, slug: row.slug, name: row.name, originName: row.origin_name, description: row.description, type: row.type, status: row.status, year: row.year, duration: row.duration, quality: row.quality, language: row.language, posterUrl: row.poster_url, thumbUrl: row.thumb_url, trailerUrl: row.trailer_url, rating: row.rating, viewCount: row.view_count, tmdbId: row.tmdb_id, imdbId: row.imdb_id, genres, countries, actors, directors };
}

export function getMovie(idOrSlug: string, withEpisodes = false): Movie | null {
  const row = db.prepare('SELECT * FROM movies WHERE slug=? OR CAST(id AS TEXT)=?').get(idOrSlug, idOrSlug);
  if (!row) return null;
  const movie = enrich(row);
  if (withEpisodes) movie.episodes = db.prepare('SELECT id,movie_id as movieId,server_name as serverName,name,episode_number as episodeNumber,embed_url as embedUrl,m3u8_url as m3u8Url FROM episodes WHERE movie_id=? ORDER BY server_name,COALESCE(episode_number,9999),id').all((row as any).id) as unknown as Episode[];
  return movie;
}

export function listMovies(params: { q?: string; genre?: string; page: number; limit: number; sort?: string; deviceId?: string }) {
  const where: string[] = []; const args: any[] = [];
  if (params.q) { where.push('(m.name LIKE ? OR m.origin_name LIKE ?)'); args.push(`%${params.q}%`, `%${params.q}%`); }
  if (params.genre) { where.push('EXISTS (SELECT 1 FROM movie_genres mg WHERE mg.movie_id=m.id AND mg.name=?)'); args.push(params.genre); }
  const order = params.sort === 'rating' ? 'm.rating DESC, m.updated_at DESC' : 'm.updated_at DESC';
  const count = (db.prepare(`SELECT COUNT(*) as count FROM movies m WHERE ${where.length ? where.join(' AND ') : '1=1'}`).get(...args) as any).count as number;
  const rows = db.prepare(`SELECT m.* FROM movies m WHERE ${where.length ? where.join(' AND ') : '1=1'} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, params.limit, (params.page - 1) * params.limit);
  return { items: rows.map(enrich), pagination: { totalItems: count, totalPages: Math.ceil(count / params.limit), currentPage: params.page, totalItemsPerPage: params.limit } };
}

export function getEpisodes(episodeId: number) { return db.prepare('SELECT id,movie_id as movieId,server_name as serverName,name,episode_number as episodeNumber,embed_url as embedUrl,m3u8_url as m3u8Url FROM episodes WHERE id=?').get(episodeId) as Episode | undefined; }
export function saveProgress(deviceId: string, episodeId: number, position: number, duration: number, completed: boolean) { const ep = getEpisodes(episodeId); if (!ep) return false; db.prepare(`INSERT INTO watch_progress(device_id,movie_id,episode_id,position_seconds,duration_seconds,completed,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(device_id,episode_id) DO UPDATE SET position_seconds=excluded.position_seconds,duration_seconds=excluded.duration_seconds,completed=excluded.completed,updated_at=CURRENT_TIMESTAMP`).run(deviceId, ep.movieId, episodeId, position, duration, completed ? 1 : 0); return true; }
export function getContinue(deviceId: string) { const rows = db.prepare(`SELECT wp.*,m.slug,m.name,m.thumb_url as thumbUrl,e.name as episodeName FROM watch_progress wp JOIN movies m ON m.id=wp.movie_id JOIN episodes e ON e.id=wp.episode_id WHERE wp.device_id=? AND wp.completed=0 ORDER BY wp.updated_at DESC LIMIT 12`).all(deviceId); return rows; }
export function toggleFavorite(deviceId: string, movieId: number, enabled: boolean) { if (enabled) db.prepare('INSERT OR IGNORE INTO favorites(device_id,movie_id) VALUES(?,?)').run(deviceId,movieId); else db.prepare('DELETE FROM favorites WHERE device_id=? AND movie_id=?').run(deviceId,movieId); }
export function isFavorite(deviceId: string, movieId: number) { return Boolean(db.prepare('SELECT 1 FROM favorites WHERE device_id=? AND movie_id=?').get(deviceId,movieId)); }
export function listFavorites(deviceId: string) { const rows = db.prepare('SELECT m.* FROM favorites f JOIN movies m ON m.id=f.movie_id WHERE f.device_id=? ORDER BY f.created_at DESC').all(deviceId); return rows.map(enrich); }
export function listActors() { const rows = db.prepare("SELECT MIN(rowid) as id,name FROM movie_people WHERE kind='actor' GROUP BY name ORDER BY name COLLATE NOCASE").all() as Array<{ id: number; name: string }>; return { items: rows.map((row) => ({ id: row.id, name: row.name, slug: row.name, thumbUrl: null })) }; }
export function getSyncState() { return db.prepare('SELECT status,page,total_pages as totalPages,processed,error,updated_at as updatedAt FROM sync_state WHERE id=1').get(); }
export function setSyncState(values: Record<string, any>) { const fields = Object.keys(values).map(k => `${k}=@${k}`).join(','); db.prepare(`UPDATE sync_state SET ${fields},updated_at=CURRENT_TIMESTAMP WHERE id=1`).run(values); }
