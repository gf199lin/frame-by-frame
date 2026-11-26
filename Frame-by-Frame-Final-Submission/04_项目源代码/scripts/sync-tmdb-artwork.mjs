#!/usr/bin/env node
/**
 * Refresh verified film artwork from the TMDB API.
 *
 * Usage:
 *   TMDB_API_KEY=xxxxxxxx npm run artwork:sync
 *   TMDB_READ_TOKEN=eyJ... npm run artwork:sync
 *
 * The script never guesses a poster from a title. It requests each film by its
 * Wikidata-verified TMDB id, checks that the returned title still matches the
 * catalogue entry, and writes `src/data/filmArtwork.generated.json`. The app
 * prefers that file over the curated fallback registry, so artwork can be
 * refreshed without touching component code.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const FILMS_PATH = path.join(ROOT, 'src/data/films.ts')
const OUT_PATH = path.join(ROOT, 'src/data/filmArtwork.generated.json')

const API = 'https://api.themoviedb.org/3'
const IMAGE_LANGUAGES = 'en,null'

const apiKey = process.env.TMDB_API_KEY
const readToken = process.env.TMDB_READ_TOKEN

if (!apiKey && !readToken) {
  console.error(
    [
      'Missing TMDB credentials.',
      'Set TMDB_API_KEY (v3) or TMDB_READ_TOKEN (v4 bearer), then run:',
      '  npm run artwork:sync',
      '',
      'No artwork is guessed or invented when the key is absent.',
    ].join('\n'),
  )
  process.exit(1)
}

const headers = {
  accept: 'application/json',
  ...(readToken ? { authorization: `Bearer ${readToken}` } : {}),
}

const withKey = (url) => (apiKey ? `${url}${url.includes('?') ? '&' : '?'}api_key=${apiKey}` : url)

const request = async (url) => {
  const response = await fetch(withKey(url), { headers })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`TMDB ${response.status} ${url}\n${body.slice(0, 240)}`)
  }
  return response.json()
}

const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const readFilms = async () => {
  const source = await readFile(FILMS_PATH, 'utf8')
  const pattern = /id: '([^']+)',\s*\n\s*tmdbId: (\d+),\s*\n\s*title: '((?:[^'\\]|\\.)*)'/g
  const films = []
  for (const match of source.matchAll(pattern)) {
    films.push({
      id: match[1],
      tmdbId: Number(match[2]),
      title: match[3].replace(/\\'/g, "'"),
    })
  }
  return films
}

const sortImages = (images = []) =>
  [...images]
    .filter((image) => image.file_path)
    .sort((a, b) => {
      const language = (image.iso_639_1 === 'en' ? 2 : image.iso_639_1 === null ? 1 : 0)
      const other = (a.iso_639_1 === 'en' ? 2 : a.iso_639_1 === null ? 1 : 0)
      if (language !== other) return other - language
      return (b.vote_average ?? 0) - (a.vote_average ?? 0) || (b.vote_count ?? 0) - (a.vote_count ?? 0)
    })

const main = async () => {
  const films = await readFilms()
  if (films.length === 0) {
    throw new Error('No films with a tmdbId were found in src/data/films.ts')
  }

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'TMDB API',
      endpoint: `${API}/movie/{id}/images`,
      note: 'Every path is requested by TMDB id and title-checked before it is written.',
    },
  }
  const skipped = []

  for (const film of films) {
    const details = await request(`${API}/movie/${film.tmdbId}?language=en-US`)
    if (normalize(details.title || details.original_title || '') !== normalize(film.title)) {
      skipped.push(`${film.id} (#${film.tmdbId}): TMDB title "${details.title}" ≠ "${film.title}"`)
      console.warn(`skip ${film.id}: title mismatch`)
      continue
    }

    const images = await request(
      `${API}/movie/${film.tmdbId}/images?include_image_language=${IMAGE_LANGUAGES}`,
    )
    const posters = sortImages(images.posters)
    const backdrops = sortImages(images.backdrops)

    output[String(film.tmdbId)] = {
      tmdbId: film.tmdbId,
      filmId: film.id,
      title: details.title,
      verifiedAt: details.id === film.tmdbId ? new Date().toISOString().slice(0, 10) : undefined,
      poster_path: posters[0]?.file_path,
      backdrop_path: backdrops[0]?.file_path,
      stills: backdrops.slice(1, 7).map((image) => ({
        path: image.file_path,
        width: image.width,
        height: image.height,
        language: image.iso_639_1 ?? undefined,
      })),
    }
    console.log(
      `ok  ${film.id.padEnd(18)} #${String(film.tmdbId).padEnd(7)} poster=${
        posters[0]?.file_path ?? 'none'
      } backdrop=${backdrops[0]?.file_path ?? 'none'}`,
    )
  }

  await writeFile(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`\nWrote ${path.relative(ROOT, OUT_PATH)}`)
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} film(s) to avoid a wrong match:`)
    for (const line of skipped) console.log(`  - ${line}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
