/**
 * Content safety — pre-generation prompt scanning.
 *
 * Three layers (first match wins):
 *  1. Built-in basic filter (always on): catches the most obvious violations
 *     of our Acceptable Use Policy (six prohibited categories) via a small
 *     bilingual keyword list. Intentionally conservative to avoid false
 *     positives on benign artistic prompts.
 *  2. Waffo Pancake SDK (preferred, server-side only): initialized with the
 *     merchant ID + RSA private key from env (WAFFO_MERCHANT_ID /
 *     WAFFO_PRIVATE_KEY); calls client.contentSafety.scanPrompt() which
 *     auto-signs the request. Only used when both env vars are set.
 *  3. Plain HTTP scan-prompt (fallback): POST {endpoint}/v1/actions/
 *     verification/scan-prompt with a bearer API key configured in
 *     Admin > Settings > AI.
 *
 * Policy: if a third-party service is unreachable we fail OPEN (log + allow)
 * so the product stays available — the built-in filter still guards obvious
 * cases. A definitive `block` verdict is never bypassed.
 */

export type ContentSafetyCategory =
  | 'sexual'
  | 'violence'
  | 'hate'
  | 'child_safety'
  | 'deepfake'
  | 'copyright';

export type ContentSafetyAction = 'allow' | 'block' | 'review';

export interface ContentSafetyVerdict {
  action: ContentSafetyAction;
  reasonCode: string;
  matchedCategories: string[];
  requestId?: string;
  source: 'basic' | 'waffo';
}

export interface ContentSafetyConfigs {
  /** Bearer API key for the HTTP scan-prompt endpoint (fallback mode). */
  apiKey?: string;
  /** Base URL of the HTTP scan service. Defaults to https://api.waffo.ai */
  endpoint?: string;
  /** Semantic scoring mode: 'off' | 'shadow' | 'enforce'. Defaults to 'enforce'. */
  semantic?: 'off' | 'shadow' | 'enforce';
  /** Request timeout in ms. Defaults to 5000. */
  timeoutMs?: number;
  /** Waffo Pancake merchant ID (SDK mode). */
  waffoMerchantId?: string;
  /** Waffo Pancake RSA private key, PEM (SDK mode). */
  waffoPrivateKey?: string;
}

const DEFAULT_ENDPOINT = 'https://api.waffo.ai';

/**
 * Built-in keyword filter. Lowercase matching for Latin scripts, direct
 * substring matching for CJK. Keys are the six AUP categories.
 */
const BASIC_FILTER: Record<ContentSafetyCategory, string[]> = {
  sexual: [
    'porn',
    'nsfw',
    'nude',
    'naked',
    'erotic',
    'sexual',
    'sex scene',
    'explicit sex',
    'penis',
    'vagina',
    '裸体',
    '裸照',
    '色情',
    '露骨',
    '淫秽',
    '性交',
    '成人内容',
  ],
  violence: [
    'gore',
    'torture',
    'mutilation',
    'bloodshed',
    'brutal killing',
    'snuff',
    '血腥',
    '酷刑',
    '肢解',
    '虐杀',
    '分尸',
  ],
  hate: [
    'racial slur',
    'hate speech',
    '种族主义',
    '仇恨言论',
    '纳粹礼',
  ],
  child_safety: [
    'loli',
    'shota',
    'child porn',
    'minor nudity',
    '未成年人色情',
    '儿童色情',
    '恋童',
    '幼女',
  ],
  deepfake: [
    'deepfake',
    'deep fake',
    'celebrity face swap',
    '不雅换脸',
    '伪造视频冒充',
  ],
  copyright: [
    'disney logo',
    'mickey mouse',
    'pokemon',
    'brand logo',
    '盗版',
    '仿冒品牌',
  ],
};

const CATEGORY_ORDER: ContentSafetyCategory[] = [
  'child_safety',
  'sexual',
  'violence',
  'hate',
  'deepfake',
  'copyright',
];

const SUPPORTED_LOCALES = ['en', 'zh', 'ja'];

export class ContentSafetyScanner {
  private configs: ContentSafetyConfigs;

  constructor(configs: ContentSafetyConfigs = {}) {
    this.configs = configs;
  }

  /** HTTP bearer-key mode enabled? */
  get httpEnabled(): boolean {
    return Boolean(this.configs.apiKey?.trim());
  }

  /** Waffo SDK mode enabled? */
  get sdkEnabled(): boolean {
    return Boolean(
      this.configs.waffoMerchantId?.trim() && this.configs.waffoPrivateKey?.trim()
    );
  }

