import { ArrowRight, Sparkles } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * CubistAI inspiration gallery — a grid of AI-generated art cards with
 * "Generate Similar" hover action. Cycles through 8 thumbnail images
 * across the 20 prompt titles.
 */
export function Inspiration() {
  const titles = m['landing.inspiration.items']().split('|');

  // 8 curated thumbnails (generated into /public/inspiration)
  const thumbs = Array.from(
    { length: 8 },
    (_, i) => `/inspiration/${String(i + 1).padStart(2, '0')}.png`
  );

  const cards = titles.map((title, i) => ({
    title: title.trim(),
    img: thumbs[i % thumbs.length],
  }));

  return (
    <section id="inspiration" className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
            {m['landing.inspiration.badge']()}
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {m['landing.inspiration.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            {m['landing.inspiration.description']()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {cards.map((card, i) => (
            <InspirationCard key={i} {...card} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/inspiration"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'gap-2 rounded-full'
            )}
          >
            {m['landing.inspiration.view_all']()}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function InspirationCard({ title, img }: { title: string; img: string }) {
  return (
    <Link
      href="/editor"
      className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
    >
      <img
        src={img}
        alt={title}
        loading="lazy"
        className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      {/* gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 transition-opacity group-hover:opacity-100" />

      {/* title */}
      <div className="absolute right-0 bottom-0 left-0 p-3">
        <p className="line-clamp-2 text-xs font-medium text-white drop-shadow sm:text-sm">
          {title}
        </p>
        <span className="mt-2 inline-flex translate-y-2 items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-900 opacity-0 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Sparkles className="size-3" />
          {m['landing.inspiration.generate_similar']()}
        </span>
      </div>
    </Link>
  );
}
