import { createFileRoute } from '@tanstack/react-router';

import { getAllConfigs } from '@/modules/config/service';
import { respErr } from '@/lib/resp';

// Known AI-provider hosts that may host generated images. Combined with the
// app's own origin and the configured storage public domain, this forms a
// strict allowlist so the proxy cannot be abused for SSRF.
const ALLOWED_SUFFIXES = [
  'api.kie.ai',
  'replicate.delivery',
  'fal.ai',
  'openrouter.ai',
];

function isHostAllowed(host: string, allowed: Set<string>): boolean {
  const h = host.toLowerCase();
  if (allowed.has(h)) return true;
  return ALLOWED_SUFFIXES.some((s) => h === s || h.endsWith('.' + s));
}

async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) return respErr('Missing url');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return respErr('Invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return respErr('Unsupported protocol');
  }

  // Build the allowlist from the app origin + configured storage domains.
  const appOrigin = url.origin;
  const configs = await getAllConfigs();
  const allowed = new Set<string>([new URL(appOrigin).host]);
  try {
    if (process.env.VITE_APP_URL)
      allowed.add(new URL(process.env.VITE_APP_URL).host);
  } catch {
    /* ignore */
  }
  try {
    if (configs.r2_domain) allowed.add(new URL(configs.r2_domain).host);
  } catch {
    /* ignore */
  }
  try {
    if (process.env.STORAGE_PUBLIC_DOMAIN)
      allowed.add(new URL(process.env.STORAGE_PUBLIC_DOMAIN).host);
  } catch {
    /* ignore */
  }

  if (!isHostAllowed(parsed.host, allowed)) {
    return respErr('Host not allowed');
  }

  try {
    const upstream = await fetch(parsed.toString(), { redirect: 'follow' });
    if (!upstream.ok) {
      return respErr(`Upstream error: ${upstream.status}`);
    }
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'image/png';
    const ext = (contentType.split('/')[1] || 'png').split('+')[0];
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="cubistai-${Date.now()}.${ext}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e: any) {
    return respErr(e?.message || 'Download failed');
  }
}

export const Route = createFileRoute('/api/editor/download')({
  server: {
    handlers: { GET },
  },
});
