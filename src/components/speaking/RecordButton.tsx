import React, { useState, useEffect } from 'react';
import { Mic, Square, RotateCcw, Play, Loader2, AlertCircle } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { cn } from '../../lib/utils';
import { PronunciationResult } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface RecordButtonProps {
  targetText: string;
  maxDuration?: number;
  onRecorded?: (blob: Blob) => void;
  onAssess: (blob: Blob) => Promise<PronunciationResult>;
  onResult: (result: PronunciationResult) => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({ 
  targetText, 
  maxDuration = 30, 
  onRecorded, 
  onAssess,
  onResult
}) => {
  const { 
    isRecording, 
    audioBlob, 
    audioUrl, 
    duration, 
    startRecording, 
    stopRecording, 
    resetRecording,
    error 
  } = useAudioRecorder();

  const [isAssessing, setIsAssessing] = useState(false);
  const [playbackAudio, setPlaybackAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Stop recording automatically if maxDuration reached
  useEffect(() => {
    if (duration >= maxDuration && isRecording) {
      stopRecording();
    }
  }, [duration, maxDuration, isRecording, stopRecording]);

  const handleStart = async () => {
    resetRecording();
    await startRecording();
  };

  const handleAssess = async () => {
    if (!audioBlob) return;
    setIsAssessing(true);
    try {
      const result = await onAssess(audioBlob);
      onResult(result);
      if (onRecorded) onRecorded(audioBlob);
    } catch (err) {
      console.error("Assessment failed:", err);
    } finally {
      setIsAssessing(false);
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    
    if (isPlaying && playbackAudio) {
      playbackAudio.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setPlaybackAudio(audio);
      setIsPlaying(true);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center p-6 bg-rose-50 rounded-3xl border border-rose-100 text-rose-600">
        <AlertCircle className="w-12 h-12 mb-3" />
        <p className="font-bold text-center mb-2">Lỗi Microphone</p>
        <p className="text-sm text-center mb-4">{error}</p>
        <a 
          href="https://support.google.com/chrome/answer/2693767" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-indigo-600 font-bold underline"
        >
          Cách cấp quyền microphone
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <AnimatePresence mode="wait">
        {!isRecording && !audioBlob && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <button 
              onClick={handleStart}
              className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 mb-4 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
            >
              <Mic className="w-10 h-10" />
            </button>
            <span className="text-slate-500 font-bold">Bấm để ghi âm</span>
          </motion.div>
        )}

        {isRecording && (
          <motion.div 
            key="recording"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <div className="relative w-24 h-24 mb-4">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 bg-rose-500 rounded-full"
              />
              <button 
                onClick={stopRecording}
                className="absolute inset-0 w-24 h-24 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-xl shadow-rose-100 z-10 transition-all active:scale-95"
              >
                <Square className="w-8 h-8 fill-current" />
              </button>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-rose-600 font-extrabold text-2xl tracking-tighter mb-1">
                00:{duration.toString().padStart(2, '0')}
              </span>
              <span className="text-rose-400 font-bold text-xs uppercase tracking-widest animate-pulse">Đang ghi âm...</span>
            </div>
          </motion.div>
        )}

        {!isRecording && audioBlob && !isAssessing && (
          <motion.div 
            key="recorded"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col items-center w-full max-w-xs"
          >
            <div className="flex gap-4 mb-6">
              <button 
                onClick={togglePlayback}
                className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all"
              >
                {isPlaying ? <Square className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
              </button>
              <button 
                onClick={handleStart}
                className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            </div>
            
            <button 
              onClick={handleAssess}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center"
            >
              🚀 Gửi đánh giá
            </button>
          </motion.div>
        )}

        {isAssessing && (
          <motion.div 
            key="assessing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
            <span className="text-slate-500 font-bold animate-pulse">Hệ thống đang phân tích...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecordButton;
