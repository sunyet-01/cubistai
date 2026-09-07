import {
  CheckoutSession,
  PaymentConfigs,
  PaymentEvent,
  PaymentEventType,
  PaymentInfo,
  PaymentInterval,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
  PaymentStatus,
  SubscriptionCycleType,
  SubscriptionInfo,
  SubscriptionStatus,
  WebhookIgnoredError,
} from './types';

/**
 * Waffo Pancake payment provider configs.
 * @docs https://docs.waffo.ai/zh/integrate/skill
 */
export interface WaffoConfigs extends PaymentConfigs {
  merchantId: string;
  privateKey: string;
  storeId: string;
  /** JSON mapping of our pricing product_id → Waffo product id. Auto-created products are cached in memory. */
  productIdsMapping?: string;
}

type WaffoClient = import('@waffo/pancake-ts').WaffoPancake;

// Zero-decimal currencies (amount display = raw integer).
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'IDR']);

/**
 * Waffo Pancake payment provider implementation.
 *
 * Model: create+publish a product (one-time or subscription) in the merchant's
 * store, then create a hosted checkout session and redirect the customer.
 * Payments arrive via signed webhooks (X-Waffo-Signature, RSA).
 *
 * Product ids are resolved in order: admin mapping JSON → in-memory cache →
 * auto-create + publish (stored in cache). Auto-created products make the
 * pricing catalog work out of the box; set `productIdsMapping` to pin ids.
 */
export class WaffoProvider implements PaymentProvider {
  readonly name = 'waffo';
  configs: WaffoConfigs;

  private clientPromise: Promise<WaffoClient> | null = null;
  private productCache = new Map<string, string>();

  constructor(configs: WaffoConfigs) {
    this.configs = configs;
  }

  private async getClient(): Promise<WaffoClient> {
    if (!this.clientPromise) {
      this.clientPromise = import('@waffo/pancake-ts').then(({ WaffoPancake }) => {
        return new WaffoPancake({
          merchantId: this.configs.merchantId,
          privateKey: this.configs.privateKey,
        });
      });
    }
    return this.clientPromise;
  }

  private centsToDisplay(amountCents: number, currency: string): string {
    const cur = (currency || 'USD').toUpperCase();
    if (ZERO_DECIMAL_CURRENCIES.has(cur)) return String(amountCents);
    return (amountCents / 100).toFixed(2);
  }

  private mapBillingPeriod(
    plan?: PaymentOrder['plan']
  ): 'weekly' | 'monthly' | 'quarterly' | 'yearly' {
    const interval = plan?.interval;
    if (interval === PaymentInterval.MONTH) {
      return plan?.intervalCount === 3
        ? 'quarterly'
        : plan?.intervalCount === 6
          ? 'quarterly'
          : 'monthly';
    }
    if (interval === PaymentInterval.YEAR) return 'yearly';
    if (interval === PaymentInterval.WEEK) return 'weekly';
    throw new Error(
      `Unsupported Waffo billing period for interval: ${interval || plan?.name}`
    );
  }

  // --- Product resolution: mapping → cache → auto-create + publish ---

