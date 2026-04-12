import { AIScenario } from '../types';

export interface BackupConflictResolutionInput {
    preferredSource: 'local' | 'remote';
    conflicts: Array<{
        conflictId: string;
        section: 'bookmarks' | 'settings' | 'prompts';
        entityKey: string;
        field: string;
        localValue: unknown;
        remoteValue: unknown;
    }>;
}

export interface BackupConflictResolutionOutput {
    resolutions: Array<{
        conflictId: string;
        chosenSource: 'local' | 'remote' | 'hybrid';
        mergedValueJson: string;
        reason: string;
    }>;
}

export const formatBackupConflictResolutionSystemPrompt = (
    preferredSource: 'local' | 'remote',
    locale: string = 'zh_CN'
): string => {
    if (locale.startsWith('zh')) {
        return `你是一个严格、审慎的备份恢复冲突解决助手。

你的任务是针对每个冲突字段给出最终 mergedValueJson。

规则：
1. 优先确保恢复后的数据可用、完整、一致。
2. 当 local 与 remote 都合理时，优先 ${preferredSource === 'local' ? '本地(local)' : '远程(remote)'}。
3. 只有在确实更优时，才返回 hybrid。
4. mergedValueJson 必须是合法 JSON 字符串，例如：
   - 字符串："\\"value\\""
   - 数组："[\\"tag1\\", \\"tag2\\"]"
   - 对象："{\\"enabled\\":true}"
5. 只返回符合 schema 的 JSON，不要输出额外说明。`;
    }

    return `You are a strict backup conflict resolution assistant.

Your task is to produce a final mergedValueJson for each conflicting field.

Rules:
1. Prioritize correctness, completeness, and consistency.
2. When local and remote are both reasonable, prefer ${preferredSource}.
3. Return hybrid only when it is clearly better.
4. mergedValueJson must be a valid JSON string. Examples:
   - string: "\\"value\\""
   - array: "[\\"tag1\\", \\"tag2\\"]"
   - object: "{\\"enabled\\":true}"
5. Return only schema-compliant JSON with no extra prose.`;
};

export const backupConflictResolutionScenario: AIScenario<
    BackupConflictResolutionInput,
    BackupConflictResolutionOutput
> = {
    id: 'backup-conflict-resolution',
    name: 'backupConflictResolution',
    description: 'Resolve field-level conflicts when merging a remote backup into local data',
    defaultUserPrompt: 'Resolve backup conflicts.',
    responseSchema: {
        name: 'backup_conflict_resolution_response',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                resolutions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            conflictId: {
                                type: 'string'
                            },
                            chosenSource: {
                                type: 'string',
                                enum: ['local', 'remote', 'hybrid']
                            },
                            mergedValueJson: {
                                type: 'string'
                            },
                            reason: {
                                type: 'string'
                            }
                        },
                        required: ['conflictId', 'chosenSource', 'mergedValueJson', 'reason'],
                        additionalProperties: false
                    }
                }
            },
            required: ['resolutions'],
            additionalProperties: false
        }
    },
    formatUserPrompt: (template: string, input: BackupConflictResolutionInput) => {
        return `${template}

preferredSource: ${input.preferredSource}

conflicts:
${JSON.stringify(input.conflicts, null, 2)}`;
    },
    getSystemPrompt: (locale: string) => formatBackupConflictResolutionSystemPrompt('local', locale),
    parseResponse: (response: any): BackupConflictResolutionOutput => ({
        resolutions: Array.isArray(response?.resolutions) ? response.resolutions : []
    })
};
