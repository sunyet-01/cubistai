import { ArrowRight, Palette, Shirt, Trophy, Brush } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { tDynamic } from '@/core/i18n/dynamic';
import { m } from '@/paraglide/messages.js';
import { cn } from '@/lib/utils';

/**
 * World Cup 2026 feature band — four themed tool cards.
 */
export function WorldCup() {
  const cards = [
    {
      key: 'hub',
      icon: Trophy,
      href: '/tools/world-cup-2026',
      gradient: 'from-amber-500 to-orange-600',
      image: '/worldcup/hub.png',
    },
    {
      key: 'jersey',
      icon: Shirt,
      href: '/tools/ai-football-jersey-design',
      gradient: 'from-sky-500 to-indigo-600',
      image: '/worldcup/jersey.png',
    },
    {
      key: 'poster',
      icon: Palette,
      href: '/tools/ai-football-poster-generator',
      gradient: 'from-rose-500 to-fuchsia-600',
      image: '/worldcup/poster.png',
    },
    {
      key: 'coloring',
      icon: Brush,
      href: '/tools/world-cup-coloring-page',
      gradient: 'from-emerald-500 to-teal-600',
      image: '/worldcup/coloring.png',
    },
  ] as const;

  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-6 dark:from-indigo-950/30 dark:via-card dark:to-fuchsia-950/30 sm:p-10">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Trophy className="size-3.5" />
              {m['landing.worldcup.badge']()}
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {m['landing.worldcup.title']()}
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-2xl">
              {m['landing.worldcup.description']()}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ key, icon: Icon, href, gradient, image }) => (
              <Link
                key={key}
                href={href}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className={cn(
                      'absolute top-3 left-3 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md',
                      gradient
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2} />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-base font-semibold">
                    {tDynamic(`landing.worldcup.${key}`)}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {tDynamic(`landing.worldcup.${key}_desc`)}
                  </p>
                  <span className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium">
                    {m['landing.worldcup.cta']()}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
