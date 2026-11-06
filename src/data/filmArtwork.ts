import type { FilmArtwork, FilmImage } from '@/types'

/**
 * Verified film artwork registry.
 *
 * Every image here is a real, traceable asset. TMDB file paths are preferred
 * (served from image.tmdb.org, the official CDN); a verified local copy of the
 * official release poster is used only where a TMDB path is no longer live.
 *
 * Matching is established by the film's Wikidata-verified TMDB id, never by
 * guessing a filename from the movie title. `evidenceUrl` points at the
 * archived TMDB movie page the paths were harvested from, so any path can be
 * audited later. Where the archived TMDB file is no longer served, a
 * self-hosted copy of the official poster/still is used, fetched from the
 * film's Letterboxd page (which sources its posters from TMDB) and linked back
 * to that page in `sourceUrl`.
 *
 * No generated or random imagery belongs in this file.
 */

const TMDB_MOVIE = 'https://www.themoviedb.org/movie/'
const TMDB_CREDIT = 'TMDB · official release artwork'
const LETTERBOXD_CREDIT = 'Official release artwork · Letterboxd (TMDB poster source)'
const RIGHTS_NOTE =
  'Artwork © the film’s rights holders. Displayed for identification only.'

const VERIFIED_AT = '2026-11-06'

const tmdbPoster = (path: string, tmdbId: number): FilmImage => ({
  provider: 'tmdb',
  path,
  width: 500,
  height: 750,
  sourceUrl: `${TMDB_MOVIE}${tmdbId}`,
  credit: TMDB_CREDIT,
})

const tmdbBackdrop = (path: string, tmdbId: number): FilmImage => ({
  provider: 'tmdb',
  path,
  width: 1280,
  height: 720,
  sourceUrl: `${TMDB_MOVIE}${tmdbId}`,
  credit: TMDB_CREDIT,
})

const localArtwork = (
  file: string,
  width: number,
  height: number,
  sourceUrl: string,
): FilmImage => ({
  provider: 'local',
  url: `/images/artwork/${file}`,
  width,
  height,
  sourceUrl,
  credit: LETTERBOXD_CREDIT,
  license: RIGHTS_NOTE,
})

const letterboxd = (slug: string) => `https://letterboxd.com/film/${slug}/`

