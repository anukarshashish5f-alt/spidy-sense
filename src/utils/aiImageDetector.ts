export type ImageOriginVerdict = 'ai' | 'real' | 'uncertain';

export interface AiImageScores {
  ai: number;
  real: number;
}

type ModelPrediction = {
  label: string;
  score: number;
};

type ImageClassifier = (input: string) => Promise<ModelPrediction[]>;

type TransformersModule = {
  pipeline: (
    task: 'image-classification',
    model: string,
    options?: { dtype?: string; revision?: string }
  ) => Promise<ImageClassifier>;
};

const MODEL_ID = 'onnx-community/ai-image-detect-distilled-ONNX';
const MODEL_REVISION = '7f067e23521eeb6d6525221af82c613fb746aaff';
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

let classifierPromise: Promise<ImageClassifier> | null = null;

async function loadClassifier(): Promise<ImageClassifier> {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      // Load the browser runtime on demand so the initial page stays lightweight.
      const module = await import(/* @vite-ignore */ TRANSFORMERS_CDN) as TransformersModule;
      return module.pipeline('image-classification', MODEL_ID, {
        dtype: 'q4',
        revision: MODEL_REVISION,
      });
    })().catch((error) => {
      classifierPromise = null;
      throw error;
    });
  }

  return classifierPromise;
}

/**
 * Runs a pretrained binary image classifier in the visitor's browser.
 * The first run downloads the runtime/model files; later runs may use the cache.
 */
export async function detectAiImage(file: File): Promise<AiImageScores> {
  const classifier = await loadClassifier();
  const objectUrl = URL.createObjectURL(file);

  try {
    const predictions = await classifier(objectUrl);
    const scores: AiImageScores = { ai: 0, real: 0 };

    for (const prediction of predictions) {
      const label = prediction.label.toLowerCase();
      if (label.includes('fake') || label.includes('ai')) {
        scores.ai = prediction.score;
      } else if (label.includes('real')) {
        scores.real = prediction.score;
      }
    }

    if (!predictions.length || (scores.ai === 0 && scores.real === 0)) {
      throw new Error('The AI detector returned labels it did not recognize. Please try again later.');
    }

    return scores;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
