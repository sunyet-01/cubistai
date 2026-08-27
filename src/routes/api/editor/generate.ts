import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getStorage } from '@/modules/storage/service';
import { GeminiProvider } from '@/core/ai/gemini';
import { KieProvider } from '@/core/ai/kie';
import { OpenRouterProvider } from '@/core/ai/openrouter';
import { ReplicateProvider } from '@/core/ai/replicate';
import { AIMediaType } from '@/core/ai/types';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';

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
    if (isGemini) {
      const apiKey = configs.openai_api_key || '';
      if (!apiKey) {
        return respErr(
          'Gemini API key not configured. Please configure it in Admin > Settings > AI.'
        );
      }
      provider = new GeminiProvider({ apiKey, uploadFile });
    } else if (hasSlash && configs.kie_api_key) {
      // Kie.ai (WeChat/Alipay friendly) first for provider/model slugs —
      // GPT Image, Seedream, Nano Banana, FLUX via one ByteDance-ecosystem key.
      provider = new KieProvider({
        apiKey: configs.kie_api_key,
        uploadFile,
      });
    } else if (hasSlash && configs.openrouter_api_key) {
      // OpenRouter next for provider/model slugs.
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
      provider = new ReplicateProvider({ apiToken });
    } else {
      return respErr(`Unsupported model: ${model}`);
    }

    const imageInputs = hasImage ? [resolvedImageUrl, ...resolvedRefs] : [];

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
          return respData({
            task_id: result.taskId,
            image_url: status.taskInfo.images[0].imageUrl,
          });
        }

        if (
          status.taskStatus === 'failed' ||
          status.taskStatus === 'canceled'
        ) {
          return respErr(
            status.taskInfo?.errorMessage || 'Image generation failed'
          );
        }
      }
      return respErr('Generation timed out. Please try again.');
    }

    return respErr('No image generated');
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
