import { m } from '@/paraglide/messages.js';
import { envConfigs } from '@/config';
import { usePublicConfig } from '@/hooks/use-public-config';
import { SiteFooter, type FooterColumn } from '@/components/site-footer';

export function Footer() {
  const { data: configsData } = usePublicConfig();
  const configs = configsData ?? {};
  const supportEmail =
    (configs as Record<string, string>).support_email || envConfigs.support_email;

  const columns: FooterColumn[] = [
    {
      title: m['landing.footer.product'](),
      links: [
        { href: '/editor', label: m['landing.footer.generate']() },
        { href: '/#tools', label: m['landing.footer.tools']() },
        { href: '/pricing', label: m['landing.footer.pricing']() },
      ],
    },
    {
      title: m['landing.footer.legal'](),
      links: [
        { href: '/privacy-policy', label: m['landing.footer.privacy']() },
        { href: '/terms-of-service', label: m['landing.footer.terms']() },
        { href: '/acceptable-use-policy', label: m['landing.footer.aup']() },
      ],
    },
    {
      title: m['landing.footer.contact'](),
      links: [
        {
          href: `mailto:${supportEmail}`,
          label: supportEmail,
          external: true,
        },
      ],
    },
  ];

  return (
    <SiteFooter
      tagline={m['landing.footer.tagline']()}
      columns={columns}
    />
  );
}
