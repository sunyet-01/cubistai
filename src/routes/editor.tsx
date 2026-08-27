'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import {
  ArrowRight,
  Download,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { BeforeAfterSlider } from '@/components/before-after-slider';
import { ImageUploader, type ImageUploaderValue } from '@/components/image-uploader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiPost } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { cn } from '@/lib/utils';

type EditorMode = 'edit' | 'style' | 'remove' | 'upscale';

interface GenerateResult {
  task_id: string;
  image_url: string;
}

function EditorPage() {
  const search = useSearch({ strict: false }) as { prompt?: string };
  const [mode, setMode] = useState<EditorMode>('edit');
  const [prompt, setPrompt] = useState(search.prompt ?? '');
  const [photoItems, setPhotoItems] = useState<ImageUploaderValue[]>([]);
  const [refItems, setRefItems] = useState<ImageUploaderValue[]>([]);
  const [model, setModel] = useState('google/nano-banana-2');
  const [result, setResult] = useState<{
    before: string;
    after: string;
  } | null>(null);

  const hasPhoto = photoItems.some((i) => i.status === 'uploaded' && i.url);
  const photoUrl = photoItems.find((i) => i.status === 'uploaded' && i.url)?.url;

  const hasPhotoOrPrompt = hasPhoto || prompt.trim().length > 0;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const refUrls = refItems
        .filter((i) => i.status === 'uploaded' && i.url)
        .map((i) => i.url as string);

      return apiPost<GenerateResult>('/api/editor/generate', {
        mode,
        prompt,
        image_url: photoUrl,
        reference_images: refUrls,
        model,
      });
    },
    onSuccess: (data) => {
      setResult({
        before: photoUrl ?? '',
        after: data.image_url,
      });
    },
    onError: (err: any) => {
      toast.error(err?.message || m['editor.error.generate_failed']());
    },
  });

  const handleGenerate = useCallback(() => {
    if (!photoUrl && !prompt.trim()) {
      toast.error(m['editor.error.no_prompt']());
      return;
    }
    if (mode !== 'edit' && !photoUrl) {
      toast.error(m['editor.error.no_photo']());
      return;
    }
    setResult(null);
    generateMutation.mutate();
  }, [photoUrl, prompt, mode, generateMutation]);

  const handleReset = () => {
    setResult(null);
    setPrompt('');
    setPhotoItems([]);
    setRefItems([]);
  };

  const handleDownload = () => {
    if (!result?.after) return;
    const a = document.createElement('a');
    a.href = result.after;
    a.download = `cubistai-${Date.now()}.png`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const modes: { id: EditorMode; label: string; icon: typeof Wand2 }[] = [
    { id: 'edit', label: m['editor.mode.edit'](), icon: Wand2 },
    { id: 'style', label: m['editor.mode.style'](), icon: Sparkles },
    { id: 'remove', label: m['editor.mode.remove'](), icon: X },
    { id: 'upscale', label: m['editor.mode.upscale'](), icon: ArrowRight },
  ];

  // Model IDs follow the active AI provider's catalog (Replicate owner/name
  // slugs here — see generate.ts routing: kie > openrouter > replicate).
  // GPT Image on Replicate needs a separate OpenAI key, so we lead with
  // Nano Banana 2 / Seedream 4.5 instead.
  const models = [
    { id: 'google/nano-banana-2', label: 'Nano Banana 2' },
    { id: 'bytedance/seedream-4.5', label: 'Seedream 4.5' },
    { id: 'google/nano-banana-pro', label: 'Nano Banana Pro' },
    { id: 'bytedance/seedream-5-lite', label: 'Seedream 5 Lite' },
    { id: 'black-forest-labs/flux-2-pro', label: 'FLUX.2 Pro' },
    { id: 'black-forest-labs/flux-2-max', label: 'FLUX.2 Max' },
  ];

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Page header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-gradient-brand">{m['editor.title']()}</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            {m['editor.subtitle']()}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Input panel */}
          <div className="space-y-6">
            {/* Mode selector */}
            <div className="flex flex-wrap gap-2">
              {modes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all',
                    mode === id
                      ? 'border-foreground/30 bg-foreground text-background'
                      : 'border-border bg-card hover:border-foreground/20'
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Photo upload */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Upload className="size-4" />
                {m['editor.photo.title']()}
              </h3>
              <p className="text-muted-foreground mb-3 text-xs">
                {m['editor.photo.description']()}
              </p>
              <ImageUploader
                allowMultiple={false}
                maxImages={1}
                maxSizeMB={20}
                onChange={setPhotoItems}
              />
            </div>

            {/* Reference images */}
            {mode !== 'upscale' && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <ImageIcon className="size-4" />
                  {m['editor.reference.title']()}
                </h3>
                <p className="text-muted-foreground mb-3 text-xs">
                  {m['editor.reference.description']()}
                </p>
                <ImageUploader
                  allowMultiple
                  maxImages={3}
                  maxSizeMB={10}
                  onChange={setRefItems}
                />
              </div>
            )}

            {/* Prompt */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-medium">
                {m['editor.prompt.title']()}
              </h3>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={m['editor.prompt.placeholder']()}
                className="min-h-[120px] resize-none"
                rows={5}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                {m['editor.prompt.hint']()}
              </p>
            </div>

            {/* Model selector */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-medium">
                {m['editor.model.title']()}
              </h3>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((md) => (
                    <SelectItem key={md.id} value={md.id}>
                      {md.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generate button */}
            <Button
              size="lg"
              className="w-full gap-2"
              disabled={!hasPhotoOrPrompt || generateMutation.isPending}
              onClick={handleGenerate}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {m['editor.generating']()}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {m['editor.generate']()}
                </>
              )}
            </Button>
          </div>

          {/* Right: Result panel */}
          <div className="flex flex-col gap-4">
            <div className="border-border bg-card sticky top-20 flex-1 rounded-2xl border p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {m['editor.result.title']()}
                </h3>
                {result && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleDownload}
                    >
                      <Download className="size-3.5" />
                      {m['editor.result.download']()}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleReset}
                    >
                      <RefreshCw className="size-3.5" />
                      {m['editor.result.reset']()}
                    </Button>
                  </div>
                )}
              </div>

              {result ? (
                result.before ? (
                  <BeforeAfterSlider
                    beforeSrc={result.before}
                    afterSrc={result.after}
                    beforeLabel={m['editor.result.before']()}
                    afterLabel={m['editor.result.after']()}
                    aspectRatio="1 / 1"
                    className="w-full"
                  />
                ) : (
                  <img
                    src={result.after}
                    alt="Generated"
                    className="aspect-square w-full rounded-xl border border-border object-cover"
                  />
                )
              ) : generateMutation.isPending ? (
                <div className="bg-muted/50 flex aspect-square flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
                  <Loader2 className="text-muted-foreground size-8 animate-spin" />
                  <p className="text-muted-foreground text-sm">
                    {m['editor.result.processing']()}
                  </p>
                </div>
              ) : (
                <div className="bg-muted/50 flex aspect-square flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
                  <ImageIcon className="text-muted-foreground size-12" />
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm font-medium">
                      {m['editor.result.empty_title']()}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {m['editor.result.empty_description']()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/editor')({
  validateSearch: (search: Record<string, unknown>) => ({
    prompt: typeof search.prompt === 'string' ? search.prompt : undefined,
  }),
  component: EditorPage,
});
