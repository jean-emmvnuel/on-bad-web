// Lecteur d'une note vocale : lecture/pause, forme d'onde qui se colore en avançant (touchable pour sauter),
// temps restant et vitesse ×1 / ×1,5 / ×2. Pas de lecture automatique (forfait internet) ; un seul vocal à la fois.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { claimPlayback, clock } from './voice.js';

const SPEEDS = [1, 1.5, 2];

export function VoiceNote({ audio }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0); // ms
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const duration = audio.durationMs || 0;
  const bars = audio.waveform?.length ? audio.waveform : Array(32).fill(30);
  const progress = duration ? Math.min(1, time / duration) : 0;

  useEffect(() => {
    const el = ref.current;
    const onTime = () => setTime(el.currentTime * 1000);
    const onPlay = () => { claimPlayback(el); setPlaying(true); };
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setTime(0); el.currentTime = 0; };
    const onError = () => { setFailed(true); setPlaying(false); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, []);

  const toggle = () => {
    const el = ref.current;
    if (el.paused) el.play().catch(() => setFailed(true));
    else el.pause();
  };

  const seek = (e) => {
    if (!duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    ref.current.currentTime = (ratio * duration) / 1000;
    setTime(ratio * duration);
  };

  const nextSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    ref.current.playbackRate = next;
    setSpeed(next);
  };

  return (
    <div className="voice" data-voice="" data-playing={playing || undefined}>
      <audio ref={ref} src={audio.src} preload="none" />
      <button className="voice-play" onClick={toggle} aria-label={playing ? 'Mettre en pause' : `Écouter la note vocale (${clock(duration)})`}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <div className="voice-wave" role="slider" tabIndex={0} aria-label="Position dans la note vocale"
        aria-valuemin={0} aria-valuemax={Math.round(duration / 1000)} aria-valuenow={Math.round(time / 1000)}
        onClick={seek}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const t = Math.min(duration, Math.max(0, time + (e.key === 'ArrowRight' ? 5000 : -5000)));
          ref.current.currentTime = t / 1000;
          setTime(t);
        }}>
        {bars.map((h, i) => <i key={i} style={{ height: `${Math.max(8, h)}%` }} data-on={i / bars.length < progress || undefined} />)}
      </div>
      <span className="voice-time">{failed ? 'Indisponible' : clock(playing || time ? duration - time : duration)}</span>
      <button className="voice-speed" onClick={nextSpeed} aria-label={`Vitesse de lecture : ×${speed}`}>×{String(speed).replace('.', ',')}</button>
    </div>
  );
}
