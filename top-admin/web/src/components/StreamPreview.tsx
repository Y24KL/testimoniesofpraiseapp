import { useEffect, useRef, useState } from 'react';

/** Lets the admin check that a stream URL actually plays before going live. */
export function StreamPreview({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const v = ref.current;
    setError('');
    if (!v || !url) return;
    if (!/\.m3u8(\?|$)/i.test(url)) {
      v.src = url;
      return;
    }
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url; // Safari plays HLS natively
      return;
    }
    let destroy: (() => void) | undefined;
    let cancelled = false;
    // hls.js is only downloaded when someone actually tests a stream.
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) return setError('This browser can’t preview HLS.');
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (d.fatal) setError('The stream didn’t load. It may be offline, blocked (CORS), or not an HLS link.');
      });
      hls.loadSource(url);
      hls.attachMedia(v);
      destroy = () => hls.destroy();
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  return (
    <div className="preview">
      <video ref={ref} controls muted playsInline />
      {error ? <div className="msg err">{error}</div> : null}
    </div>
  );
}
