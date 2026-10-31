import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split by media patterns or newlines
  const lines = content.split('\n');

  return (
    <div className={`space-y-2 ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        // Check for image or video: ![alt](url)
        const mediaMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        if (mediaMatch) {
          const [, alt, url] = mediaMatch;
          const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url) || alt.toLowerCase() === 'video';
          if (isVideo) {
            return (
              <video
                key={idx}
                src={url}
                controls
                playsInline
                className="max-w-full max-h-[38vh] border-3 border-current block my-2"
              />
            );
          }
          return (
            <img
              key={idx}
              src={url}
              alt={alt}
              className="max-w-full max-h-[38vh] border-3 border-current block my-2 object-contain"
            />
          );
        }

        // Process bold **text**
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx} className="min-h-[1.2em]">
            {parts.map((p, pIdx) => {
              if (p.startsWith('**') && p.endsWith('**')) {
                return <b key={pIdx}>{p.slice(2, -2)}</b>;
              }
              return <React.Fragment key={pIdx}>{p}</React.Fragment>;
            })}
          </p>
        );
      })}
    </div>
  );
};
