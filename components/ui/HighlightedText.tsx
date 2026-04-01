interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const cleanedQuery = query.trim();

  if (!cleanedQuery) {
    return <span className={className}>{text}</span>;
  }

  const terms = Array.from(
    new Set(
      cleanedQuery
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
    )
  );

  if (terms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(`(${terms.map((term) => escapeRegExp(term)).join('|')})`, 'ig');
  const chunks = text.split(pattern);

  return (
    <span className={className}>
      {chunks.map((chunk, index) => {
        const isMatch = terms.some((term) => term.toLowerCase() === chunk.toLowerCase());

        return isMatch ? (
          <mark key={`${chunk}-${index}`} className="bg-amber-200/80 text-gray-900 px-0.5 rounded-sm">
            {chunk}
          </mark>
        ) : (
          <span key={`${chunk}-${index}`}>{chunk}</span>
        );
      })}
    </span>
  );
}
