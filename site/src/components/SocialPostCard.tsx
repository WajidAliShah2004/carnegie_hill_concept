'use client'

import { useState } from 'react'
import { labels } from '@/labels'
import type { SocialPost } from '@/content/types'
import styles from './SocialPostCard.module.css'

export type SocialPostCardProps = { post: SocialPost; className?: string }

/** Only these platforms have an embed we can build a URL for by hand. */
function embedUrl(post: SocialPost): string | null {
  try {
    const url = new URL(post.url)
    if (post.platform === 'instagram') {
      return `https://www.instagram.com${url.pathname.replace(/\/$/, '')}/embed/`
    }
    if (post.platform === 'youtube') {
      const id = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v')
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    return null
  } catch {
    return null
  }
}

/**
 * A facade. The card is plain HTML and loads no third-party script on page
 * load. Tapping the load button swaps in an iframe. When no embed exists, or
 * the embed fails, the card stays a plain link to the post.
 */
export function SocialPostCard({ post, className }: SocialPostCardProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const embed = embedUrl(post)
  const canEmbed = embed !== null && !failed

  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')}>
      <p className={styles.platform}>{labels.platforms[post.platform]}</p>
      {post.caption ? <p className={styles.caption}>{post.caption}</p> : null}

      {loaded && canEmbed ? (
        <iframe
          className={styles.embed}
          src={embed}
          title={post.caption ?? labels.actions.viewPost}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(true)}
        />
      ) : null}

      <div className={styles.actions}>
        {canEmbed && !loaded ? (
          <button type="button" className={styles.load} onClick={() => setLoaded(true)}>
            {labels.actions.loadPost}
          </button>
        ) : null}
        <a className={styles.link} href={post.url} rel="noopener nofollow">
          {labels.actions.viewPost}
        </a>
      </div>
    </div>
  )
}
