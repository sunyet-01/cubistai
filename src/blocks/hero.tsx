'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles, Wand2 } from 'lucide-react';

import { useRouter } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { buttonVariants } from '@/components/ui/button';

/**
 * CubistAI hero — big headline, subheadline, a prompt input box that
 * routes to /editor with the prompt, suggestion chips and a brand
 * gradient backdrop with cubist geometric facets.
 */
export function Hero() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

  const suggestions = [
    m['landing.hero.suggestions_1'](),
    m['landing.hero.suggestions_2'](),
    m['landing.hero.suggestions_3'](),
  ];

  function handleGenerate() {
    const q = prompt.trim();
    router.push(q ? `/editor?prompt=${encodeURIComponent(q)}` : '/editor');
  }

  return (
    <section className="relative isolate overflow-hidden px-4 pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* Cubist geometric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 size-[28rem] rounded-full bg-gradient-brand opacity-20 blur-3xl" />
        <div className="absolute top-10 right-0 size-[24rem] rounded-full bg-gradient-brand-warm opacity-20 blur-3xl" />
        <CubistFacets className="absolute inset-0 h-full w-full opacity-[0.5]" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {m['landing.hero.badge']()}
        </div>

        {/* Headline */}
        <h1 className="text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl">
          {m['landing.hero.headline_1']()}{' '}
          <span className="text-gradient-brand">
            {m['landing.hero.headline_2']()}
          </span>
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
          {m['landing.hero.subheadline']()}
        </p>

        {/* Prompt input box */}
        <div className="mx-auto mt-10 max-w-2xl">
          <div className="bg-card/80 group relative flex items-center gap-2 rounded-2xl border border-border p-2 shadow-lg shadow-primary/5 backdrop-blur-sm transition focus-within:border-primary/50 focus-within:shadow-primary/20">
            <Wand2 className="text-muted-foreground ml-3 size-5 shrink-0" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate();
              }}
              placeholder={m['landing.hero.placeholder']()}
              className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground sm:text-base"
            />
            <button
              onClick={handleGenerate}
              className={cn(
                buttonVariants(),
                'h-11 shrink-0 gap-1.5 rounded-xl px-5'
              )}
            >
              <Sparkles className="size-4" />
              {m['landing.hero.cta']()}
            </button>
          </div>

          {/* Suggestion chips */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Feature chips */}
        <div className="text-muted-foreground mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="bg-primary inline-block size-1.5 rounded-full" />
            {m['landing.hero.chip_1']()}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-primary inline-block size-1.5 rounded-full" />
            {m['landing.hero.chip_2']()}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-primary inline-block size-1.5 rounded-full" />
            {m['landing.hero.chip_3']()}
          </span>
        </div>
      </div>
    </section>
  );
}

/** Subtle cubist faceted triangles SVG used as a hero backdrop motif. */
function CubistFacets({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="facetA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" stopOpacity="0.12" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="facetB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#db2777" stopOpacity="0.10" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <polygon points="0,0 320,0 120,300 0,180" fill="url(#facetA)" />
      <polygon points="900,0 1200,0 1200,220 1040,140" fill="url(#facetB)" />
      <polygon points="0,440 220,600 0,600" fill="url(#facetA)" />
      <polygon points="980,600 1200,420 1200,600" fill="url(#facetB)" />
    </svg>
  );
}
