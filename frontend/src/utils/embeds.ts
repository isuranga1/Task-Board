export type EmbedKind = "youtube" | "vimeo" | "generic";

export interface EmbedInfo {
  kind: EmbedKind;
  embedUrl: string;
}

/**
 * Turns a normal link URL into something iframe-embeddable.
 * YouTube/Vimeo have dedicated embed endpoints that work reliably.
 * Everything else falls back to embedding the URL directly — this works for
 * some sites and not others (many block framing via X-Frame-Options /
 * Content-Security-Policy), which is why the UI shows a fallback message
 * rather than assuming every generic link will render.
 */
export function getEmbedInfo(url: string): EmbedInfo {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${videoId}` };
      }
      // Shorts / already-embed paths: /shorts/<id>, /embed/<id>
      const pathMatch = parsed.pathname.match(/\/(shorts|embed)\/([^/?]+)/);
      if (pathMatch) {
        return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${pathMatch[2]}` };
      }
    }

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace("/", "");
      if (videoId) {
        return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${videoId}` };
      }
    }

    if (host === "vimeo.com") {
      const videoId = parsed.pathname.replace("/", "");
      if (videoId && /^\d+$/.test(videoId)) {
        return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${videoId}` };
      }
    }

    return { kind: "generic", embedUrl: url };
  } catch {
    return { kind: "generic", embedUrl: url };
  }
}
