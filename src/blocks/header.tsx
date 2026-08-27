import { m } from '@/paraglide/messages.js';
import { SiteHeader } from '@/components/site-header';

export function Header() {
  const navLinks = [
    { href: '/#tools', label: m['landing.nav.tools']() },
    { href: '/#inspiration', label: m['landing.nav.inspiration']() },
    { href: '/pricing', label: m['landing.nav.pricing']() },
  ];

  return <SiteHeader navLinks={navLinks} />;
}
