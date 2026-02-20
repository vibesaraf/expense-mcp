export const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    ],
  },
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    ],
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-1.5-pro-latest", label: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash-latest", label: "Gemini 1.5 Flash" },
      { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Exp" },
    ],
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;
export type ModelId = string;

export interface ModelConfig {
  provider: ProviderId;
  modelId: ModelId;
}

export const DEFAULT_PROVIDER: ProviderId = "anthropic";
export const DEFAULT_MODEL_ID = PROVIDERS[DEFAULT_PROVIDER].models[0].id;
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: DEFAULT_PROVIDER,
  modelId: DEFAULT_MODEL_ID,
};

export function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS;
}

export function resolveModelConfig(model?: Partial<ModelConfig>): ModelConfig {
  if (!model?.provider || !isProviderId(model.provider)) {
    return DEFAULT_MODEL_CONFIG;
  }

  const provider = model.provider;
  const modelId =
    model.modelId &&
    PROVIDERS[provider].models.some((m) => m.id === model.modelId)
      ? model.modelId
      : PROVIDERS[provider].models[0].id;

  return { provider, modelId };
}
