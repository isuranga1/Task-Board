import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, ExternalLink } from "lucide-react";
import type { Link } from "../../types";
import { getEmbedInfo } from "../../utils/embeds";

interface LinkRowProps {
  link: Link;
  onChangeLabel: (value: string) => void;
  onChangeUrl: (value: string) => void;
  onRemove: () => void;
}

export function LinkRow({ link, onChangeLabel, onChangeUrl, onRemove }: LinkRowProps) {
  const [expanded, setExpanded] = useState(false);
  const canPreview = link.url.trim().length > 0;
  const embed = canPreview ? getEmbedInfo(link.url) : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl">
      <div className="flex gap-2 items-center p-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          disabled={!canPreview}
          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-500 shrink-0 transition-colors"
          title={canPreview ? "Toggle preview" : "Add a URL to preview it"}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <input
          value={link.label}
          onChange={(e) => onChangeLabel(e.target.value)}
          placeholder="Label (e.g. Demo video)"
          className="w-28 bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
        />
        <input
          value={link.url}
          onChange={(e) => onChangeUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
        />
        {canPreview && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-sky-300 shrink-0 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-500 hover:text-rose-300 shrink-0 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && embed && (
        <div className="p-2 pt-0">
          {embed.kind === "youtube" || embed.kind === "vimeo" ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
              <iframe
                src={embed.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={link.label || "Embedded video"}
              />
            </div>
          ) : (
            <>
              <div className="h-40 w-full rounded-lg overflow-hidden bg-white/5 border border-white/10">
                <iframe
                  src={embed.embedUrl}
                  className="w-full h-full"
                  title={link.label || "Link preview"}
                />
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
