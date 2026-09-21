'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { labels } from '@/labels'
import styles from './ContactForm.module.css'

export type ContactFormProps = {
  /** Dialling form, for the tel: link offered whenever sending fails. */
  phone: string
  phoneDisplay: string
  /** The project type options, taken from the published service names. */
  projectTypes: readonly string[]
}

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit'
const HCAPTCHA_SCRIPT = 'https://js.hcaptcha.com/1/api.js'

const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? ''
const captchaKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY ?? ''

type State = 'idle' | 'invalid' | 'submitting' | 'sent' | 'failed' | 'rateLimited'
type Field = 'name' | 'contact' | 'details'
type Errors = Partial<Record<Field, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The one form on the site. It posts straight from the browser to Web3Forms,
 * because there is no server. A honeypot and hCaptcha carry the spam load,
 * and the hCaptcha script is fetched only once someone reaches or focuses the
 * form, so no third party runs on page load.
 *
 * Every message here is a label. Nothing the form says is a claim about the
 * shop, and the success message says the request was sent, which is all we
 * can know.
 */
export function ContactForm({ phone, phoneDisplay, projectTypes }: ContactFormProps) {
  const [state, setState] = useState<State>('idle')
  const [errors, setErrors] = useState<Errors>({})
  const form = useRef<HTMLFormElement>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const emailField = useRef<HTMLInputElement>(null)
  const detailsField = useRef<HTMLTextAreaElement>(null)
  const captchaLoaded = useRef(false)

  const loadCaptcha = useCallback(() => {
    if (captchaKey === '' || captchaLoaded.current) return
    captchaLoaded.current = true
    const script = document.createElement('script')
    script.src = HCAPTCHA_SCRIPT
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    const node = form.current
    if (!node || captchaKey === '') return
    node.addEventListener('focusin', loadCaptcha, { once: true })
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadCaptcha()
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(node)
    return () => {
      node.removeEventListener('focusin', loadCaptcha)
      observer.disconnect()
    }
  }, [loadCaptcha])

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const node = event.currentTarget
      const data = new FormData(node)
      const value = (key: string) => String(data.get(key) ?? '').trim()

      const name = value('name')
      const email = value('email')
      const tel = value('phone')
      const details = value('details')

      const found: Errors = {}
      if (name === '') found.name = labels.formStates.needName
      if (email === '' && tel === '') found.contact = labels.formStates.needContact
      else if (email !== '' && !EMAIL.test(email)) found.contact = labels.formStates.invalidEmail
      if (details === '') found.details = labels.formStates.needDetails

      if (Object.keys(found).length > 0) {
        setErrors(found)
        setState('invalid')
        if (found.name) nameField.current?.focus()
        else if (found.contact) emailField.current?.focus()
        else detailsField.current?.focus()
        return
      }

      setErrors({})
      setState('submitting')

      const captcha = node.elements.namedItem('h-captcha-response')
      const captchaValue = captcha instanceof HTMLInputElement ? captcha.value : ''

      const payload: Record<string, string> = {
        access_key: accessKey,
        botcheck: value('botcheck'),
        [labels.form.name]: name,
        [labels.form.email]: email,
        [labels.form.phone]: tel,
        [labels.form.preferredReply]: value('reply'),
        [labels.form.projectDetails]: details,
        [labels.form.projectType]: value('projectType'),
        [labels.form.dimensions]: value('dimensions'),
        [labels.form.timing]: value('timing'),
      }
      if (captchaValue !== '') payload['h-captcha-response'] = captchaValue

      try {
        const response = await fetch(WEB3FORMS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.status === 429) {
          setState('rateLimited')
          return
        }
        if (!response.ok) {
          setState('failed')
          return
        }
        const body = (await response.json().catch(() => null)) as { success?: boolean } | null
        if (body?.success) {
          setState('sent')
          node.reset()
        } else {
          setState('failed')
        }
      } catch {
        setState('failed')
      }
    },
    [],
  )

  const message =
    state === 'submitting'
      ? labels.formStates.submitting
      : state === 'sent'
        ? labels.formStates.sent
        : state === 'failed'
          ? labels.formStates.failed
          : state === 'rateLimited'
            ? labels.formStates.rateLimited
            : ''
  const offerPhone = state === 'failed' || state === 'rateLimited'

  return (
    <form
      ref={form}
      className={styles.form}
      onSubmit={onSubmit}
      noValidate
      data-contact-form=""
      data-form-state={state}
    >
      <div className={styles.fields}>
        <p className={styles.field}>
          <label className={styles.label} htmlFor="field-name">
            {labels.form.name}
            <span className={styles.mark}>{labels.form.required}</span>
          </label>
          <input
            ref={nameField}
            className={styles.input}
            id="field-name"
            name="name"
            type="text"
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'error-name' : undefined}
          />
          {errors.name ? (
            <span className={styles.error} id="error-name">
              {errors.name}
            </span>
          ) : null}
        </p>

        <p className={styles.field}>
          <label className={styles.label} htmlFor="field-email">
            {labels.form.email}
          </label>
          <input
            ref={emailField}
            className={styles.input}
            id="field-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.contact ? true : undefined}
            aria-describedby={errors.contact ? 'error-contact' : undefined}
          />
        </p>

        <p className={styles.field}>
          <label className={styles.label} htmlFor="field-phone">
            {labels.form.phone}
          </label>
          <input
            className={styles.input}
            id="field-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={errors.contact ? true : undefined}
            aria-describedby={errors.contact ? 'error-contact' : undefined}
          />
          {errors.contact ? (
            <span className={styles.error} id="error-contact">
              {errors.contact}
            </span>
          ) : null}
        </p>

        <fieldset className={`${styles.field} ${styles.group}`}>
          <legend className={styles.label}>{labels.form.preferredReply}</legend>
          <span className={styles.choices}>
            <span className={styles.choice}>
              <input type="radio" id="reply-email" name="reply" value={labels.form.preferredReplyEmail} />
              <label htmlFor="reply-email">{labels.form.preferredReplyEmail}</label>
            </span>
            <span className={styles.choice}>
              <input type="radio" id="reply-phone" name="reply" value={labels.form.preferredReplyPhone} />
              <label htmlFor="reply-phone">{labels.form.preferredReplyPhone}</label>
            </span>
          </span>
        </fieldset>

        <p className={`${styles.field} ${styles.wide}`}>
          <label className={styles.label} htmlFor="field-details">
            {labels.form.projectDetails}
            <span className={styles.mark}>{labels.form.required}</span>
          </label>
          <textarea
            ref={detailsField}
            className={`${styles.input} ${styles.textarea}`}
            id="field-details"
            name="details"
            rows={5}
            aria-invalid={errors.details ? true : undefined}
            aria-describedby={errors.details ? 'error-details' : undefined}
          />
          {errors.details ? (
            <span className={styles.error} id="error-details">
              {errors.details}
            </span>
          ) : null}
        </p>

        {projectTypes.length > 0 ? (
          <p className={styles.field}>
            <label className={styles.label} htmlFor="field-project-type">
              {labels.form.projectType}
            </label>
            <span className={styles.selectWrap}>
              <select className={styles.input} id="field-project-type" name="projectType" defaultValue="">
                <option value="">{labels.form.choose}</option>
                {projectTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </span>
          </p>
        ) : null}

        <p className={styles.field}>
          <label className={styles.label} htmlFor="field-dimensions">
            {labels.form.dimensions}
          </label>
          <input className={styles.input} id="field-dimensions" name="dimensions" type="text" />
        </p>

        <p className={styles.field}>
          <label className={styles.label} htmlFor="field-timing">
            {labels.form.timing}
          </label>
          <input className={styles.input} id="field-timing" name="timing" type="text" />
        </p>
      </div>

      {/* honeypot: only a machine filling in every input ever sets this */}
      <p className={styles.trap} aria-hidden="true">
        <label htmlFor="field-botcheck">{labels.form.leaveBlank}</label>
        <input id="field-botcheck" name="botcheck" type="text" tabIndex={-1} autoComplete="off" />
      </p>

      {captchaKey !== '' ? (
        <div className={styles.captcha} data-sitekey={captchaKey} data-hcaptcha="">
          <div className="h-captcha" data-sitekey={captchaKey} />
        </div>
      ) : null}

      <div className={styles.foot}>
        <button className={styles.submit} type="submit" disabled={state === 'submitting'}>
          {labels.form.submit}
        </button>

        <p
          className={styles.status}
          role="status"
          aria-live="polite"
          aria-label={labels.form.status}
          data-form-status=""
        >
          {message ? <span>{message}</span> : null}
          {offerPhone ? (
            <a className={styles.statusPhone} href={`tel:${phone}`}>
              {phoneDisplay}
            </a>
          ) : null}
        </p>
      </div>
    </form>
  )
}
