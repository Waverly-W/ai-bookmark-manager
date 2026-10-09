import type { ClippingJob } from '../contracts/job';

/** Compares page URLs ignoring the fragment, which never changes the clipped content. */
export function isSamePage(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  try {
    const a = new URL(left);
    const b = new URL(right);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch {
    return false;
  }
}

/**
 * An unfinished job is only resumed automatically when it was clipped from the
 * page the user is looking at; otherwise the side panel extracts the current
 * page and offers the old job as an explicit choice.
 */
export function shouldResumeJob(job: ClippingJob | undefined, activeTabUrl: string | undefined): job is ClippingJob {
  return job !== undefined && isSamePage(job.article.sourceUrl, activeTabUrl);
}

export interface PendingJobSummary {
  title: string;
  host: string;
}

export function summarizePendingJob(job: ClippingJob): PendingJobSummary {
  let host = '';
  try {
    host = new URL(job.article.sourceUrl).hostname;
  } catch {
    // Keep the host empty when the stored URL is unparsable.
  }
  return { title: job.article.title.trim() || host, host };
}
