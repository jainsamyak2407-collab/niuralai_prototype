"use client";

import { useEffect, useState } from "react";

/** Underline tabs that jump to anchored sections and follow the scroll position. */
export function SectionNav({
  items,
}: {
  items: { id: string; label: string; attention?: boolean }[];
}) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav
      aria-label="Case sections"
      className="sticky top-0 z-10 -mx-1 mb-4 overflow-x-auto bg-surface px-1"
    >
      <ul className="flex gap-x-6 border-b border-divider">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              onClick={() => setActive(i.id)}
              aria-current={active === i.id ? "location" : undefined}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pt-2 pb-2.5 text-sm ${active === i.id ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {i.label}
              {i.attention ? (
                <span
                  className="size-1.5 rounded-full bg-warning"
                  aria-label="needs attention"
                />
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