  private async resolveProductId(order: PaymentOrder): Promise<string> {
    if (!order.productId) throw new Error('productId is required');

    // 1. Admin-configured mapping (authoritative).
    if (this.configs.productIdsMapping) {
      try {
        const map = JSON.parse(this.configs.productIdsMapping) as Record<
          string,
          string
        >;
        if (map[order.productId]) return map[order.productId];
      } catch {
        // invalid JSON — fall through
      }
    }

    // 2. In-memory cache (product created earlier in this process).
    const cached = this.productCache.get(order.productId);
    if (cached) return cached;

    // 3. Auto-create + publish (requires a product id at checkout).
    const client = await this.getClient();
    const currency = (order.price?.currency || 'USD').toUpperCase();
    const amount = this.centsToDisplay(order.price?.amount || 0, currency);
    const name = order.description || order.productId;
    const prices = { [currency]: { amount, taxCategory: 'digital_goods' as const } };
    const isSubscription =
      order.type === 'subscription' ||
      (order.plan &&
        order.plan.interval !== PaymentInterval.ONE_TIME &&
        order.plan.interval !== undefined);

    let productId: string;
    if (isSubscription) {
      const billingPeriod = this.mapBillingPeriod(order.plan);
      const { product } = await client.subscriptionProducts.create({
        storeId: this.configs.storeId,
        name,
        billingPeriod,
        prices,
        successUrl: order.successUrl || null,
      });
      await this.publishIfNeeded(() =>
        client.subscriptionProducts.publish({ id: product.id })
      );
      productId = product.id;
    } else {
      const { product } = await client.onetimeProducts.create({
        storeId: this.configs.storeId,
        name,
        prices,
        successUrl: order.successUrl || null,
      });
      await this.publishIfNeeded(() =>
        client.onetimeProducts.publish({ id: product.id })
      );
      productId = product.id;
    }

    this.productCache.set(order.productId, productId);
    return productId;
  }

  /**
   * Products created via the SDK are already usable; publish() is only needed
   * when a separate test version exists. Ignore "no test version / not
   * approved" errors so checkout still works once the store is approved.
   */
  private async publishIfNeeded(publish: () => Promise<unknown>): Promise<void> {
    try {
      await publish();
    } catch (e: any) {
      console.warn(
        'Waffo product publish skipped (already usable or store not approved):',
        e?.message || e
      );
    }
  }

  // --- Create payment (checkout session) ---

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    const client = await this.getClient();
    const productId = await this.resolveProductId(order);
    const currency = (order.price?.currency || 'USD').toUpperCase();

    const session = await client.checkout.createSession({
      productId,
      currency,
      buyerEmail: order.customer?.email || undefined,
      successUrl: order.successUrl,
      // Carry our order no through to webhooks so payments can be matched.
      orderMerchantExternalId: order.orderNo || undefined,
      metadata: order.metadata as Record<string, string> | undefined,
    });

