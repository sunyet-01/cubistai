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

const KIE_BASE = 'https://api.kie.ai';
const KIE_CREATE = `${KIE_BASE}/api/v1/jobs/createTask`;
const KIE_RECORD = `${KIE_BASE}/api/v1/jobs/recordInfo`;

/**
 * Kie.ai provider — ByteDance-ecosystem model aggregator (Chinese-friendly
 * payments: WeChat/Alipay). Async task model:
 *   createTask → task_id → poll recordInfo → state success + resultUrls.
 * Media files are kept 14 days, so results are downloaded & persisted via
 * uploadFile (R2/local) as soon as they're ready.
 */
export interface KieConfigs extends AIConfigs {
  apiKey: string;
  uploadFile?: UploadFileFunction;
  uuid?: UuidFunction;
}

export class KieProvider implements AIProvider {
  readonly name = 'kie';
  configs: KieConfigs;

  constructor(configs: KieConfigs) {
    this.configs = configs;
  }

  private getUuid(): string {
    return (this.configs.uuid || defaultUuid)();
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.configs.apiKey}`,
      'Content-Type': 'application/json',
    };
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

    const input: Record<string, unknown> = {
      prompt,
      // Stable, good-quality defaults
      aspect_ratio: '1:1',
      quality: 'high',
      output_format: 'png',
    };

    // Image-to-image / editing
    const imageInputs: string[] = options?.image_input || [];
    if (imageInputs.length > 0) {
      input.image_urls = imageInputs;
    }

    const resp = await fetch(KIE_CREATE, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, input }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.code !== 200) {
      throw new Error(
        `Kie createTask failed (${resp.status}): ${data.msg || JSON.stringify(data)}`
      );
    }

    const taskId = data.data?.taskId;
    if (!taskId) {
      throw new Error(`Kie createTask returned no taskId: ${JSON.stringify(data)}`);
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId,
      taskInfo: {},
      taskResult: data,
    };
  }

  async query({
    taskId,
  }: {
    taskId: string;
    mediaType?: AIMediaType;
  }): Promise<AITaskResult> {
    const url = `${KIE_RECORD}?taskId=${encodeURIComponent(taskId)}`;
    const resp = await fetch(url, { method: 'GET', headers: this.headers() });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || data.code !== 200) {
      return {
        taskStatus: AITaskStatus.FAILED,
        taskId,
        taskInfo: {
          status: 'fail',
          errorMessage: data.msg || `Kie recordInfo failed (${resp.status})`,
        },
      };
    }

    const info = data.data || {};
    const state: string = info.state || 'processing';
    const failMsg: string = info.failMsg || '';

    let images: AIImage[] | undefined;
    if (state === 'success') {
      const urls = parseResultUrls(info.resultJson);
      if (urls.length > 0) {
        images = [];
        for (const url of urls) {
          images.push({
            id: this.getUuid(),
            createTime: new Date(),
            imageType: 'image/png',
            imageUrl: await this.persistUrl(url),
          });
        }
      }
    }

    return {
      taskStatus: mapKieStatus(state),
      taskId,
      taskInfo: {
        images,
        status: state,
        errorCode: '',
        errorMessage: failMsg,
        createTime: new Date(),
      },
      taskResult: info,
    };
  }

  /**
   * Kie keeps generated media for 14 days only — download & re-upload to
   * our storage (R2/local) so URLs stay valid forever.
   */
  private async persistUrl(url: string): Promise<string> {
    if (!this.configs.uploadFile || !url.startsWith('http')) return url;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return url;
      const buf = Buffer.from(await resp.arrayBuffer());
      const contentType = resp.headers.get('content-type') || 'image/png';
      const ext = contentType.split('/')[1]?.split('+')[0] || 'png';
      const result = await this.configs.uploadFile({
        body: buf,
        key: `kie/image/${this.getUuid()}.${ext}`,
        contentType,
      });
      if (result?.url) return result.url;
    } catch (e) {
      console.error('Kie persistUrl failed, keeping original URL:', e);
    }
    return url;
  }
}

function parseResultUrls(resultJson: string): string[] {
  try {
    const parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    if (Array.isArray(parsed?.resultUrls)) return parsed.resultUrls.filter(Boolean);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (typeof parsed?.url === 'string') return [parsed.url];
  } catch {
    // fall through
  }
  return [];
}

function mapKieStatus(state: string): AITaskStatus {
  switch (state) {
    case 'success':
      return AITaskStatus.SUCCESS;
    case 'fail':
      return AITaskStatus.FAILED;
    case 'waiting':
      return AITaskStatus.PENDING;
    case 'queuing':
    case 'generating':
    case 'processing':
      return AITaskStatus.PROCESSING;
    default:
      return AITaskStatus.PROCESSING;
  }
}
