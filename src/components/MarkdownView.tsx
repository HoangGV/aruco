import React, { useMemo } from 'react';
import katex from 'katex';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

interface Segment {
  type: 'text' | 'bold' | 'math' | 'display-math';
  content: string;
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      trust: true,
      strict: false
    });
  } catch {
    return tex;
  }
}

function parseLineSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  // Regex to match:
  // 1. $$...$$ (display math)
  // 2. \[...\] (display math)
  // 3. $...$ (inline math)
  // 4. \(...\) (inline math)
  // 5. **...** (bold)
  const pattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|(?<!\\)\$(?:\\\$|[^\$])+?(?<!\\)\$|\\\([\s\S]*?\\\)|\*\*.*?\*\*)/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIdx) {
      segments.push({
        type: 'text',
        content: line.slice(lastIdx, match.index)
      });
    }

    const token = match[0];
    if (token.startsWith('$$') && token.endsWith('$$')) {
      segments.push({
        type: 'display-math',
        content: token.slice(2, -2)
      });
    } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
      segments.push({
        type: 'display-math',
        content: token.slice(2, -2)
      });
    } else if (token.startsWith('$') && token.endsWith('$')) {
      segments.push({
        type: 'math',
        content: token.slice(1, -1)
      });
    } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
      segments.push({
        type: 'math',
        content: token.slice(2, -2)
      });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      segments.push({
        type: 'bold',
        content: token.slice(2, -2)
      });
    }

    lastIdx = match.index + token.length;
  }

  if (lastIdx < line.length) {
    segments.push({
      type: 'text',
      content: line.slice(lastIdx)
    });
  }

  return segments;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = useMemo(() => content.split('\n'), [content]);

  return (
    <div className={`space-y-1 ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Check for media: ![alt](url)
        const mediaMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        if (mediaMatch) {
          const [, alt, url] = mediaMatch;
          const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url) || alt.toLowerCase() === 'video';
          if (isVideo) {
            return (
              <video
                key={lineIdx}
                src={url}
                controls
                playsInline
                className="max-w-full max-h-[38vh] border-3 border-current block my-2"
              />
            );
          }
          return (
            <img
              key={lineIdx}
              src={url}
              alt={alt}
              className="max-w-full max-h-[38vh] border-3 border-current block my-2 object-contain"
            />
          );
        }

        const segments = parseLineSegments(line);

        return (
          <p key={lineIdx} className="min-h-[1.2em] leading-relaxed">
            {segments.map((seg, sIdx) => {
              if (seg.type === 'bold') {
                const innerSegs = parseLineSegments(seg.content);
                return (
                  <b key={sIdx} className="font-bold">
                    {innerSegs.map((is, iIdx) => {
                      if (is.type === 'math' || is.type === 'display-math') {
                        const html = renderKatex(is.content, is.type === 'display-math');
                        return (
                          <span
                            key={iIdx}
                            className="inline-block"
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        );
                      }
                      return <span key={iIdx}>{is.content}</span>;
                    })}
                  </b>
                );
              }

              if (seg.type === 'display-math') {
                const html = renderKatex(seg.content, true);
                return (
                  <span
                    key={sIdx}
                    className="block my-2 text-center overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              }

              if (seg.type === 'math') {
                const html = renderKatex(seg.content, false);
                return (
                  <span
                    key={sIdx}
                    className="inline-block px-0.5 align-baseline"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              }

              return <React.Fragment key={sIdx}>{seg.content}</React.Fragment>;
            })}
          </p>
        );
      })}
    </div>
  );
};
