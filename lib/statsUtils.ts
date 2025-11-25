
export interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    children?: BookmarkNode[];
    dateAdded?: number;
    parentId?: string;
}

export interface BookmarkStats {
    totalBookmarks: number;
    totalFolders: number;
    topFolders: { name: string; count: number }[];
    recentAdditions: number; // Last 30 days
    duplicateCount: number;
    bookmarksByDate: { date: string; count: number }[]; // For trend chart (last 30 days)
}

export const calculateBookmarkStats = (nodes: BookmarkNode[]): BookmarkStats => {
    let totalBookmarks = 0;
    let totalFolders = 0;
    let recentAdditions = 0;
    const urlMap = new Map<string, number>();
    const folderCounts = new Map<string, number>();
    const dateCounts = new Map<string, number>();

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Helper to format date as YYYY-MM-DD
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
    };

    // Initialize last 30 days in dateCounts with 0
    for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dateCounts.set(d.toISOString().split('T')[0], 0);
    }

    const traverse = (currentNode: BookmarkNode, folderName: string = 'Root') => {
        if (currentNode.url) {
            // It's a bookmark
            totalBookmarks++;

            // Check duplicates
            const normalizedUrl = currentNode.url.trim(); // Simple normalization
            urlMap.set(normalizedUrl, (urlMap.get(normalizedUrl) || 0) + 1);

            // Check recent additions
            if (currentNode.dateAdded && currentNode.dateAdded > thirtyDaysAgo) {
                recentAdditions++;
                const dateStr = formatDate(currentNode.dateAdded);
                if (dateCounts.has(dateStr)) {
                    dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
                }
            }

            // Count per folder
            folderCounts.set(folderName, (folderCounts.get(folderName) || 0) + 1);

        } else {
            // It's a folder
            if (currentNode.id !== '0' && currentNode.id !== 'root') { // Exclude root virtual nodes if any
                totalFolders++;
            }

            if (currentNode.children) {
                const currentFolderName = currentNode.title || 'Unknown';
                currentNode.children.forEach(child => traverse(child, currentFolderName));
            }
        }
    };

    // Start traversal
    // Handle array of nodes (usually root's children)
    nodes.forEach(node => traverse(node));

    // Calculate duplicates
    let duplicateCount = 0;
    urlMap.forEach((count) => {
        if (count > 1) duplicateCount += (count - 1);
    });

    // Get top folders
    const topFolders = Array.from(folderCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Format date stats for chart
    // Sort by date ascending
    const bookmarksByDate = Array.from(dateCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        totalBookmarks,
        totalFolders,
        topFolders,
        recentAdditions,
        duplicateCount,
        bookmarksByDate
    };
};
