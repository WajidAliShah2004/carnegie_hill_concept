'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Picture } from './Picture'
import { labels } from '@/labels'
import { NAV_ITEMS, ROUTES, type RouteKey } from '@/routes'
import type { ImageSources } from '@/content/image'
import styles from './Header.module.css'

export type HeaderProps = {
  logo: ImageSources
  /** Business name, used as the logo's alt text. A content field, not a label. */
  name: string
  phone: string
  phoneDisplay: string
  current?: RouteKey
}

export function Header({ logo, name, phone, phoneDisplay, current }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const nav = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`
  const active: RouteKey | undefined =
    current ??
    (Object.keys(ROUTES) as RouteKey[]).find((key) =>
      key === 'home' ? withSlash === '/' : withSlash.startsWith(ROUTES[key]),
    )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className={styles.site}>
      <div className={`wrap ${styles.inner}`}>
        <Link className={styles.brand} href={ROUTES.home} aria-label={labels.nav.home}>
          <Picture image={logo} alt={name} sizes="220px" eager />
        </Link>

        <a className={styles.telMobile} href={`tel:${phone}`}>
          {phoneDisplay}
        </a>

        <button
          ref={button}
          type="button"
          className={styles.menuBtn}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? labels.menu.close : labels.menu.open}
        </button>

        <nav
          ref={nav}
          id="site-nav"
          className={[styles.nav, open ? styles.navOpen : null].filter(Boolean).join(' ')}
          aria-label={labels.nav.label}
        >
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link href={item.href} {...(active === item.key ? { 'aria-current': 'page' as const } : {})}>
                  {labels.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <a className={styles.tel} href={`tel:${phone}`}>
          {phoneDisplay}
        </a>
      </div>
    </header>
  )
}
