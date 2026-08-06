import { describe, expect, it, vi } from 'vitest';

import { runPopupAIWorkflow } from '@/lib/popupAIWorkflow';

describe('runPopupAIWorkflow', () => {
  it('does not run rename or tagging after folder recommendation fails', async () => {
    const rename = vi.fn();
    const tag = vi.fn();

    const result = await runPopupAIWorkflow({
      recommend: vi.fn().mockResolvedValue({
        success: false,
        targetFolderId: '1',
        error: 'network failed',
      }),
      rename,
      tag,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('network failed');
    expect(rename).not.toHaveBeenCalled();
    expect(tag).not.toHaveBeenCalled();
  });

  it('runs rename and tagging after recommendation succeeds', async () => {
    const rename = vi.fn().mockResolvedValue({ success: true });
    const tag = vi.fn().mockResolvedValue({ success: true });

    const result = await runPopupAIWorkflow({
      recommend: vi.fn().mockResolvedValue({
        success: true,
        targetFolderId: '42',
      }),
      rename,
      tag,
    });

    expect(result.success).toBe(true);
    expect(rename).toHaveBeenCalledWith('42');
    expect(tag).toHaveBeenCalledOnce();
  });
});
