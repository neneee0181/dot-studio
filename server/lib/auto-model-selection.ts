import type { RuntimeModelCatalogEntry } from '../../shared/model-variants.js'
import type { ModelSelection } from '../../shared/model-types.js'

export type AutoModelSelectionInput = {
    message: string
    models: RuntimeModelCatalogEntry[]
    requiresToolCall?: boolean
    requiresAttachment?: boolean
}

type Candidate = RuntimeModelCatalogEntry & { score: number }

const LIGHT_MODEL_HINTS = [
    'nano',
    'mini',
    'flash',
    'haiku',
    'small',
    'lite',
    'fast',
]

const HEAVY_MODEL_HINTS = [
    'pro',
    'opus',
    'sonnet',
    'gpt-5',
    'gpt-4',
    'large',
    'max',
]

const NON_CHAT_MODEL_HINTS = [
    'embed',
    'embedding',
    'image',
    'audio',
    'tts',
    'transcribe',
    'moderation',
    'rerank',
]

function modelText(model: RuntimeModelCatalogEntry) {
    return `${model.provider} ${model.id} ${model.name}`.toLowerCase()
}

function isNonChatModel(model: RuntimeModelCatalogEntry) {
    const text = modelText(model)
    return NON_CHAT_MODEL_HINTS.some((hint) => text.includes(hint))
}

function normalizedCost(model: RuntimeModelCatalogEntry) {
    const input = model.cost?.input
    const output = model.cost?.output
    if (typeof input === 'number' || typeof output === 'number') {
        return (input || 0) + (output || 0) * 3
    }

    const text = modelText(model)
    let inferred = 100
    if (LIGHT_MODEL_HINTS.some((hint) => text.includes(hint))) inferred -= 45
    if (HEAVY_MODEL_HINTS.some((hint) => text.includes(hint))) inferred += 35
    if (model.reasoning) inferred += 10
    return inferred
}

function complexityScore(message: string) {
    const text = message.trim()
    const lower = text.toLowerCase()
    let score = 0

    if (text.length > 500) score += 1
    if (text.length > 1_500) score += 1
    if (/```|diff --git|stack trace|traceback|exception|error:/i.test(text)) score += 1
    if (/\b(refactor|implement|debug|architecture|design|analyze|investigate|optimize|migrate|test)\b/i.test(lower)) score += 1

    return score
}

function candidateModels(input: AutoModelSelectionInput) {
    return input.models.filter((model) => {
        if (!model.connected || isNonChatModel(model)) return false
        if (input.requiresToolCall && !model.toolCall) return false
        if (input.requiresAttachment && !model.attachment) return false
        if (model.modalities.input.length > 0 && !model.modalities.input.includes('text')) return false
        return true
    })
}

export function selectAutoRuntimeModel(input: AutoModelSelectionInput): ModelSelection {
    const candidates = candidateModels(input)
    if (candidates.length === 0) {
        return null
    }

    const complexity = complexityScore(input.message)
    const scored: Candidate[] = candidates.map((model) => {
        let score = normalizedCost(model)
        const text = modelText(model)

        if (complexity <= 1) {
            if (LIGHT_MODEL_HINTS.some((hint) => text.includes(hint))) score -= 20
            if (model.reasoning) score += 15
        } else {
            if (model.reasoning) score -= 18
            if (model.context >= 100_000) score -= 8
            if (HEAVY_MODEL_HINTS.some((hint) => text.includes(hint))) score -= 8
            if (LIGHT_MODEL_HINTS.some((hint) => text.includes(hint)) && complexity >= 2) score += 30
        }

        if (input.requiresToolCall && model.toolCall) score -= 5
        if (input.requiresAttachment && model.attachment) score -= 5

        return { ...model, score }
    })

    scored.sort((left, right) => (
        left.score - right.score
        || left.providerName.localeCompare(right.providerName)
        || left.name.localeCompare(right.name)
    ))

    const selected = scored[0]
    return {
        provider: selected.provider,
        modelId: selected.id,
    }
}
