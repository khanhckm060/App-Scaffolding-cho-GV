import { useCallback, useState } from 'react';

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const speak = useCallback((text: string, lang: string = 'en-US', rate: number = 0.9) => {
    if (!window.speechSynthesis) {
      console.error('Browser không hỗ trợ Text-to-Speech');
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean text from character markers if any
    const cleanText = text.replace(/^[A-Za-z][A-Za-z0-9\s]{0,30}:\s*/, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = rate;     // 0.1 - 10 (default 1, chậm hơn = dễ nghe)
    utterance.pitch = 1;        // 0 - 2
    utterance.volume = 1;       // 0 - 1
    
    // Pick a US English female voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang === 'en-US' && v.name.toLowerCase().includes('female')
    ) || voices.find(v => v.lang === 'en-US');
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, []);
  
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);
  
  return { speak, stop, isSpeaking, supported: typeof window !== 'undefined' && !!window.speechSynthesis };
}
