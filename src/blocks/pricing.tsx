'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { apiPost } from '@/lib/api-client';
import { currentPathWithQuery } from '@/lib/redirect';
import { m } from '@/paraglide/messages.js';
import { usePublicConfig } from '@/hooks/use-public-config';
import {
  PaymentProviderModal,
  type PaymentProvider,
} from '@/components/payment-provider-modal';
import {
  PricingTable,
  type PricingGroup,
  type PricingPlan,
} from '@/components/pricing-table';

const ALL_PROVIDERS: PaymentProvider[] = [
  'stripe',
  'creem',
  'waffo',
  'paypal',
  'alipay',
  'wechat',
];

// Full list of AI models actually invoked by the platform (kept in sync with
// the editor's model picker). Disclosed here per platform review requirements.
const DISCLOSED_MODELS = [
  {
    name: 'Nano Banana 2',
    slug: 'google/nano-banana-2',
    developer: 'Google DeepMind',
    source: 'OpenRouter / Kie.ai',
  },
  {
    name: 'Seedream 4.5',
    slug: 'bytedance/seedream-4.5',
    developer: 'ByteDance',
    source: 'OpenRouter / Kie.ai',
  },
  {
    name: 'Nano Banana Pro',
    slug: 'google/nano-banana-pro',
    developer: 'Google DeepMind',
    source: 'OpenRouter / Kie.ai',
  },
  {
    name: 'Seedream 5 Lite',
    slug: 'bytedance/seedream-5-lite',
    developer: 'ByteDance',
    source: 'OpenRouter / Kie.ai',
  },
  {
    name: 'FLUX.2 Pro',
    slug: 'black-forest-labs/flux-2-pro',
    developer: 'Black Forest Labs',
    source: 'OpenRouter / Kie.ai',
  },
  {
    name: 'FLUX.2 Max',
    slug: 'black-forest-labs/flux-2-max',
    developer: 'Black Forest Labs',
    source: 'OpenRouter / Kie.ai',
  },
];

