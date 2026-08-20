import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.tsx';
import { RenderedPreview } from './RenderedPreview';
import type { ImageReference } from '@/lib/clipper/contracts/article';

export type EditorTab = 'source' | 'rendered';

interface EditorProps {
  markdown: string;
  imageReferences?: readonly ImageReference[];
  uploadedImageUrls?: Readonly<Record<string, string>>;
  activeTab: EditorTab;
  onMarkdownChange(value: string): void;
  onMarkdownBlur(): void;
  onTabChange(tab: EditorTab): void;
}

export function Editor(props: EditorProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 border rounded-lg overflow-hidden bg-card text-card-foreground">
      <Tabs
        value={props.activeTab}
        onValueChange={(val) => props.onTabChange(val as EditorTab)}
        className="w-full flex flex-col flex-1 min-h-0"
      >
        <div className="border-b px-3 py-1.5 bg-muted/40 flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="source" className="text-xs px-3 py-1">
              源文本
            </TabsTrigger>
            <TabsTrigger value="rendered" className="text-xs px-3 py-1">
              渲染预览
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="source" className="flex-1 p-0 m-0 min-h-0">
          <textarea
            id="markdown-source"
            aria-label="Markdown 源文本"
            value={props.markdown}
            onChange={(e) => props.onMarkdownChange(e.target.value)}
            onBlur={props.onMarkdownBlur}
            spellCheck={false}
            className="w-full h-full min-h-[300px] p-3 text-xs font-mono bg-transparent border-0 focus:outline-none resize-none leading-relaxed text-foreground placeholder:text-muted-foreground"
            placeholder="正文内容 (Markdown)..."
          />
        </TabsContent>

        <TabsContent value="rendered" className="flex-1 p-3 m-0 overflow-y-auto min-h-0 max-h-[500px]">
          <RenderedPreview
            markdown={props.markdown}
            imageReferences={props.imageReferences}
            uploadedImageUrls={props.uploadedImageUrls}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
