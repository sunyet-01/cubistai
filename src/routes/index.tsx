import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { CTA } from '@/blocks/cta';
import { FAQ } from '@/blocks/faq';
import { Features } from '@/blocks/features';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { Hero } from '@/blocks/hero';
import { Inspiration } from '@/blocks/inspiration';
import { Pricing } from '@/blocks/pricing';
import { SupportWidget } from '@/blocks/support-widget';
import { Toolkit } from '@/blocks/toolkit';
import { WorldCup } from '@/blocks/world-cup';

function HomePage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main>
        <Hero />
        <WorldCup />
        <Toolkit />
        <Inspiration />
        <Features />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      {/* Fazier launch badge — required by the Fazier listing. Swap the href
          to the product's Fazier launch page once the submission is live. */}
      <div className="bg-background flex justify-center py-4">
        <a
          href="https://fazier.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fazier badge"
        >
          <img
            src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&theme=light"
            width={120}
            height={40}
            alt="Fazier badge"
            loading="lazy"
            className="dark:hidden"
          />
          <img
            src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&theme=dark"
            width={120}
            height={40}
            alt="Fazier badge"
            loading="lazy"
            className="hidden dark:block"
          />
        </a>
      </div>
      <SupportWidget />
    </div>
  );
}

export const Route = createFileRoute('/')({
  head: () => {
    const locale = getLocale();
    const t = (key: string) =>
      m[`seo.home.${key}`]({}, { locale: locale as any });
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    return {
      meta: [
        { title: t('title') },
        { name: 'description', content: t('description') },
        { name: 'keywords', content: t('keywords') },
        { property: 'og:title', content: t('title') },
        { property: 'og:description', content: t('description') },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: urlFor(locale) },
        {
          property: 'og:image',
          content: `${envConfigs.app_url}/tools/headshot.png`,
        },
        { property: 'og:site_name', content: 'CubistAI' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: t('title') },
        { name: 'twitter:description', content: t('description') },
        {
          name: 'twitter:image',
          content: `${envConfigs.app_url}/tools/headshot.png`,
        },
      ],
      links: [
        { rel: 'canonical', href: urlFor(locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
      ],
    };
  },
  component: HomePage,
});