    return {
      provider: this.name,
      checkoutParams: {
        productId,
        currency,
        buyerEmail: order.customer?.email,
        successUrl: order.successUrl,
        orderMerchantExternalId: order.orderNo,
      },
      checkoutInfo: {
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
      },
      checkoutResult: session,
      metadata: order.metadata || {},
    };
  }

  // Waffo has no server-side "get session" endpoint; the synchronous callback
  // returns a neutral session and order completion is driven by webhooks.
  async getPaymentSession(): Promise<PaymentSession> {
    return { provider: this.name };
  }

  // --- Webhook ---

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const signature = req.headers.get('x-waffo-signature') || '';
    if (!rawBody || !signature) {
      throw new Error('Invalid webhook request');
    }

    const { verifyWebhook } = await import('@waffo/pancake-ts');

    let event: any;
    try {
      event = verifyWebhook(rawBody, signature);
    } catch (e: any) {
      throw new Error(
        `Invalid webhook signature: ${e?.message || 'verification failed'}`
      );
    }

    const data = event?.data || {};
    const eventType = this.mapEventType(event?.eventType);
    if (!eventType) {
      throw new WebhookIgnoredError(
        `No handler for waffo event: ${event?.eventType}`
      );
    }

    const paymentSession = this.buildPaymentSession(eventType, event, data);

    return {
      eventType,
      eventResult: event,
      paymentSession,
    };
  }

  private mapEventType(
    type: string | undefined
  ): PaymentEventType | undefined {
    switch (type) {
      case 'order.completed':
      case 'subscription.activated':
        return PaymentEventType.PAYMENT_SUCCESS;
      case 'subscription.payment_succeeded':
        return PaymentEventType.PAYMENT_SUCCESS;
      case 'subscription.canceling':
      case 'subscription.uncanceled':
      case 'subscription.updated':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'subscription.canceled':
        return PaymentEventType.SUBSCRIBE_CANCELED;
      default:
        // subscription.expired / past_due / closed, refund.*, etc.
        return undefined;
    }
  }

  private buildPaymentSession(
    eventType: PaymentEventType,
    event: any,
    data: any
  ): PaymentSession {
    const isSubscriptionEvent = String(event?.eventType || '').startsWith(
      'subscription'
    );

    const cycleType =
      eventType === PaymentEventType.PAYMENT_SUCCESS &&
      event?.eventType === 'subscription.payment_succeeded'
        ? SubscriptionCycleType.RENEWAL
        : SubscriptionCycleType.CREATE;

    const paymentInfo: PaymentInfo = {
      description: data.productName,
      transactionId: data.paymentId || data.orderId,
      amount: parseFloat(data.amount) || 0,
      currency: data.currency,
      paymentAmount: parseFloat(data.total || data.amount) || 0,
      paymentCurrency: data.currency,
      paymentEmail: data.buyerEmail,
      paidAt: data.paymentDate ? new Date(data.paymentDate) : new Date(),
      subscriptionCycleType: cycleType,
    };

    const session: PaymentSession = {
      provider: this.name,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentInfo,
      // Keep our order no in the result so handleCheckoutSuccess can match.
      paymentResult: {
        ...event,
        orderMerchantExternalId: data.orderMerchantExternalId,
        orderNo: data.orderMerchantExternalId,
      },
      metadata: data.orderMetadata,
    };

    if (isSubscriptionEvent) {
      session.subscriptionId = data.orderId;
      session.subscriptionInfo = this.buildSubscriptionInfo(data);
      session.subscriptionResult = data;
    }

    return session;
  }

  private buildSubscriptionInfo(data: any): SubscriptionInfo {
    const interval = this.mapInterval(data.billingPeriod);

    const info: SubscriptionInfo = {
      subscriptionId: data.orderId,
      productId: '',
      description: data.productName,
      amount: parseFloat(data.amount) || 0,
      currency: data.currency,
      interval,
      intervalCount: 1,
      currentPeriodStart: data.currentPeriodStart
        ? new Date(data.currentPeriodStart)
        : new Date(),
      currentPeriodEnd: data.currentPeriodEnd
        ? new Date(data.currentPeriodEnd)
        : new Date(),
      status: this.mapSubscriptionStatus(data.orderStatus),
      metadata: data.orderMetadata,
    };

    if (data.canceledAt) {
      info.canceledAt = new Date(data.canceledAt);
    }

    return info;
  }

  private mapInterval(
    billingPeriod: string | undefined
  ): PaymentInterval {
    switch (billingPeriod) {
      case 'weekly':
        return PaymentInterval.WEEK;
      case 'monthly':
        return PaymentInterval.MONTH;
      case 'quarterly':
        return PaymentInterval.MONTH;
      case 'yearly':
        return PaymentInterval.YEAR;
      default:
        return PaymentInterval.MONTH;
    }
  }

  private mapSubscriptionStatus(
    status: string | undefined
  ): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceling':
        return SubscriptionStatus.PENDING_CANCEL;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'past_due':
        return SubscriptionStatus.PAUSED;
      case 'closed':
      case 'expired':
        return SubscriptionStatus.EXPIRED;
      case 'pending':
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }

  // --- Cancel subscription ---

  async cancelSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession> {
    const client = await this.getClient();
    const result = await client.orders.cancelSubscription({
      orderId: subscriptionId,
    });

    const status = this.mapSubscriptionStatus(result.status as string);

    return {
      provider: this.name,
      subscriptionId,
      subscriptionInfo: {
        subscriptionId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        status,
        canceledAt: new Date(),
        canceledReason: 'Canceled by user',
        canceledReasonType: 'user_request',
      },
      subscriptionResult: result,
    };
  }
}

/**
 * Create Waffo provider with configs.
 */
export function createWaffoProvider(configs: WaffoConfigs): WaffoProvider {
  return new WaffoProvider(configs);
}
