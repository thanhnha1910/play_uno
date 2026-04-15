import React, { useState, useEffect, useRef } from 'react';

const MUSIC_TRACKS = [
  '/audio/nghe_nhu_tinh_yeu.mp4',
  '/audio/nguoi_im_lang.mp4',
  '/audio/ngu_mot_minh.mp4'
];

export default function MusicPlayer() {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Auto-play on first click anywhere on the document (browser restriction workaround)
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!isPlaying) {
        setIsPlaying(true);
      }
      document.removeEventListener('click', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    return () => document.removeEventListener('click', handleFirstInteraction);
  }, [isPlaying]);

  // Handle track ending -> next track
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleEnded = () => {
      setCurrentTrack((prev) => (prev + 1) % MUSIC_TRACKS.length);
    };

    audioEl.addEventListener('ended', handleEnded);
    return () => {
      audioEl.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Sync isPlaying state with audio element or when track changes
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (isPlaying) {
      audioEl.play().catch(() => setIsPlaying(false));
    } else {
      audioEl.pause();
    }
  }, [isPlaying, currentTrack]);

  return (
    <>
      <audio ref={audioRef} src={MUSIC_TRACKS[currentTrack]} />
      <div
        className={`music-toggle ${isPlaying ? 'music-playing' : ''}`}
        onClick={() => setIsPlaying(!isPlaying)}
        title={isPlaying ? "Tạm dừng nhạc" : "Phát nhạc"}
      >
        <div className="music-bars">
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </div>
      </div>
    </>
  );
}
