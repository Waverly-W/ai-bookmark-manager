import { describe, expect, it } from 'vitest';
import {
    buildImportTemplateCandidates,
    sanitizeImportedBookmarkUrl
} from '../templateUrlImportUtils';

const kibanaBookmarks = [
    {
        id: '1',
        title: 'wx channel',
        url: "https://shop-elk.tuhuyun.cn/app/kibana#/discover?_g=(time:(from:'2026-02-05T02:30:00.000Z',to:'2026-02-05T03:00:00.000Z'))&_a=(filters:!((query:(match_phrase:(applicationName:int-website-crm-payment-channel-wx)))))"
    },
    {
        id: '2',
        title: 'payment engine',
        url: "https://shop-elk.tuhuyun.cn/app/kibana#/discover?_g=(time:(from:now-1d,to:now))&_a=(filters:!((query:(match_phrase:(applicationName:PaymentEngine)))))"
    },
    {
        id: '3',
        title: 'cashier core',
        url: "https://shop-elk.tuhuyun.cn/app/kibana#/discover?_g=(time:(from:now-1d,to:now))&_a=(filters:!((query:(match_phrase:(applicationName:CashierCore)))))"
    }
];

describe('templateUrlImportUtils', () => {
    it('sanitizes control characters from imported urls', () => {
        expect(
            sanitizeImportedBookmarkUrl('abc\u001b[118;1:3u123\u001b]11;rgb:2885/2a19/353a\u001b\\xyz')
        ).toBe('abc123xyz');
    });

    it('builds a template candidate from structurally similar bookmarks', () => {
        const candidates = buildImportTemplateCandidates(kibanaBookmarks, '支付监控');

        expect(candidates).toHaveLength(1);
        expect(candidates[0].name).toBe('支付监控 · shop-elk.tuhuyun.cn');
        expect(candidates[0].sampleCount).toBe(3);
        expect(candidates[0].placeholders.length).toBeGreaterThanOrEqual(1);
        expect(candidates[0].urlTemplate).toContain('{');
        expect(candidates[0].sourceBookmarkIds).toEqual(['1', '2', '3']);
    });

    it('does not create candidates from a single bookmark', () => {
        expect(buildImportTemplateCandidates([kibanaBookmarks[0]], '支付监控')).toEqual([]);
    });

    it('keeps unrelated structures in separate groups', () => {
        const candidates = buildImportTemplateCandidates([
            ...kibanaBookmarks,
            {
                id: '4',
                title: 'google',
                url: 'https://www.google.com/search?q=codex'
            }
        ], '支付监控');

        expect(candidates).toHaveLength(1);
    });
});
