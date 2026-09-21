"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Picture } from "./Picture";
import { labels } from "@/labels";
import type { PhotoView } from "@/content/view";
import styles from "./HangRow.module.css";

export type HangRowProps = {
  items: readonly PhotoView[];
  /** Accessible name for the scrollable group. Comes from labels or content. */
  label: string;
  /** Show previous and next buttons. Arrow keys work either way. */
  controls?: boolean;
  /** Mark the first picture as the LCP candidate. Only one row per page may. */
  priorityFirst?: boolean;
  /** Sits at the left of the controls bar, opposite previous and next. */
  children?: ReactNode;
};

/**
 * A picture in the row is sized by its height, so how wide it comes out
 * depends on its own proportions. A single `sizes` value would therefore be
 * wrong for every picture that is not the one it was written for, and a tall
 * one would download about three times the pixels it shows.
 *
 * These are the four hang heights from `globals.css`, written out because
 * `sizes` is read by the preload scanner, which knows nothing about custom
 * properties. Multiplied by the picture's own aspect ratio they give its real
 * width, capped by the same 78vw the stylesheet caps it at.
 */
const HEIGHTS = {
  s: "clamp(132px, 17vw, 224px)",
  m: "clamp(170px, 23vw, 300px)",
  l: "clamp(205px, 29vw, 376px)",
  xl: "clamp(240px, 35vw, 448px)",
} as const;

function sizesFor(item: PhotoView): string {
  const ratio = item.image.height === 0 ? 1 : item.image.width / item.image.height;
  return `min(78vw, calc(${HEIGHTS[item.size]} * ${ratio.toFixed(3)}))`;
}

/**
 * The hang: a full bleed row of pictures on one centre line. Native horizontal
 * scroll with scroll-snap, so it works with no JavaScript at all. The buttons
 * and arrow keys are an addition, not a requirement. There is no autoplay, so
 * reduced-motion readers lose nothing.
 */
export function HangRow({
  items,
  label,
  controls = false,
  priorityFirst = false,
  children,
}: HangRowProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const captioned = items.some((item) => item.caption);

  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setAtStart(node.scrollLeft <= 1);
    setAtEnd(max <= 1 || node.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const step = useCallback((direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollBy({
      left: direction * Math.max(node.clientWidth * 0.66, 200),
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    },
    [step],
  );

  return (
    <div className={styles.row}>
      <div
        ref={scroller}
        className={[
          styles.scroller,
          captioned ? styles.captioned : null,
          controls ? styles.controlled : null,
        ]
          .filter(Boolean)
          .join(" ")}
        tabIndex={0}
        role="group"
        aria-label={label}
        onScroll={measure}
        onKeyDown={onKeyDown}
        data-hang-row=""
      >
        <div className={styles.inner}>
          <span className={styles.line} aria-hidden="true" />
          {items.map((item, index) => (
            <figure
              key={item.id}
              className={[styles.figure, styles[item.size]]
                .filter(Boolean)
                .join(" ")}
            >
              <Picture
                image={item.image}
                alt={item.alt}
                sizes={sizesFor(item)}
                priority={priorityFirst && index === 0}
              />
              {item.caption ? (
                <figcaption className={styles.caption}>
                  {item.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      </div>
      {controls || children ? (
        <div className={styles.controls}>
          <div className={styles.controlsStart}>{children}</div>
          {controls ? (
            <div className={styles.controlsEnd}>
              <button
                type="button"
                className={styles.control}
                onClick={() => step(-1)}
                disabled={atStart}
                data-hang-previous=""
              >
                {labels.slider.previous}
              </button>
              <button
                type="button"
                className={styles.control}
                onClick={() => step(1)}
                disabled={atEnd}
                data-hang-next=""
              >
                {labels.slider.next}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
