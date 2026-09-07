import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getStorage } from '@/modules/storage/service';
import { GeminiProvider } from '@/core/ai/gemini';
import { KieProvider } from '@/core/ai/kie';
import { OpenRouterProvider } from '@/core/ai/openrouter';
import { ReplicateProvider } from '@/core/ai/replicate';
import { ContentSafetyScanner } from '@/core/ai/content-safety';
import { AIMediaType } from '@/core/ai/types';
import { getAllConfigs } from '@/modules/config/service';
import {
  AITaskStatus,
  createTask,
  updateTask,
} from '@/modules/ai-tasks/service';
import { ensureDailyFreeCredits } from '@/modules/credits/service';
import { respData, respErr } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { getLocale } from '@/paraglide/runtime.js';

/**
 * Resolve the credit cost of one image generation for the given model.
 * Admin-configurable:
 *  - image_credit_cost: default cost per image (fallback 12)
 *  - model_credit_costs: JSON per-model override, e.g.
 *    {"google/nano-banana-2": 8, "black-forest-labs/flux-2-max": 25}
 */
function getImageCreditCost(
  configs: Record<string, string>,
  model: string
): number {
  const def = parseInt(configs.image_credit_cost || '') || 12;
  const raw = configs.model_credit_costs;
  if (raw) {
    try {
      const map = JSON.parse(raw) as Record<string, string | number>;
      const v = map[model];
      if (v !== undefined) return parseInt(String(v)) || def;
    } catch {
      // invalid JSON — use default
    }
  }
  return def;
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 3000,
    keyPrefix: 'editor-generate',
  });
  if (limited) return limited;

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json();
    const {
      mode = 'edit',
      prompt,
      image_url,
      reference_images = [],
      model = 'gemini-3.1-flash-image-preview',
    } = body;

    // Text-to-image (no photo) or image edit (photo required)
    const hasImage = Boolean(image_url);
    if (!hasImage && !prompt?.trim()) {
      return respErr('prompt is required');
    }
    if (hasImage && mode !== 'edit' && !prompt?.trim()) {
      return respErr('prompt is required for this mode');
    }

    // Resolve full image URL for local uploads
    const resolvedImageUrl = image_url?.startsWith('http')
      ? image_url
      : `${process.env.VITE_APP_URL || 'http://localhost:3000'}${image_url || ''}`;

    const resolvedRefs = (reference_images as string[]).map((url) =>
      url.startsWith('http')
        ? url
        : `${process.env.VITE_APP_URL || 'http://localhost:3000'}${url}`
    );

    // Build prompt based on mode
    let fullPrompt = prompt;
    if (hasImage) {
      switch (mode) {
        case 'edit':
          fullPrompt = `Edit the uploaded image based on this instruction: ${prompt}. ${resolvedRefs.length ? 'Use the reference images as style/composition guidance.' : ''} Keep the subject and composition of the original image intact, only modify what is described in the prompt.`;
          break;
        case 'style':
          fullPrompt = `Transform the uploaded image to match the artistic style shown in the reference image${resolvedRefs.length > 1 ? 's' : ''}. Preserve the original subject, composition, and colors while applying the reference style. ${prompt || ''}`;
          break;
        case 'remove':
          fullPrompt = `Remove unwanted elements from the uploaded image. ${prompt || 'Remove the background and make it transparent/plain.'} Clean up any artifacts left by the removal.`;
          break;
        case 'upscale':
          fullPrompt = `Enhance and upscale the uploaded image. Improve sharpness, detail, and resolution while preserving the original content exactly as it is. ${prompt || ''}`;
          break;
      }
    } else {
      // Pure text-to-image
      fullPrompt = `${prompt}. High quality, high resolution, photorealistic detail, visually stunning.`;
    }

    // Determine which provider to use based on model
    const configs = await getAllConfigs();

    const isGemini = model.startsWith('gemini'); // native Google API
    const hasSlash = model.includes('/'); // e.g. bytedance-seed/seedream-4.5

    // Pre-generation content safety — built-in filter, then Waffo SDK
    // (merchant ID + private key from env) or HTTP scan-prompt as fallback.
    // Runs BEFORE the provider is resolved so the prompt is always screened
    // even when no model API key is configured yet.
    const contentSafety = new ContentSafetyScanner({
      apiKey: configs.content_safety_api_key,
      endpoint: configs.content_safety_endpoint,
      semantic: 'enforce',
      waffoMerchantId: configs.waffo_merchant_id,
      waffoPrivateKey: configs.waffo_private_key,
    });
    const verdict = await contentSafety.scan(fullPrompt!, getLocale());
    if (verdict.action !== 'allow') {
      return respErr(
        verdict.action === 'block'
          ? 'content_blocked'
          : 'content_review'
      );
    }

    // Shared uploader: persists generated images to storage or local /uploads
    const storage = await getStorage();
    const uploadFile = storage
      ? async (opts: { body: Buffer; key: string; contentType: string }) => {
          const result = await storage.uploadFile({
            body: opts.body,
            key: opts.key,
            contentType: opts.contentType,
            disposition: 'inline',
          });
          return { url: result.url || '' };
        }
      : async (opts: { body: Buffer; key: string; contentType: string }) => {
          // Cloudflare Workers has no local disk — bail so providers fall back
          // to their own persistence (data URL / original remote URL).
          const isWorker =
            (typeof navigator !== 'undefined' &&
              navigator.userAgent === 'Cloudflare-Workers') ||
            (typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis);
          if (isWorker) return { url: '' };
          // Local fallback: save to public/uploads
          const { mkdir, writeFile } = await import('node:fs/promises');
          const path = await import('node:path');
          const dir = path.join(process.cwd(), 'public', 'uploads');
          await mkdir(dir, { recursive: true });
          const filename = opts.key.split('/').pop() || opts.key;
          await writeFile(path.join(dir, filename), opts.body);
          return { url: `/uploads/${filename}` };
        };

    let provider;
    let providerName = '';
    if (isGemini) {
      const apiKey = configs.openai_api_key || '';
      if (!apiKey) {
        return respErr(
          'Gemini API key not configured. Please configure it in Admin > Settings > AI.'
        );
      }
      providerName = 'gemini';
      provider = new GeminiProvider({ apiKey, uploadFile });
    } else if (hasSlash && configs.kie_api_key) {
      // Kie.ai (WeChat/Alipay friendly) first for provider/model slugs —
      // GPT Image, Seedream, Nano Banana, FLUX via one ByteDance-ecosystem key.
      providerName = 'kie';
      provider = new KieProvider({
        apiKey: configs.kie_api_key,
        uploadFile,
      });
    } else if (hasSlash && configs.openrouter_api_key) {
      // OpenRouter next for provider/model slugs.
      providerName = 'openrouter';
      provider = new OpenRouterProvider({
        apiKey: configs.openrouter_api_key,
        uploadFile,
      });
    } else if (hasSlash) {
      const apiToken = configs.replicate_api_token || '';
      if (!apiToken) {
        return respErr(
          'Replicate API token not configured. Please configure it in Admin > Settings > AI.'
        );
      }
      providerName = 'replicate';
      provider = new ReplicateProvider({ apiToken });
    } else {
      return respErr(`Unsupported model: ${model}`);
    }

    const imageInputs = hasImage ? [resolvedImageUrl, ...resolvedRefs] : [];

    // Free-tier daily allowance: lazy-grant 10 credits/day for users without
    // an active subscription, right before the first generation of the day.
    await ensureDailyFreeCredits({
      userId: session.user.id,
      userEmail: session.user.email,
    }).catch((err: any) => {
      console.error('ensureDailyFreeCredits failed:', err);
    });

    // Charge credits up front (per-model cost). createTask inserts the AI task
    // and consumes credits atomically; a failed generation revokes them.
    const costCredits = getImageCreditCost(configs, model);
    let aiTaskId: string | null = null;
    if (costCredits > 0) {
      try {
        const task = await createTask({
          userId: session.user.id,
          userEmail: session.user.email,
          mediaType: 'image',
          provider: providerName,
          model,
          prompt: fullPrompt!,
          costCredits,
        });
        aiTaskId = task?.id || null;
      } catch (e: any) {
        if (e?.message === 'Insufficient credits') {
          return respErr('Insufficient credits');
        }
        throw e;
      }
    }

    const settle = (status: AITaskStatus, taskResult?: any) => {
      if (aiTaskId) {
        return updateTask({ taskId: aiTaskId, status, taskResult }).catch(
          (err: any) => {
            console.error('failed to settle AI task:', err);
          }
        );
      }
      return Promise.resolve();
    };

    try {
      const result = await provider.generate({
        params: {
          mediaType: AIMediaType.IMAGE,
          model,
          prompt: fullPrompt!,
          options: {
            image_input: imageInputs,
          },
        },
      });

      // For Gemini, result is synchronous
      if (result.taskInfo?.images?.[0]?.imageUrl) {
        await settle(AITaskStatus.SUCCESS, {
          image_url: result.taskInfo.images[0].imageUrl,
        });
        return respData({
          task_id: result.taskId,
          image_url: result.taskInfo.images[0].imageUrl,
        });
      }

      // For Replicate, we need to poll
      if (result.taskId && provider.query) {
        const maxAttempts = 60;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await provider.query({
            taskId: result.taskId,
            mediaType: AIMediaType.IMAGE,
          });

          if (status.taskInfo?.images?.[0]?.imageUrl) {
            await settle(AITaskStatus.SUCCESS, {
              image_url: status.taskInfo.images[0].imageUrl,
            });
            return respData({
              task_id: result.taskId,
              image_url: status.taskInfo.images[0].imageUrl,
            });
          }

          if (
            status.taskStatus === 'failed' ||
            status.taskStatus === 'canceled'
          ) {
            await settle(AITaskStatus.FAILED, status.taskInfo);
            return respErr(
              status.taskInfo?.errorMessage || 'Image generation failed'
            );
          }
        }
        await settle(AITaskStatus.FAILED);
        return respErr('Generation timed out. Please try again.');
      }

      await settle(AITaskStatus.FAILED);
      return respErr('No image generated');
    } catch (e: any) {
      // Failed generation → revoke the charged credits.
      await settle(AITaskStatus.FAILED);
      throw e;
    }
  } catch (e: any) {
    console.error('editor generate failed:', e);
    return respErr(e?.message || 'generation failed');
  }
}

export const Route = createFileRoute('/api/editor/generate')({
  server: {
    handlers: { POST },
  },
});
