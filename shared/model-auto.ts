export const AUTO_MODEL_PROVIDER = 'studio-auto'
export const AUTO_MODEL_ID = 'auto'

export type AutoModelSelection = {
    provider: typeof AUTO_MODEL_PROVIDER
    modelId: typeof AUTO_MODEL_ID
}

export function isAutoModelSelection(
    model: { provider?: string | null; modelId?: string | null } | null | undefined,
): model is AutoModelSelection {
    return model?.provider === AUTO_MODEL_PROVIDER && model?.modelId === AUTO_MODEL_ID
}

export function autoModelSelection(): AutoModelSelection {
    return {
        provider: AUTO_MODEL_PROVIDER,
        modelId: AUTO_MODEL_ID,
    }
}
