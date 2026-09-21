/** Matches youtu.be/<id>, youtube.com/watch?v=<id>, /live/<id>, /embed/<id>, and shorts/<id>. */
const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/))([A-Za-z0-9_-]{11})/;

export function parseYouTubeId(url: string): string | null {
  const m = url.trim().match(YT_RE);
  return m ? m[1] : null;
}

export const isYouTubeUrl = (url: string) => parseYouTubeId(url) !== null;
