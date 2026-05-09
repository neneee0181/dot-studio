import { describe, expect, it } from 'vitest'
import type { RuntimeModelCatalogEntry } from '../../shared/model-variants.js'
import { selectAutoRuntimeModel } from './auto-model-selection.js'

function model(partial: Partial<RuntimeModelCatalogEntry> & { provider: string; id: string }): RuntimeModelCatalogEntry {
    return {
        provider: partial.provider,
        providerName: partial.providerName || partial.provider,
        id: partial.id,
        name: partial.name || partial.id,
        connected: partial.connected ?? true,
        context: partial.context ?? 128_000,
        output: partial.output ?? 8_000,
        toolCall: partial.toolCall ?? true,
        reasoning: partial.reasoning ?? false,
        attachment: partial.attachment ?? false,
        temperature: partial.temperature ?? true,
        cost: partial.cost,
        modalities: partial.modalities || { input: ['text'], output: ['text'] },
        variants: partial.variants || [],
    }
}

describe('selectAutoRuntimeModel', () => {
    it('uses the cheapest compatible model for simple requests', () => {
        const selected = selectAutoRuntimeModel({
            message: 'Summarize this in one sentence.',
            models: [
                model({ provider: 'openai', id: 'gpt-5', reasoning: true, cost: { input: 10, output: 30 } }),
                model({ provider: 'openai', id: 'gpt-5-mini', cost: { input: 1, output: 3 } }),
            ],
        })

        expect(selected).toEqual({ provider: 'openai', modelId: 'gpt-5-mini' })
    })

    it('filters out models that cannot satisfy required capabilities', () => {
        const selected = selectAutoRuntimeModel({
            message: 'Read this screenshot and suggest fixes.',
            requiresAttachment: true,
            models: [
                model({ provider: 'openai', id: 'gpt-5-mini', attachment: false, cost: { input: 1, output: 3 } }),
                model({ provider: 'anthropic', id: 'claude-sonnet-4', attachment: true, cost: { input: 3, output: 15 } }),
            ],
        })

        expect(selected).toEqual({ provider: 'anthropic', modelId: 'claude-sonnet-4' })
    })

    it('prefers stronger reasoning candidates for complex requests', () => {
        const selected = selectAutoRuntimeModel({
            message: '```ts\nthrow new Error()\n```\nDebug this architecture regression and implement a robust fix.',
            models: [
                model({ provider: 'openai', id: 'gpt-5-mini', cost: { input: 1, output: 3 } }),
                model({ provider: 'openai', id: 'gpt-5', reasoning: true, cost: { input: 4, output: 12 } }),
            ],
        })

        expect(selected).toEqual({ provider: 'openai', modelId: 'gpt-5' })
    })
})
