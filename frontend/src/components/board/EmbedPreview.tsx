import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { getEmbedInfo } from "../../utils/embeds";

interface EmbedPreviewProps {
  url: string;
}

export function EmbedPreview({ url }: EmbedPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const embed = getEmbedInfo(url);

  let displayHost = url;
  try {
    displayHost = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // leave displayHost as the raw url if it doesn't parse
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-zinc-500 hover:text-zinc-300 shrink-0 transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="text-xs text-zinc-400 truncate flex-1">{displayHost}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-sky-300 shrink-0 transition-colors"
          title="Open in new tab"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {expanded && (
        <div className="p-2 pt-0">
          {embed.kind === "youtube" || embed.kind === "vimeo" ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-[#000]">
              <iframe
                src={embed.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={url}
              />
            </div>
          ) : (
            <>
              <div className="h-40 w-full rounded-lg overflow-hidden bg-white/5 border border-white/10">
                <iframe src={embed.embedUrl} className="w-full h-full" title={url} />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                If this looks blank, the site doesn't allow embedding — use the open-in-new-tab icon instead.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