  private normalizeLocale(locale: string): 'en' | 'zh' | 'ja' {
    return (SUPPORTED_LOCALES.includes(locale) ? locale : 'en') as 'en' | 'zh' | 'ja';
  }

  /** Layer 1 — built-in keyword filter (always runs, no network). */
  basicFilter(prompt: string): ContentSafetyCategory[] {
    const lower = prompt.toLowerCase();
    const matched: ContentSafetyCategory[] = [];
    for (const category of CATEGORY_ORDER) {
      const keywords = BASIC_FILTER[category];
      if (keywords.some((kw) => lower.includes(kw))) matched.push(category);
    }
    return matched;
  }

  /** Layer 2 — Waffo Pancake SDK (preferred). Returns null when unavailable. */
  private async scanWithSdk(
    prompt: string,
    locale: string
  ): Promise<ContentSafetyVerdict | null> {
    if (!this.sdkEnabled) return null;
    try {
      // Server-side only SDK (RSA signing); dynamic import keeps it out of the
      // client bundle and lets us degrade gracefully if the package is missing.
      const { WaffoPancake, ScanSemanticMode } = await import(
        '@waffo/pancake-ts'
      );
      const client = new WaffoPancake({
        merchantId: this.configs.waffoMerchantId!.trim(),
        privateKey: this.configs.waffoPrivateKey!.trim(),
      });
      const verdict = await client.contentSafety.scanPrompt({
        prompt,
        locale: this.normalizeLocale(locale),
        semantic: ScanSemanticMode.Enforce,
      });
      return {
        action:
          verdict.action === 'block'
            ? 'block'
            : verdict.action === 'review'
              ? 'review'
              : 'allow',
        reasonCode: verdict.reasonCode,
        matchedCategories: (verdict.matchedCategories || []) as string[],
        requestId: verdict.requestId,
        source: 'waffo',
      };
    } catch (e) {
      // SDK errors (bad key, network, provider failure) must never block the
      // whole product — log and fall through to the next layer.
      console.error(
        'Waffo SDK content safety scan failed, falling back:',
        e
      );
      return null;
    }
  }

  /** Layer 3 — plain HTTP scan-prompt (fallback). */
  private async scanWithHttp(
    prompt: string,
    locale: string
  ): Promise<ContentSafetyVerdict> {
    const endpoint = (
      this.configs.endpoint?.trim() || DEFAULT_ENDPOINT
    ).replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.configs.timeoutMs || 5000
    );

    try {
      const resp = await fetch(
        `${endpoint}/v1/actions/verification/scan-prompt`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.configs.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            locale: this.normalizeLocale(locale),
            semantic: this.configs.semantic || 'enforce',
          }),
          signal: controller.signal,
        }
      );

      const data = (await resp.json()) as {
        data?: {
          action?: string;
          reasonCode?: string;
          matchedCategories?: string[];
          requestId?: string;
        };
      };

      const verdict = data?.data || {};
      const action: ContentSafetyAction =
        verdict.action === 'block'
          ? 'block'
          : verdict.action === 'review'
            ? 'review'
            : 'allow';

      return {
        action,
        reasonCode: verdict.reasonCode || 'allowed',
        matchedCategories: (verdict.matchedCategories || []) as string[],
        requestId: verdict.requestId,
        source: 'waffo',
      };
    } catch (e) {
      // Fail-open on transport/parse errors — the third-party scan is an extra
      // safety layer, not a gate; the built-in filter above still applies.
      console.error(
        'Content safety scan unavailable, falling back to built-in filter:',
        e
      );
      return {
        action: 'allow',
        reasonCode: 'service_degraded',
        matchedCategories: [],
        source: 'basic',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Run the full safety pipeline for a prompt. `block` means do not generate;
   * `review` means hold/retry; `allow` means proceed.
   */
  async scan(prompt: string, locale: string): Promise<ContentSafetyVerdict> {
    // 1. Built-in filter first — no need to call an API for obvious violations.
    const basicHits = this.basicFilter(prompt);
    if (basicHits.length > 0) {
      return {
        action: 'block',
        reasonCode: 'restricted_content',
        matchedCategories: basicHits,
        source: 'basic',
      };
    }

    // 2. Waffo SDK (preferred when merchant ID + private key are configured).
    const sdkVerdict = await this.scanWithSdk(prompt, locale);
    if (sdkVerdict) return sdkVerdict;

    // 3. HTTP scan-prompt fallback.
    if (this.httpEnabled) return this.scanWithHttp(prompt, locale);

    // No external scanner configured.
    return {
      action: 'allow',
      reasonCode: 'allowed',
      matchedCategories: [],
      source: 'basic',
    };
  }
}