export function Pricing({ title }: { title?: string } = {}) {
  const router = useRouter();
  const { data: session } = useSession();

  const { data: configsData } = usePublicConfig();
  const configs = configsData ?? {};
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [loadingProvider, setLoadingProvider] =
    useState<PaymentProvider | null>(null);

  const enabledProviders = useMemo<PaymentProvider[]>(
    () => ALL_PROVIDERS.filter((p) => configs[`${p}_enabled`] === 'true'),
    [configs]
  );

  // Free plan features
  const freeFeatures = [
    { icon: Sparkles, label: m['landing.pricing.feature_daily']() },
    { icon: Check, label: m['landing.pricing.feature_6_models']() },
    { icon: Check, label: m['landing.pricing.feature_1k']() },
    { icon: Check, label: m['landing.pricing.feature_1x1']() },
    { icon: Check, label: m['landing.pricing.feature_image_only']() },
    { icon: Check, label: m['landing.pricing.feature_15day']() },
    { icon: Check, label: m['landing.pricing.feature_ads']() },
  ];
  // Starter
  const starterFeatures = [
    { icon: Sparkles, label: m['landing.pricing.feature_1100']() },
    { icon: Check, label: m['landing.pricing.feature_6_models']() },
    { icon: Check, label: m['landing.pricing.feature_2k']() },
    { icon: Check, label: m['landing.pricing.feature_1x1']() },
    { icon: Check, label: m['landing.pricing.feature_image_only']() },
    { icon: Check, label: m['landing.pricing.feature_permanent']() },
    { icon: Check, label: m['landing.pricing.feature_noads']() },
  ];
  // Plus (most popular)
  const plusFeatures = [
    { icon: Zap, label: m['landing.pricing.feature_2000']() },
    { icon: Check, label: m['landing.pricing.feature_6_models']() },
    { icon: Check, label: m['landing.pricing.feature_4k']() },
    { icon: Check, label: m['landing.pricing.feature_2x2']() },
    { icon: Check, label: m['landing.pricing.feature_permanent']() },
    { icon: Check, label: m['landing.pricing.feature_noads']() },
  ];
  // Pro
  const proFeatures = [
    { icon: Zap, label: m['landing.pricing.feature_4000']() },
    { icon: Check, label: m['landing.pricing.feature_6_models']() },
    { icon: Check, label: m['landing.pricing.feature_4k']() },
    { icon: Check, label: m['landing.pricing.feature_4x4']() },
    { icon: Check, label: m['landing.pricing.feature_permanent']() },
    { icon: Check, label: m['landing.pricing.feature_noads']() },
    { icon: Check, label: m['landing.pricing.feature_rollover']() },
  ];

  const groups: PricingGroup[] = [
    {
      key: 'monthly',
      label: m['landing.pricing.monthly'](),
      plans: [
        {
          id: 'free-monthly',
          name: m['landing.pricing.free'](),
          description: m['landing.pricing.free_desc'](),
          price: '$0',
          interval: 'mo',
          features: freeFeatures,
          productId: 'free_monthly',
          priceInCents: 0,
          currency: 'usd',
          credits: 0,
        },
        {
          id: 'starter-monthly',
          name: m['landing.pricing.starter'](),
          description: m['landing.pricing.starter_desc'](),
          price: '$7.90',
          interval: 'mo',
          features: starterFeatures,
          productId: 'starter_monthly',
          priceInCents: 790,
          currency: 'usd',
          credits: 1100,
          plan: { name: 'Starter', interval: 'month', intervalCount: 1 },
        },
        {
          id: 'plus-monthly',
          name: m['landing.pricing.plus'](),
          description: m['landing.pricing.plus_desc'](),
          price: '$14.90',
          interval: 'mo',
          featured: true,
          badge: m['landing.pricing.popular'](),
          features: plusFeatures,
          productId: 'plus_monthly',
          priceInCents: 1490,
          currency: 'usd',
          credits: 2000,
          plan: { name: 'Plus', interval: 'month', intervalCount: 1 },
        },
        {
          id: 'pro-monthly',
          name: m['landing.pricing.pro'](),
          description: m['landing.pricing.pro_desc'](),
          price: '$27.90',
          interval: 'mo',
          features: proFeatures,
          productId: 'pro_monthly',
          priceInCents: 2790,
          currency: 'usd',
          credits: 4000,
          plan: { name: 'Pro', interval: 'month', intervalCount: 1 },
        },
      ],
    },
    {
      key: 'yearly',
      label: m['landing.pricing.yearly'](),
      plans: [
        {
          id: 'free-yearly',
          name: m['landing.pricing.free'](),
          description: m['landing.pricing.free_desc'](),
          price: '$0',
          interval: 'yr',
          features: freeFeatures,
          productId: 'free_yearly',
          priceInCents: 0,
          currency: 'usd',
          credits: 0,
        },
        {
          id: 'starter-yearly',
          name: m['landing.pricing.starter'](),
          description: m['landing.pricing.starter_desc'](),
          price: '$6.25',
          originalPrice: '$7.90',
          interval: 'mo',
          features: starterFeatures,
          productId: 'starter_yearly',
          priceInCents: 7500,
          currency: 'usd',
          credits: 1100,
          plan: { name: 'Starter', interval: 'year', intervalCount: 1 },
        },
        {
          id: 'plus-yearly',
          name: m['landing.pricing.plus'](),
          description: m['landing.pricing.plus_desc'](),
          price: '$11.58',
          originalPrice: '$14.90',
          interval: 'mo',
          featured: true,
          badge: m['landing.pricing.popular'](),
          features: plusFeatures,
          productId: 'plus_yearly',
          priceInCents: 13900,
          currency: 'usd',
          credits: 2000,
          plan: { name: 'Plus', interval: 'year', intervalCount: 1 },
        },
        {
          id: 'pro-yearly',
          name: m['landing.pricing.pro'](),
          description: m['landing.pricing.pro_desc'](),
          price: '$21.58',
          originalPrice: '$27.90',
          interval: 'mo',
          features: proFeatures,
          productId: 'pro_yearly',
          priceInCents: 25900,
          currency: 'usd',
          credits: 4000,
          plan: { name: 'Pro', interval: 'year', intervalCount: 1 },
        },
      ],
    },
  ];

  const checkoutMutation = useMutation({
    mutationFn: ({
      plan,
      provider,
    }: {
      plan: PricingPlan;
      provider: PaymentProvider;
    }) =>
      apiPost<{ checkout_url?: string }>('/api/payment/checkout', {
        product_id: plan.productId,
        product_name: plan.productName || plan.name,
        plan_name: plan.plan?.name || plan.name,
        price: plan.priceInCents,
        currency: plan.currency || 'usd',
        type: plan.plan ? 'subscription' : 'one-time',
        description: plan.name,
        plan: plan.plan,
        credits: plan.credits,
        credits_valid_days: plan.creditsValidDays,
        payment_provider: provider,
        redirect: currentPathWithQuery('/settings/billing'),
      }),
    onSuccess: (data) => {
      if (!data?.checkout_url) {
        toast.error('Checkout failed');
        setLoadingProvider(null);
        return;
      }
      window.location.href = data.checkout_url;
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Checkout failed');
      setLoadingProvider(null);
    },
  });

  function startCheckout(plan: PricingPlan, provider: PaymentProvider) {
    setLoadingProvider(provider);
    checkoutMutation.mutate({ plan, provider });
  }

  async function handleCheckout(plan: PricingPlan) {
    // Free plan just redirects to editor
    if (plan.productId.startsWith('free')) {
      router.push('/editor');
      return;
    }

    if (!session?.user) {
      const callbackUrl = encodeURIComponent(currentPathWithQuery('/pricing'));
      router.push(`/sign-in?callbackUrl=${callbackUrl}`);
      return;
    }

    const selectEnabled = configs.select_payment_enabled === 'true';
    const defaultProvider = (configs.default_payment_provider ||
      enabledProviders[0] ||
      'stripe') as PaymentProvider;

    if (selectEnabled && enabledProviders.length > 1) {
      setPendingPlan(plan);
      setModalOpen(true);
      return;
    }

    await startCheckout(plan, defaultProvider);
  }

  function handleProviderSelect(provider: PaymentProvider) {
    if (!pendingPlan) return;
    startCheckout(pendingPlan, provider);
  }

  return (
    <section
      id="pricing"
      className="border-border border-t px-4 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {title ?? m['landing.pricing.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            {m['landing.pricing.description']()}
          </p>
        </div>
        <PricingTable groups={groups} onCheckout={handleCheckout} />

        {/* Model & data source disclosure (required by platform review) */}
        <div className="border-border mt-14 rounded-2xl border p-6 sm:p-8">
          <h3 className="text-foreground text-lg font-semibold tracking-tight">
            {m['landing.pricing.models_title']()}
          </h3>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {m['landing.pricing.models_description']()}
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="text-foreground/90 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Model ID</th>
                  <th className="py-2 pr-4 font-medium">Developer</th>
                  <th className="py-2 font-medium">Access Source</th>
                </tr>
              </thead>
              <tbody>
                {DISCLOSED_MODELS.map((model) => (
                  <tr key={model.slug} className="border-border border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{model.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                      {model.slug}
                    </td>
                    <td className="py-2.5 pr-4">{model.developer}</td>
                    <td className="py-2.5">{model.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-4 text-xs leading-5">
            {m['landing.pricing.models_note']()}
          </p>
          <p className="border-border text-muted-foreground mt-4 border-t pt-4 text-xs leading-5">
            {m['landing.pricing.credits_note']()}
          </p>
        </div>
      </div>

      <PaymentProviderModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setPendingPlan(null);
            setLoadingProvider(null);
          }
        }}
        providers={enabledProviders.length ? enabledProviders : ['stripe']}
        loadingProvider={loadingProvider}
        onSelect={handleProviderSelect}
        planName={pendingPlan?.name}
        price={pendingPlan?.price}
      />
    </section>
  );
}
