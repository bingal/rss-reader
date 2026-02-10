import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  // Custom components for better styling
  const components: Components = {
    // Images: add rounded corners and max width
    img: ({ ...props }) => (
      <img
        {...props}
        className="rounded-lg max-w-full h-auto my-4"
        loading="lazy"
        alt={props.alt || ""}
      />
    ),

    // Links: style and open in new tab
    a: ({ ...props }) => (
      <a
        {...props}
        className="text-primary hover:text-primary/80 underline"
        target="_blank"
        rel="noopener noreferrer"
      />
    ),

    // Blockquotes: add border and background
    blockquote: ({ ...props }) => (
      <blockquote
        {...props}
        className="border-l-4 border-primary/30 bg-muted/30 py-1 px-4 rounded-r-lg my-4"
      />
    ),

    // Code blocks: add background
    pre: ({ ...props }) => (
      <pre
        {...props}
        className="bg-muted p-4 rounded-lg overflow-x-auto my-4"
      />
    ),

    code: (props: {
      node?: unknown;
      inline?: boolean;
      className?: string;
      children?: React.ReactNode;
    }) => {
      const { inline, ...rest } = props;
      return (
        <code
          {...rest}
          className={
            inline
              ? "bg-muted px-1.5 py-0.5 rounded text-sm text-foreground"
              : ""
          }
        />
      );
    },

    // Headings: add margin and font weight
    h1: ({ ...props }) => (
      <h1 {...props} className="text-3xl font-semibold mt-6 mb-4" />
    ),
    h2: ({ ...props }) => (
      <h2 {...props} className="text-2xl font-semibold mt-5 mb-3" />
    ),
    h3: ({ ...props }) => (
      <h3 {...props} className="text-xl font-semibold mt-4 mb-2" />
    ),
    h4: ({ ...props }) => (
      <h4 {...props} className="text-lg font-semibold mt-3 mb-2" />
    ),

    // Lists: add spacing
    ul: ({ ...props }) => (
      <ul {...props} className="list-disc list-inside my-4 space-y-2" />
    ),
    ol: ({ ...props }) => (
      <ol {...props} className="list-decimal list-inside my-4 space-y-2" />
    ),

    // Paragraphs: add spacing and text color
    p: ({ ...props }) => (
      <p {...props} className="my-3 leading-relaxed text-foreground" />
    ),

    // Horizontal rule
    hr: ({ ...props }) => <hr {...props} className="my-6 border-border" />,

    // Tables: add styling for GFM tables
    table: ({ ...props }) => (
      <div className="overflow-x-auto my-4">
        <table
          {...props}
          className="min-w-full border-collapse border border-border"
        />
      </div>
    ),
    th: ({ ...props }) => (
      <th
        {...props}
        className="border border-border bg-muted px-4 py-2 text-left font-semibold"
      />
    ),
    td: ({ ...props }) => (
      <td {...props} className="border border-border px-4 py-2" />
    ),
  };

  return (
    <div
      className={`prose prose-slate dark:prose-invert max-w-none prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground prose-code:text-foreground ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
