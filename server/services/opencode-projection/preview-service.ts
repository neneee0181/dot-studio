import type { CompilePromptRequest } from '../../../shared/chat-contracts.js'
import { isAutoModelSelection } from '../../../shared/model-auto.js'
import { listRuntimeModels } from '../../lib/model-catalog.js'
import { selectAutoRuntimeModel } from '../../lib/auto-model-selection.js'
import { ensurePerformerProjection } from './stage-projection-service.js'

export function getCompileRequestTargets(request: CompilePromptRequest) {
    return request.requestTargets || []
}

export async function compileProjectionPreview(
    cwd: string,
    request: CompilePromptRequest,
) {
    const posture = request.planMode ? 'plan' : 'build'
    const model = isAutoModelSelection(request.model)
        ? selectAutoRuntimeModel({
            message: '',
            models: await listRuntimeModels(cwd),
            requiresToolCall: (request.mcpServerNames || []).length > 0,
        })
        : request.model
    const ensured = await ensurePerformerProjection({
        performerId: request.performerId || 'preview',
        performerName: request.performerName || 'Preview',
        talRef: request.talRef,
        danceRefs: request.danceRefs,
        model,
        modelVariant: isAutoModelSelection(request.model) ? null : request.modelVariant || null,
        mcpServerNames: request.mcpServerNames || [],
        workingDir: cwd,
        requestTargets: getCompileRequestTargets(request),
    })

    return {
        system: ensured.compiled.agentContents[posture],
        agent: ensured.compiled.agentNames[posture],
        instructionStack: [
            {
                label: 'OpenCode config',
                detail: 'Global and project instructions are loaded by OpenCode before Studio projected agents when configured.',
            },
            {
                label: 'Projected agent frontmatter',
                detail: 'Studio sets model, variant, tool policy, skill allowlist, and task allowlist in the generated agent file.',
            },
            {
                label: 'Performer TAL',
                detail: request.talRef ? 'The selected TAL is inserted as the primary performer body.' : 'No TAL is selected for this performer.',
            },
            ...(getCompileRequestTargets(request).length > 0 ? [{
                label: 'Act relation context',
                detail: 'Thread participant relation context is appended for Act-scoped execution.',
            }] : []),
            ...(ensured.compiled.skills.length > 0 ? [{
                label: 'Dance skills',
                detail: `${ensured.compiled.skills.length} projected SKILL.md bundle${ensured.compiled.skills.length === 1 ? '' : 's'} are available through the OpenCode skill tool.`,
            }] : []),
        ],
        danceCatalog: ensured.compiled.skills.map((skill) => ({
            urn: skill.logicalName,
            description: skill.description,
            loadMode: 'tool' as const,
        })),
        capabilitySnapshot: ensured.capabilitySnapshot,
        toolResolution: ensured.toolResolution,
    }
}
