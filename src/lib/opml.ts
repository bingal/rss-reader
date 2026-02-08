import { Feed } from '@/stores/useAppStore';

export interface OPMLOutline {
  '@_text'?: string;
  '@_title'?: string;
  '@_xmlUrl'?: string;
  '@_htmlUrl'?: string;
  '@_type'?: string;
  outline?: OPMLOutline[];
}

export async function exportToOPML(feeds: Feed[]): Promise<string> {
  const outlines = feeds.map(feed => ({
    '@_text': feed.title,
    '@_title': feed.title,
    '@_xmlUrl': feed.url,
    '@_type': 'rss',
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Reader Subscriptions</title>
  </head>
  <body>
${outlines.map(o => `    <outline type="rss" text="${escapeXml(o['@_text'] || '')}" title="${escapeXml(o['@_title'] || '')}" xmlUrl="${escapeXml(o['@_xmlUrl'] || '')}"/>`).join('\n')}
  </body>
</opml>`;
}

export async function importFromOPML(opmlContent: string): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    // Parse XML (simplified - in production use a proper XML parser)
    const outlineRegex = /<outline[^>]+xmlUrl="([^"]+)"[^>]*text="([^"]+)"[^>]*>/g;
    let match;
    
    while ((match = outlineRegex.exec(opmlContent)) !== null) {
      const url = match[1];
      const title = match[2];
      
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('add_new_feed', {
          title,
          url,
          description: null,
          category: null,
        });
        count++;
      } catch (e) {
        errors.push(`Failed to import ${title}: ${e}`);
      }
    }
  } catch (e) {
    errors.push(`Failed to parse OPML: ${e}`);
  }

  return { count, errors };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Download OPML file
export function downloadOPML(content: string, filename: string = 'subscriptions.opml') {
  const blob = new Blob([content], { type: 'text/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
