import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'solid' | 'line'

function classNames(variant: ButtonVariant, extra?: string): string {
  return [styles.btn, variant === 'line' ? styles.line : null, extra].filter(Boolean).join(' ')
}

/** A row of buttons. Wraps rather than shrinking below a tappable size. */
export function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.act, className].filter(Boolean).join(' ')}>{children}</div>
}

export type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & {
  href: string
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}

export function ButtonLink({ href, variant = 'solid', className, children, ...rest }: ButtonLinkProps) {
  return (
    <a href={href} className={classNames(variant, className)} {...rest}>
      {children}
    </a>
  )
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}

export function Button({ variant = 'solid', className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={classNames(variant, className)} {...rest}>
      {children}
    </button>
  )
}
