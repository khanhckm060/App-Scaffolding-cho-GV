import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { generateScaffolding } from '../services/gemini';
import { LessonLevel, LEVEL_DESCRIPTIONS } from '../types';
import { stringifyError, getDirectAudioUrl, cn } from '../lib/utils';
import { Sparkles, Send, Loader2, AlertCircle, ChevronDown, Info, Play, CheckCircle2, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function LessonCreator() {
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<LessonLevel>('A0');
  const [script, setScript] = useState('');
  const [vocabInput, setVocabInput] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioStart, setAudioStart] = useState(0);
  const [audioEnd, setAudioEnd] = useState(0);
  const [showAudioHelp, setShowAudioHelp] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState('');
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setLoading(true);
    setError(null);

    if (!process.env.GEMINI_API_KEY) {
      setError("GEMINI_API_KEY is missing. Please add it in the Settings menu to use AI features.");
      setLoading(false);
      return;
    }
    
    if (!auth.currentUser) {
      setError("You must be logged in to create a lesson.");
      setLoading(false);
      return;
    }

    try {
      console.log("Generating lesson with Gemini. API Key present:", !!process.env.GEMINI_API_KEY);
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
      setError(stringifyError(err));
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Audio URL (Required)</label>
              <button 
                type="button"
                onClick={() => setShowAudioHelp(!showAudioHelp)}
                className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center space-x-1"
              >
                <Info className="w-3 h-3" />
                <span>How to get link?</span>
              </button>
            </div>
            
            <div className="flex space-x-2">
              <input 
                type="url" 
                required
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              />
              {audioUrl && (
                <button
                  type="button"
                  disabled={isTestingAudio}
                  onClick={() => {
                    setIsTestingAudio(true);
                    setTestAudioUrl(getDirectAudioUrl(audioUrl));
                  }}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {isTestingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  <span>{isTestingAudio ? 'Loading...' : 'Test Audio'}</span>
                </button>
              )}
            </div>

            {showAudioHelp && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900 space-y-3"
              >
                <div>
                  <p className="font-bold mb-1">1. Dropbox (Khuyên dùng):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-indigo-800">
                    <li>Đăng nhập vào link sau: <a href="https://www.dropbox.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold">https://www.dropbox.com/</a></li>
                    <li>Upload file mp3 lên.</li>
                    <li>Copy link chia sẻ và dán vào khung bên trên.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold mb-1">2. Lấy direct link (bằng trình duyệt Chrome):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-indigo-800">
                    <li>Truy cập trang web có file nghe bạn muốn lấy.</li>
                    <li>Click chuột phải vào chỗ trống bất kì chọn <strong>View Page Source (Xem nguồn trang)</strong>.</li>
                    <li>Nhấn <strong>Control + F</strong> (hoặc Command + F) và tìm từ khóa: <code>.mp3</code></li>
                    <li>Chọn link có dạng: <code>https://..........mp3</code></li>
                    <li>Copy link đó và dán vào khung bên trên.</li>
                  </ul>
                </div>
                <p className="text-xs italic text-indigo-600">Lưu ý: Link phải ở chế độ công khai để học sinh có thể nghe được.</p>
              </motion.div>
            )}

            {isTestingAudio && testAudioUrl && (
              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <audio 
                  src={testAudioUrl} 
                  controls 
                  autoPlay
                  crossOrigin="anonymous"
                  className="h-8 flex-1 max-w-xs"
                  onError={() => {
                    alert("Không thể phát file này. Vui lòng kiểm tra lại link hoặc quyền truy cập.");
                    setIsTestingAudio(false);
                  }}
                />
                <button 
                  type="button"
                  onClick={() => setIsTestingAudio(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
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
            <span className="text-sm font-medium">
              {typeof error === 'object' ? JSON.stringify(error) : String(error)}
            </span>
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
