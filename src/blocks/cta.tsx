import { ArrowRight, Sparkles } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { buttonVariants } from '@/components/ui/button';

export function CTA() {
  return (
    <section className="px-4 pb-24 sm:pb-28">
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-brand px-6 py-14 text-center sm:px-10 sm:py-20">
          {/* decorative facets */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 40%), linear-gradient(315deg, rgba(0,0,0,0.2) 0%, transparent 40%)',
            }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-3xl leading-[1.1] font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {m['landing.cta.headline']()}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
              {m['landing.cta.subheadline']()}
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/editor"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'h-12 gap-2 rounded-full bg-white px-8 text-gray-900 hover:bg-white/90'
                )}
              >
                <Sparkles className="size-4" />
                {m['landing.cta.button']()}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
