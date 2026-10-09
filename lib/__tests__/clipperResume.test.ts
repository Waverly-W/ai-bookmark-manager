import { describe, it, expect } from 'vitest';
import type { ClippingJob } from '../clipper/contracts/job';
import { isSamePage, shouldResumeJob, summarizePendingJob } from '../clipper/jobs/resume';

const job = (sourceUrl: string, title = 'Article'): ClippingJob =>
  ({ article: { sourceUrl, title } }) as unknown as ClippingJob;

describe('clipper job resume', () => {
  it('treats URLs that differ only by fragment as the same page', () => {
    expect(isSamePage('https://example.com/a?x=1#top', 'https://example.com/a?x=1#section')).toBe(true);
  });

  it('treats different paths or queries as different pages', () => {
    expect(isSamePage('https://example.com/a', 'https://example.com/b')).toBe(false);
    expect(isSamePage('https://example.com/a?x=1', 'https://example.com/a?x=2')).toBe(false);
  });

  it('never matches when a URL is missing or unparsable', () => {
    expect(isSamePage(undefined, 'https://example.com')).toBe(false);
    expect(isSamePage('https://example.com', undefined)).toBe(false);
    expect(isSamePage('not a url', 'not a url')).toBe(false);
  });

  it('only resumes a job that was clipped from the active page', () => {
    const incomplete = job('https://example.com/a');

    expect(shouldResumeJob(incomplete, 'https://example.com/a#x')).toBe(true);
    expect(shouldResumeJob(incomplete, 'https://example.com/other')).toBe(false);
    expect(shouldResumeJob(incomplete, undefined)).toBe(false);
    expect(shouldResumeJob(undefined, 'https://example.com/a')).toBe(false);
  });

  it('summarizes a pending job by title and host, falling back to the host', () => {
    expect(summarizePendingJob(job('https://docs.example.com/a', '  Guide  '))).toEqual({
      title: 'Guide',
      host: 'docs.example.com',
    });
    expect(summarizePendingJob(job('https://docs.example.com/a', '   ')).title).toBe('docs.example.com');
  });
});
