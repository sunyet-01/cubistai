import { ArrowRight, Sparkles, type LucideIcon } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { tDynamic } from '@/core/i18n/dynamic';
import { m } from '@/paraglide/messages.js';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type Badge = 'hot' | 'hotnew' | 'new' | 'soon' | null;

interface Tool {
  key: string;
  href: string;
  badge: Badge;
  image: string;
  icon: LucideIcon;
  /** Not yet launched — renders a non-clickable card with a SOON badge. */
  comingSoon?: boolean;
}

/**
 * CubistAI toolkit — AI image generators grid + photo editing tools grid.
 *
 * All tools route into the live editor with a pre-filled prompt (the editor is
 * the single working entry point; dedicated tool pages are not built yet).
 * Not-yet-launched tools (e.g. video) are marked coming soon instead of
 * linking to a 404.
 */
export function Toolkit() {
  const generators: Tool[] = [
    {
      key: 'headshot',
      href: '/editor?prompt=Professional studio headshot portrait, soft lighting, clean background',
      badge: 'hot',
      image: '/tools/headshot.png',
      icon: Sparkles,
    },
    {
      key: 'cartoon',
      href: '/editor?prompt=Cute cartoon avatar, bold outlines, vibrant colors',
      badge: null,
      image: '/tools/cartoon.png',
      icon: Sparkles,
    },
    {
      key: 'coloring',
      href: '/editor?prompt=Black and white coloring book page, thick outlines',
      badge: null,
      image: '/tools/coloring.png',
      icon: Sparkles,
    },
    {
      key: 'nano_banana',
      href: '/editor?prompt=Playful illustration in a modern flat style',
      badge: 'new',
      image: '/tools/nano-banana.png',
      icon: Sparkles,
    },
    {
      key: 'video',
      href: '',
      badge: 'soon',
      image: '/tools/video.png',
      icon: Sparkles,
      comingSoon: true,
    },
    {
      key: 'linkedin',
      href: '/editor?prompt=Professional LinkedIn profile headshot, business attire, neutral background',
      badge: 'new',
      image: '/tools/linkedin.png',
      icon: Sparkles,
    },
    {
      key: 'action_figure',
      href: '/editor?prompt=Stylized action figure toy render, dramatic lighting',
      badge: null,
      image: '/tools/action-figure.png',
      icon: Sparkles,
    },
    {
      key: 'profile_picture',
      href: '/editor?prompt=Fun cartoon profile picture, bright background',
      badge: null,
      image: '/tools/profile-picture.png',
      icon: Sparkles,
    },
    {
      key: 'age_filter',
      href: '/editor?prompt=Portrait photo, natural skin texture',
      badge: null,
      image: '/tools/age-filter.png',
      icon: Sparkles,
    },
  ];

  const editing: Tool[] = [
    {
      key: 'remove_bg',
      href: '/editor?prompt=Remove the background and make it transparent',
      badge: null,
      image: '/tools/remove-bg.png',
      icon: Sparkles,
    },
    {
      key: 'expander',
      href: '/editor?prompt=Expand the image canvas seamlessly',
      badge: null,
      image: '/tools/expander.png',
      icon: Sparkles,
    },
    {
      key: 'watermark',
      href: '/editor?prompt=Remove watermarks and clean up artifacts',
      badge: 'new',
      image: '/tools/watermark.png',
      icon: Sparkles,
    },
    {
      key: 'hair_color',
      href: '/editor?prompt=Change the hair color naturally',
      badge: null,
      image: '/tools/hair-color.png',
      icon: Sparkles,
    },
  ];

  return (
    <section id="tools" className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-14 text-center">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
            {m['landing.toolkit.badge']()}
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {m['landing.toolkit.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            {m['landing.toolkit.description']()}
          </p>
        </div>

        {/* AI Image Generators */}
        <div className="mb-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">
                {m['landing.toolkit.generators_title']()}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {m['landing.toolkit.generators_desc']()}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {generators.map((tool) => (
              <ToolCard key={tool.key} tool={tool} />
            ))}
          </div>
        </div>

        {/* AI Photo Editing Tools */}
        <div>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">
                {m['landing.toolkit.editing_title']()}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {m['landing.toolkit.editing_desc']()}
              </p>
            </div>
            <Link
              href="/editor"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'shrink-0 gap-1'
              )}
            >
              {m['landing.toolkit.view_all']()}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {editing.map((tool) => (
              <ToolCard key={tool.key} tool={tool} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const { image, href, key, badge, comingSoon } = tool;

  const inner = (
    <>
      {badge && <BadgePill type={badge} />}

      {/* Real example image — full bleed */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={image}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            backgroundImage:
              'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4) 100%)',
          }}
        />
      </div>

      <div className="p-5">
        <h3 className="text-base font-semibold">
          {tDynamic(`landing.toolkit.${key}`)}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {tDynamic(`landing.toolkit.${key}_desc`)}
        </p>
      </div>
    </>
  );

  if (comingSoon) {
    return (
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card opacity-90">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
    >
      {inner}
    </Link>
  );
}

function BadgePill({ type }: { type: Exclude<Badge, null> }) {
  if (type === 'hotnew') {
    return (
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
          HOT
        </span>
        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
          NEW
        </span>
      </div>
    );
  }
  if (type === 'hot') {
    return (
      <span className="absolute top-3 right-3 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
        HOT
      </span>
    );
  }
  if (type === 'soon') {
    return (
      <span className="absolute top-3 right-3 z-10 rounded-full bg-neutral-500 px-2 py-0.5 text-[10px] font-bold text-white">
        SOON
      </span>
    );
  }
  return (
    <span className="absolute top-3 right-3 z-10 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
      NEW
    </span>
  );
}
