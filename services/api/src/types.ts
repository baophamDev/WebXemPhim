export type MovieType = 'single' | 'series' | string;

export interface Movie {
  id: number;
  vsmovId: number | null;
  slug: string;
  name: string;
  originName: string | null;
  description: string | null;
  type: MovieType;
  status: string | null;
  year: number | null;
  duration: string | null;
  quality: string | null;
  language: string | null;
  posterUrl: string | null;
  thumbUrl: string | null;
  trailerUrl: string | null;
  rating: number | null;
  viewCount: number;
  tmdbId: string | null;
  imdbId: string | null;
  genres: string[];
  countries: string[];
  actors: string[];
  directors: string[];
  episodes?: Episode[];
}

export interface Episode {
  id: number;
  movieId: number;
  serverName: string;
  name: string;
  episodeNumber: number | null;
  embedUrl: string;
  m3u8Url: string | null;
}
