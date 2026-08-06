export interface PopupAIWorkflowStepResult {
  success: boolean;
  error?: string;
}

export interface PopupAIRecommendationResult extends PopupAIWorkflowStepResult {
  targetFolderId: string;
}

export interface PopupAIWorkflowDependencies {
  recommend: () => Promise<PopupAIRecommendationResult>;
  rename: (targetFolderId: string) => Promise<PopupAIWorkflowStepResult>;
  tag: () => Promise<PopupAIWorkflowStepResult>;
}

export interface PopupAIWorkflowResult {
  success: boolean;
  targetFolderId?: string;
  rename?: PopupAIWorkflowStepResult;
  tag?: PopupAIWorkflowStepResult;
  error?: string;
}

export const runPopupAIWorkflow = async (
  dependencies: PopupAIWorkflowDependencies
): Promise<PopupAIWorkflowResult> => {
  const recommendation = await dependencies.recommend();

  if (!recommendation.success) {
    return {
      success: false,
      targetFolderId: recommendation.targetFolderId,
      error: recommendation.error || 'Folder recommendation failed',
    };
  }

  const [rename, tag] = await Promise.all([
    dependencies.rename(recommendation.targetFolderId),
    dependencies.tag(),
  ]);

  return {
    success: true,
    targetFolderId: recommendation.targetFolderId,
    rename,
    tag,
  };
};
