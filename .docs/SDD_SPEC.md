# Standardized SDD Spec: AI Bookmark Manager

## 1. Context & Goal
**Project Name**: Qingniao Bookmark (青鸟书签)
**Goal**: To provide an intelligent, AI-driven browser extension for managing bookmarks.
**Core Problems Solved**:
- **Disorganization**: Users accumulate bookmarks without structure.
- **Naming Issues**: Bookmarks often have non-descriptive or messy titles.
- **Dead Links**: Bookmarks become invalid over time.
- **Sync Issues**: Configuration and preferences need to be consistent across devices.

**Key Features**:
- **AI Renaming**: Automatically rename bookmarks to be concise and descriptive.
- **Smart Filing**: Recommend appropriate folders for new or existing bookmarks.
- **Batch Processing**: Handle large volumes of bookmarks for renaming or organization.
- **Health Check**: Scan for and identify broken links.
- **Config Sync**: Synchronize user preferences (AI settings, theme, etc.) across devices using Chrome Storage Sync.

## 2. Interface Definition

### 2.1 AI Service (`lib/aiService.ts`)
Core service for interacting with LLMs.

```typescript
// Call the AI API with a specific prompt and configuration
async function callAIAPI(
    config: AIConfig,
    prompt: string,
    systemPrompt?: string,
    maxTokens?: number,
    options?: AIRequestOptions,
    responseFormat?: { type: "json_schema"; json_schema: any }
): Promise<string>;

// Rename a single bookmark
async function renameBookmarkWithAI(
    config: AIConfig,
    bookmarkUrl: string,
    currentTitle: string,
    locale?: string,
    referenceBookmarks?: string[]
): Promise<AIRenameResult>;

// Batch rename bookmarks with concurrency control
async function batchRenameBookmarks(
    config: AIConfig,
    bookmarks: Array<{ id: string; url: string; title: string }>,
    locale?: string,
    onProgress?: (current: number, total: number, result?: any) => void,
    signal?: AbortSignal,
    maxConcurrency?: number
): Promise<Array<any>>;

// Recommend a folder for a bookmark
async function recommendFolderWithAI(
    config: AIConfig,
    url: string,
    title: string,
    allFolders: string[],
    locale?: string
): Promise<{ success: boolean; recommendations?: Array<{ folderId: string; folderPath: string }>; error?: string }>;
```

### 2.2 Bookmark Utilities (`lib/bookmarkUtils.ts`)
Helper functions for Chrome Bookmark API interactions.

```typescript
// Get the full folder tree structure
async function getBookmarkFolderTree(): Promise<BookmarkFolder[]>;

// Find duplicate bookmarks based on URL
function findDuplicateBookmarks(nodes: any[]): DuplicateGroup[];

// Check if a single bookmark URL is valid
async function checkBookmarkValidity(url: string): Promise<{ status: 'valid' | 'invalid' | 'timeout' | 'error'; error?: string }>;

// Scan a list of bookmarks for validity
async function scanBookmarkValidity(
    bookmarks: any[],
    onProgress?: (current: number, total: number, url: string, result?: ValidityResult) => void,
    signal?: AbortSignal
): Promise<ValidityResult[]>;

// Find empty folders
function findEmptyFolders(nodes: any[]): any[];
```

### 2.3 Configuration Sync (`lib/configSyncManager.ts`)
Singleton manager for synchronizing settings.

```typescript
class ConfigSyncManager {
    static getInstance(): ConfigSyncManager;
    
    // Initialize sync (generate device ID, migrate data, restore if needed)
    async initialize(): Promise<void>;
    
    // Set a config value (saves to local and syncs)
    async set(key: string, value: any): Promise<void>;
    
    // Get a config value (reads from local)
    async get<T>(key: string): Promise<T | null>;
    
    // Force manual sync from remote
    async manualSync(): Promise<void>;
}
```

## 3. Data Structures

### 3.1 Core Entities

**BookmarkNode** (Chrome Native Wrapper)
```typescript
interface BookmarkNode {
    id: string;
    title: string;
    url?: string;
    children?: BookmarkNode[];
    parentId?: string;
    index?: number;
    dateAdded?: number;
    dateGroupModified?: number;
}
```

**BookmarkFolder** (UI Representation)
```typescript
interface BookmarkFolder {
    id: string;
    title: string;
    parentId?: string;
    path: string; // e.g., "Bookmarks Bar/Dev Tools"
    children?: BookmarkFolder[];
    level: number;
}
```

