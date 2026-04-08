import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { generateScaffolding } from '../services/gemini';
import { LessonLevel, LEVEL_DESCRIPTIONS } from '../types';
import { Sparkles, Send, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

export default function LessonCreator() {
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<LessonLevel>('A0');
  const [script, setScript] = useState('');
  const [vocabInput, setVocabInput] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioStart, setAudioStart] = useState(0);
  const [audioEnd, setAudioEnd] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  /* 
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File is too large. Please use a file under 5MB or provide a URL.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAudioUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  */

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setLoading(true);
    setError(null);
    
    if (!auth.currentUser) {
      setError("You must be logged in to create a lesson.");
      setLoading(false);
      return;
    }

    try {
      let vocabList = vocabInput.split(',').map(v => v.trim()).filter(v => v.length > 0);
      
      // Fallback: if no commas but multiple words, try splitting by space
      if (vocabList.length === 1 && vocabList[0].split(/\s+/).length > 2) {
        vocabList = vocabInput.split(/\s+/).filter(v => v.length > 0);
      }

      if (vocabList.length === 0) {
        setError("Please provide at least one target vocabulary word.");
        setLoading(false);
        return;
      }

      const steps = await generateScaffolding(script, vocabList);
      
      try {
        await addDoc(collection(db, 'lessons'), {
          type: 'listening',
          title,
          level,
          script,
          audioUrl,
          audioStart,
          audioEnd,
          vocabulary: steps.step1.vocabulary,
          steps,
          teacherId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      } catch (err: any) {
        console.error("Firestore error:", err);
        handleFirestoreError(err, OperationType.CREATE, 'lessons');
      }
      
      navigate('/teacher?tab=lessons');
    } catch (err: any) {
      console.error("Error generating lesson:", err);
      // If it's a Firestore error that was already handled and re-thrown by handleFirestoreError
      // it will be a JSON string. We should try to parse it or just show the message.
      let message = err.message || "Failed to generate lesson. Please check your script and try again.";
      try {
        const parsed = JSON.parse(message);
        if (parsed.error) message = parsed.error;
      } catch (e) {
        // Not a JSON string, use as is
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Create New Lesson</h2>
        <p className="text-slate-500">Provide the content, and our AI will build the scaffolding steps.</p>
      </div>

      <form onSubmit={handleCreate} className="space-y-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Lesson Title</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Introduction to Climate Change"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Target Level</label>
            <div className="relative">
              <select 
                value={level}
                onChange={(e) => setLevel(e.target.value as LessonLevel)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none appearance-none bg-white"
              >
                {(Object.keys(LEVEL_DESCRIPTIONS) as LessonLevel[]).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}: {LEVEL_DESCRIPTIONS[lvl]}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Audio URL (Required)</label>
            <input 
              type="url" 
              required
              value={audioUrl.startsWith('data:') ? '' : audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://example.com/audio.mp3"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Start Time (seconds)</label>
            <input 
              type="number" 
              min="0"
              value={audioStart}
              onChange={(e) => setAudioStart(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">End Time (seconds, 0 for end)</label>
            <input 
              type="number" 
              min="0"
              value={audioEnd}
              onChange={(e) => setAudioEnd(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Target Vocabulary</label>
          <p className="text-xs text-slate-400">Separate words with commas or spaces</p>
          <input 
            type="text" 
            required
            value={vocabInput}
            onChange={(e) => setVocabInput(e.target.value)}
            placeholder="e.g., sustainable, ecosystem, carbon footprint"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Listening Script</label>
          <textarea 
            required
            rows={8}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste the full transcript here..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Generating Scaffolding...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-6 h-6" />
              <span>Generate Lesson</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
