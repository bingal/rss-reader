import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { exportToOPML, downloadOPML, importFromOPML } from '@/lib/opml';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';

interface OPMLImportProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OPMLImport({ isOpen, onClose }: OPMLImportProps) {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [fileContent, setFileContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { feeds } = useAppStore();
  const queryClient = useQueryClient();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setFileContent(text);
  };

  const handleImport = async () => {
    if (!fileContent.trim()) return;
    
    setImporting(true);
    try {
      const result = await importFromOPML(fileContent);
      setImportResult(result);
      if (result.count > 0) {
        queryClient.invalidateQueries({ queryKey: ['feeds'] });
      }
    } catch (e) {
      setImportResult({ count: 0, errors: [`Import failed: ${e}`] });
    }
    setImporting(false);
  };

  const handleExport = async () => {
    const content = await exportToOPML(feeds);
    downloadOPML(content, 'rss-reader-subscriptions.opml');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">OPML Import/Export</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('import')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              tab === 'import'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Import
          </button>
          <button
            onClick={() => setTab('export')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              tab === 'export'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Export
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {tab === 'import' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select an OPML file to import RSS feeds from other readers.
              </p>
              
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".opml,.xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Choose file
                </button>
                <span className="text-sm text-muted-foreground ml-2">
                  or drag and drop
                </span>
              </div>

              {fileContent && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-2">Selected file preview:</p>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                    {fileContent.slice(0, 500)}...
                  </pre>
                </div>
              )}

              {importResult && (
                <div className={cn(
                  'p-3 rounded text-sm',
                  importResult.count > 0
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-destructive/10 text-destructive'
                )}>
                  Imported {importResult.count} feeds
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 text-xs">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-muted rounded hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!fileContent.trim() || importing}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export your RSS feeds to OPML format. You can import this file into other RSS readers.
              </p>

              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium mb-2">{feeds.length} feeds will be exported</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {feeds.slice(0, 5).map((feed) => (
                    <li key={feed.id}>• {feed.title}</li>
                  ))}
                  {feeds.length > 5 && (
                    <li>• ... and {feeds.length - 5} more</li>
                  )}
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-muted rounded hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={feeds.length === 0}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  Export OPML
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
