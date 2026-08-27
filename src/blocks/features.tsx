import {
  Gauge,
  ShieldCheck,
  Sparkles,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

import { tDynamic } from '@/core/i18n/dynamic';
import { m } from '@/paraglide/messages.js';
import { cn } from '@/lib/utils';

/**
 * CubistAI "Why Choose Us" — four feature cards highlighting the value
 * props: free, high-res, advanced understanding, fast.
 */
export function Features() {
  const features: {
    key: 'free' | 'hires' | 'understanding' | 'fast';
    icon: LucideIcon;
    gradient: string;
  }[] = [
    {
      key: 'free',
      icon: Sparkles,
      gradient: 'from-violet-500 to-indigo-600',
    },
    {
      key: 'hires',
      icon: Gauge,
      gradient: 'from-fuchsia-500 to-pink-600',
    },
    {
      key: 'understanding',
      icon: Wand2,
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      key: 'fast',
      icon: ShieldCheck,
      gradient: 'from-emerald-500 to-teal-600',
    },
  ];

  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {m['landing.why.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            {m['landing.why.description']()}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map(({ key, icon: Icon, gradient }) => (
            <div
              key={key}
              className="group relative flex gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg sm:p-7"
            >
              <div
                className={cn(
                  'inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                  gradient
                )}
              >
                <Icon className="size-5" strokeWidth={2} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {tDynamic(`landing.why.${key}.title`)}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tDynamic(`landing.why.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-sm">
          {m['landing.why.privacy']()}
        </p>
      </div>
    </section>
  );
}