export const FILM_ARTWORK: Record<string, FilmArtwork> = {
  manchester: {
    tmdbId: 334541,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20210620084308id_/https://www.themoviedb.org/movie/334541-manchester-by-the-sea',
    poster: tmdbPoster('/e8daDzP0vFOnGyKmve95Yv0D0io.jpg', 334541),
    backdrop: tmdbBackdrop('/8ybSuxeEkFoMKMY9lkzzC4tBaI6.jpg', 334541),
  },
  'eternal-sunshine': {
    tmdbId: 38,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/2024id_/https://www.themoviedb.org/movie/38-eternal-sunshine-of-the-spotless-mind',
    poster: tmdbPoster('/5MwkWH9tYHv3mV9OdYTMR5qreIz.jpg', 38),
    backdrop: tmdbBackdrop('/jzZcW65MZQfAgvbEoX8EWCvlxpk.jpg', 38),
  },
  'la-la-land': {
    tmdbId: 313369,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20211120185148id_/https://www.themoviedb.org/movie/313369-la-la-land',
    poster: tmdbPoster('/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', 313369),
    backdrop: tmdbBackdrop('/nyuzfjAbuSel6dVKY4zFo95ugUf.jpg', 313369),
  },
  'truman-show': {
    tmdbId: 37165,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20140910213840im_/http://www.themoviedb.org/movie/37165',
    poster: localArtwork('truman-show.jpg', 1000, 1500, letterboxd('the-truman-show')),
    backdrop: localArtwork(
      'truman-show-backdrop.jpg',
      1920,
      1080,
      letterboxd('the-truman-show'),
    ),
  },
  'grand-budapest': {
    tmdbId: 120467,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/2024id_/https://www.themoviedb.org/movie/120467-the-grand-budapest-hotel',
    poster: tmdbPoster('/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', 120467),
    backdrop: tmdbBackdrop('/jK65srQczOKTpW62wPxwwKztGgE.jpg', 120467),
  },
  'good-will-hunting': {
    tmdbId: 489,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl: 'https://web.archive.org/web/20141108211408im_/https://www.themoviedb.org/movie/489',
    poster: localArtwork(
      'good-will-hunting.jpg',
      1000,
      1500,
      letterboxd('good-will-hunting'),
    ),
    backdrop: localArtwork(
      'good-will-hunting-backdrop.jpg',
      1200,
      675,
      letterboxd('good-will-hunting'),
    ),
  },
  interstellar: {
    tmdbId: 157336,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl: 'https://web.archive.org/web/20141110191047im_/https://www.themoviedb.org/movie/157336',
    poster: localArtwork('interstellar.jpg', 751, 1124, letterboxd('interstellar')),
    backdrop: localArtwork(
      'interstellar-backdrop.jpg',
      1200,
      675,
      letterboxd('interstellar'),
    ),
  },
  shawshank: {
    tmdbId: 278,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl: 'https://web.archive.org/web/20141019103138im_/https://www.themoviedb.org/movie/278',
    poster: localArtwork(
      'shawshank.jpg',
      1000,
      1500,
      letterboxd('the-shawshank-redemption'),
    ),
    backdrop: localArtwork(
      'shawshank-backdrop.jpg',
      1920,
      1080,
      letterboxd('the-shawshank-redemption'),
    ),
  },
  'inside-out': {
    tmdbId: 150540,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20240607100652id_/https://www.themoviedb.org/movie/150540-inside-out',
    poster: tmdbPoster('/2H1TmgdfNtsKlU9jKdeNyYL5y8T.jpg', 150540),
    backdrop: tmdbBackdrop('/j29ekbcLpBvxnGk6LjdTc2EI5SA.jpg', 150540),
  },
  'dead-poets': {
    tmdbId: 207,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl: 'https://web.archive.org/web/20140909072209im_/http://www.themoviedb.org/movie/207',
    poster: localArtwork('dead-poets.jpg', 1000, 1500, letterboxd('dead-poets-society')),
    backdrop: localArtwork(
      'dead-poets-backdrop.jpg',
      1200,
      675,
      letterboxd('dead-poets-society'),
    ),
  },
  moonlight: {
    tmdbId: 376867,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20200914212915id_/https://www.themoviedb.org/movie/376867-moonlight',
    poster: tmdbPoster('/93NN95a71MsQ4tR2zSLv8BNK2qh.jpg', 376867),
    backdrop: tmdbBackdrop('/A9KPbYTQvWsp51Lgz85ukVkFrKf.jpg', 376867),
  },
  arrival: {
    tmdbId: 329865,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20200923001649id_/https://www.themoviedb.org/movie/329865-arrival',
    poster: tmdbPoster('/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', 329865),
    backdrop: tmdbBackdrop('/hNCqkXbWd40eftqSdjq8TmV7Mqr.jpg', 329865),
  },
  her: {
    tmdbId: 152601,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl: 'https://web.archive.org/web/20141029102519im_/https://www.themoviedb.org/movie/152601',
    poster: localArtwork('her.jpg', 1000, 1500, letterboxd('her')),
    backdrop: localArtwork('her-backdrop.jpg', 1920, 1080, letterboxd('her')),
  },
  whiplash: {
    tmdbId: 244786,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl: 'https://web.archive.org/web/20141116032709im_/https://www.themoviedb.org/movie/244786',
    poster: localArtwork('whiplash.jpg', 1000, 1500, letterboxd('whiplash-2014')),
    backdrop: localArtwork(
      'whiplash-backdrop.jpg',
      1200,
      675,
      letterboxd('whiplash-2014'),
    ),
  },
  'past-lives': {
    tmdbId: 666277,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20231202014435id_/https://www.themoviedb.org/movie/666277-past-lives',
    poster: tmdbPoster('/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', 666277),
    backdrop: tmdbBackdrop('/rron9HAuS9s7zBF8iCX1tsafxUo.jpg', 666277),
  },
  portrait: {
    tmdbId: 531428,
    verifiedAt: VERIFIED_AT,
    matchSource: 'wikidata-tmdb-id',
    evidenceUrl:
      'https://web.archive.org/web/20210417064025id_/https://www.themoviedb.org/movie/531428-portrait-de-la-jeune-fille-en-feu',
    poster: tmdbPoster('/2LquGwEhbg3soxSCs9VNyh5VJd9.jpg', 531428),
    backdrop: tmdbBackdrop('/foFq1RZWQIgFuCQ0nyYccywjFyX.jpg', 531428),
  },
}

/** TMDB requires this notice wherever its artwork/data appears. */
export const TMDB_NOTICE =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.'