**AIConfig**
```typescript
interface AIConfig {
    apiUrl: string;      // API Proxy URL
    apiKey: string;      // Encrypted/Obfuscated Key
    modelId: string;     // e.g., "gpt-3.5-turbo"
}
```

**AIScenario**
```typescript
interface AIScenario<InputType, OutputType> {
    id: string;
    name: string;
    description: string;
    getSystemPrompt: (locale: string) => string;
    defaultUserPrompt: string;
    responseSchema: {
        name: string;
        strict: boolean;
        schema: JSONSchema;
    };
    formatUserPrompt: (template: string, input: InputType) => string;
    parseResponse: (response: any) => OutputType;
}
```

### 3.2 Sync Structures

**SyncMetadata**
```typescript
interface SyncMetadata {
    lastModified: number;
    version: number;
    deviceId: string;
}
```

**SyncStatus**
```typescript
interface SyncStatus {
    isSyncing: boolean;
    lastSyncTime: number | null;
    lastError: string | null;
    pendingChanges: number;
}
```

## 4. Business Logic & Constraints

### 4.1 AI Processing Logic
- **Scenario-Based Execution**: All AI operations (Rename, Recommend) are defined as "Scenarios" with strict JSON schemas to ensure structured output.
- **Concurrency Control**: Batch operations use a `ConcurrencyController` to limit parallel requests (default 1, configurable) to avoid rate limits.
- **Retry Mechanism**: API calls include exponential backoff retries (default 2 retries) for transient failures (429/500 errors).
- **Consistency Check**: Batch renaming includes a logic to detect style inconsistencies (e.g., mixed separators " | " vs " - ") and suggest unification.

### 4.2 Synchronization Logic
- **Storage Layering**:
    - `storage.local`: Acts as the "Cache" and immediate source of truth for the UI.
    - `storage.sync`: Acts as the "Remote" for cross-device synchronization.
- **Conflict Resolution**:
    - **Last Write Wins**: Based on `lastModified` timestamp.
    - **Loop Prevention**: Updates originating from the current `deviceId` are ignored when received via sync listeners.
- **Initialization**: On startup, checks if it's a "First Sync". If so, attempts to restore from `storage.sync`.

### 4.3 Bookmark Validity Logic
- **Method Fallback**: Tries `HEAD` request first. If it fails (or method not allowed), falls back to `GET`.
- **CORS Handling**: Uses `mode: 'no-cors'` to avoid CORS errors blocking the check (opaque response status 0 is treated as "valid" reachability).
- **Timeout**: Enforces a 10-second timeout per request.

### 4.4 Constraints
- **API Key Security**: Stored in `storage.local` with simple Base64 encoding (Note: Not true encryption, intended to prevent casual shoulder-surfing).
- **Chrome Limits**: `storage.sync` has strict quota limits (100KB total, 8KB per item). The `ConfigSyncManager` must ensure data fits within these limits (currently analyzed to be ~1.3KB, well within limits).

## 5. Verification Plan

### 5.1 Automated Tests (Unit/Integration)
- [ ] **AI Service**:
    - Test `callAIAPI` with mock fetch to verify retry logic and error handling.
    - Test `executeScenario` to ensure JSON parsing and schema validation work.
- **Bookmark Utils**:
    - Test `buildFolderTree` with various nested structures.
    - Test `findDuplicateBookmarks` with case-sensitive/insensitive URLs.
    - Test `checkBookmarkValidity` with mock network responses (200, 404, timeout).
- **Config Sync**:
    - Test `migrateOldSyncData` to ensure legacy configs are preserved.
    - Test `handleSyncChanges` to verify loop prevention (ignoring own device ID).

### 5.2 Manual Verification
- [ ] **Sync Flow**:
    1. Open extension on Browser A and Browser B (simulated or real).
    2. Change Theme on A.
    3. Verify Theme updates on B within 5 seconds.
- [ ] **AI Batch Rename**:
    1. Select 10 bookmarks.
    2. Run Batch Rename.
    3. Verify progress bar updates.
    4. Verify all 10 are renamed (or error reported).
- [ ] **Validity Scan**:
    1. Add a known broken link (e.g., `http://example.com/nonexistent`).
    2. Run Validity Scan.
    3. Verify it is flagged as Invalid.
