import { describe, expect, test } from 'vitest'
import {
  feltLikeLabel,
  feltLikeMoodIds,
  feltLikeTagsOf,
  feltLikeText,
  normaliseFeltLikeTag,
} from './feltLike'

describe('felt-like tags', () => {
  test('normalises preset labels and ids to stable mood ids', () => {
    expect(normaliseFeltLikeTag('温柔')).toBe('tender')
    expect(normaliseFeltLikeTag('Tender')).toBe('tender')
    expect(normaliseFeltLikeTag('wistful')).toBe('wistful')
  })

  test('keeps a user-written feeling and caps its length', () => {
    expect(normaliseFeltLikeTag('  像一场潮湿的雨  ')).toBe('像一场潮湿的雨')
    expect(normaliseFeltLikeTag('一二三四五六七八九十十一十二')).toHaveLength(12)
  })

  test('renders labels and extracts only known mood ids', () => {
    const tags = ['tender', '像一场潮湿的雨', 'wistful', 'tender']
    expect(feltLikeText(tags)).toBe('温柔、像一场潮湿的雨、怅惘、温柔')
    expect(feltLikeMoodIds(tags)).toEqual(['tender', 'wistful'])
    expect(feltLikeLabel('像一场潮湿的雨')).toBe('像一场潮湿的雨')
  })

  test('reads a legacy single feltLike without losing it', () => {
    expect(feltLikeTagsOf({ feltLike: 'tender' })).toEqual(['tender'])
    expect(feltLikeTagsOf({ feltLike: 'tender', feltLikeTags: ['tender', 'awe'] })).toEqual([
      'tender',
      'awe',
    ])
  })
})
