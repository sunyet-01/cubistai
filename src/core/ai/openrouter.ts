import {
  AIConfigs,
  AIGenerateParams,
  AIImage,
  AIMediaType,
  AIProvider,
  AITaskResult,
  AITaskStatus,
  UploadFileFunction,
  UuidFunction,
} from './types';

const defaultUuid: UuidFunction = () => crypto.randomUUID();

/**
 * OpenRouter provider — aggregates many image models (Seedream 4.0/4.5,
 * GPT Image 2, Nano Banana, FLUX.2, ...) behind one OpenAI-compatible key.
 *
 * Uses the dedicated Image API: POST https://openrouter.ai/api/v1/images
 */
export interface OpenRouterConfigs extends AIConfigs {
  apiKey: string;
  uploadFile?: UploadFileFunction;
  uuid?: UuidFunction;
}

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';
  configs: OpenRouterConfigs;

  constructor(configs: OpenRouterConfigs) {
    this.configs = configs;
  }

  private getUuid(): string {
    return (this.configs.uuid || defaultUuid)();
  }

  async generate({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    const { mediaType, model, prompt, options } = params;

    if (mediaType !== AIMediaType.IMAGE) {
      throw new Error(`mediaType not supported: ${mediaType}`);
    }
    if (!model) throw new Error('model is required');
    if (!prompt) throw new Error('prompt is required');

    const apiUrl = 'https://openrouter.ai/api/v1/images';

    const body: Record<string, unknown> = {
      model,
      prompt,
      // Better quality for production-facing generations
      quality: 'high',
      output_format: 'png',
    };

    // Reference images → image-to-image / editing
    const imageInputs: string[] = options?.image_input || [];
    if (imageInputs.length > 0) {
      body.input_references = imageInputs.map((url) => ({
        type: 'image_url',
        image_url: { url },
      }));
    }

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.configs.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(
        `OpenRouter request failed with status: ${resp.status}, body: ${errorText}`
      );
    }

    const data = await resp.json();
    const taskId = this.getUuid();

    if (!data?.data || data.data.length === 0) {
      throw new Error('OpenRouter returned no images');
    }

    const first = data.data[0];
    const b64 = first.b64_json;
    const mediaTypeOut: string = first.media_type || 'image/png';

    if (!b64) {
      throw new Error('OpenRouter returned no image data');
    }

    const buffer = Buffer.from(b64, 'base64');
    const ext = mediaTypeOut.split('/')[1]?.split('+')[0] || 'png';
    const key = `openrouter/image/${this.getUuid()}.${ext}`;

    let imageUrl = `data:${mediaTypeOut};base64,${b64}`;

    // Persist to storage/local uploads so the URL is shareable & lightweight
    if (this.configs.uploadFile) {
      try {
        const uploadResult = await this.configs.uploadFile({
          body: buffer,
          key,
          contentType: mediaTypeOut,
        });
        if (uploadResult?.url) imageUrl = uploadResult.url;
      } catch (e) {
        console.error('OpenRouter upload failed, falling back to data URL:', e);
      }
    }

    const image: AIImage = {
      id: this.getUuid(),
      createTime: new Date(),
      imageType: mediaTypeOut,
      imageUrl,
    };

    return {
      taskStatus: AITaskStatus.SUCCESS,
      taskId,
      taskInfo: {
        images: [image],
        status: 'success',
        createTime: new Date(),
      },
      taskResult: data,
    };
  }
}
