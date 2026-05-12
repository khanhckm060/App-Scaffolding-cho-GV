import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Mic, ArrowLeft, Plus, X, BookOpen, MessageSquare, FileText, ChevronRight, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LessonLevel, LEVEL_DESCRIPTIONS } from '../types';
import { extractPhrases } from '../utils/extractPhrases';
import { extractSentences } from '../utils/extractSentences';
import { cleanScript } from '../utils/cleanScript';
import { cn } from '../lib/utils';

const SpeakingLessonCreator: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<LessonLevel>('A1');
  const [paragraph, setParagraph] = useState('');
  const [vocabInput, setVocabInput] = useState('');
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  
  const [customPhrases, setCustomPhrases] = useState<string[]>([]);
  const [customSentences, setCustomSentences] = useState<string[]>([]);
  
  const [newPhrase, setNewPhrase] = useState('');
  const [newSentence, setNewSentence] = useState('');
  
  const [passingPercentages, setPassingPercentages] = useState({
    vocab: 80,
    phrase: 75,
    sentence: 70,
    pronunciation: 70,
    fluency: 60
  });

  // Auto extract phrases and sentences when paragraph or vocab changes
  useEffect(() => {
    const cleaned = cleanScript(paragraph);
    if (cleaned.length > 10 && vocabulary.length > 0) {
      setCustomPhrases(extractPhrases(cleaned, vocabulary));
      setCustomSentences(extractSentences(cleaned, vocabulary));
    } else {
      setCustomPhrases([]);
      setCustomSentences([]);
    }
  }, [paragraph, vocabulary]);

  const STOP_WORDS = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for', 'my'];

  const handleAddVocab = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && vocabInput.trim()) {
      e.preventDefault();
      
      // Split by spaces, lowercase, and filter
      const words = vocabInput.toLowerCase().split(/\s+/)
        .map(w => w.replace(/[.,!?;:()]/g, "").trim())
        .filter(w => w.length > 0 && !STOP_WORDS.includes(w));
      
      const newVocab = [...vocabulary];
      words.forEach(word => {
        if (!newVocab.includes(word)) {
          newVocab.push(word);
        }
      });
      
      setVocabulary(newVocab);
      setVocabInput('');
    }
  };

  const removeVocab = (index: number) => {
    setVocabulary(vocabulary.filter((_, i) => i !== index));
  };

  const isVocabInParagraph = (word: string) => {
    const cleanParagraph = paragraph.toLowerCase().replace(/[.,!?;:()]/g, " ");
    const wordsInPara = cleanParagraph.split(/\s+/);
    return wordsInPara.includes(word.toLowerCase());
  };

  const handleSave = async () => {
    if (!title || !paragraph || vocabulary.length === 0) {
      alert("Vui lòng điền đầy đủ thông tin (Tiêu đề, Paragraph, ít nhất 1 từ vựng)");
      return;
    }

    // Validation: Each vocab must be a single word (no spaces)
    if (vocabulary.some(v => v.includes(' '))) {
      alert("Mỗi từ khóa vocabulary phải là một từ đơn lẻ (không chứa dấu cách).");
      return;
    }

    // Validation: All vocab must be in paragraph
    const missingVocab = vocabulary.find(v => !isVocabInParagraph(v));
    if (missingVocab) {
      alert(`Từ '${missingVocab}' không có trong đoạn văn. Vui lòng kiểm tra lại.`);
      return;
    }

    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const cleanedParagraph = cleanScript(paragraph);
      await addDoc(collection(db, 'lessons'), {
        type: 'speaking',
        title,
        level,
        vocabulary: [], // Keep compatibility with general Lesson type
        speakingExtras: {
          paragraph,
          cleanedParagraph,
          speakingVocabulary: vocabulary,
          phrases: customPhrases,
          sentences: customSentences,
          passingPercentages
        },
        teacherId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      navigate('/teacher');
    } catch (error) {
      console.error("Error creating speaking lesson:", error);
      alert("Lỗi khi tạo bài tập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/teacher')}
            className="flex items-center text-slate-500 hover:text-slate-900 font-bold transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Quay lại
          </button>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <Mic className="w-8 h-8 text-indigo-600 mr-3" /> Tạo bài tập Nói mới
          </h1>
          <div className="w-24"></div> {/* Spacer */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
              {/* Title & Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tiêu đề bài tập</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Daily Conversations"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Cấp độ</label>
                  <select 
                    value={level}
                    onChange={(e) => setLevel(e.target.value as LessonLevel)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 transition-all outline-none appearance-none bg-white"
                  >
                    {Object.entries(LEVEL_DESCRIPTIONS).map(([lvl, desc]) => (
                      <option key={lvl} value={lvl}>{lvl} - {desc}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Paragraph */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Đoạn văn (Script)</label>
                <textarea 
                  rows={6}
                  value={paragraph}
                  onChange={(e) => setParagraph(e.target.value)}
                  placeholder="Nhập đoạn văn bản học sinh sẽ luyện đọc..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 transition-all outline-none resize-none"
                />
                <p className="mt-2 text-xs text-slate-400 flex justify-between">
                  <span>Tối thiểu 50 ký tự</span>
                  <span>{paragraph.length}/500</span>
                </p>
              </div>

              {/* Vocabulary Tags */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Từ vựng cần Test (Step 1)</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <AnimatePresence>
                    {vocabulary.map((word, idx) => (
                      <motion.span 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        key={idx}
                        className={cn(
                          "flex items-center px-3 py-1.5 rounded-xl text-sm font-bold transition-all",
                          isVocabInParagraph(word) ? "bg-indigo-50 text-indigo-700" : "bg-rose-50 text-rose-700 border border-rose-200"
                        )}
                      >
                        {word}
                        <button onClick={() => removeVocab(idx)} className="ml-2 hover:text-rose-900">
                          <X className="w-4 h-4" />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="relative">
                  <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    value={vocabInput}
                    onChange={(e) => setVocabInput(e.target.value)}
                    onKeyDown={handleAddVocab}
                    placeholder="Nhập từ rồi nhấn Enter..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 transition-all outline-none"
                  />
                </div>
                {vocabulary.some(w => !isVocabInParagraph(w)) && (
                  <p className="mt-2 text-xs text-rose-500 font-medium">Lưu ý: Một số từ vựng không xuất hiện trong đoạn văn trên.</p>
                )}
              </div>
            </div>

            {/* Previews & Customization */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-8">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center">
                <ChevronRight className="w-6 h-6 text-indigo-600 mr-2" /> Tùy chỉnh Steps luyện tập
              </h3>
              
              <div className="grid grid-cols-1 gap-8">
                {/* Phrases Section */}
                <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <BookOpen className="w-5 h-5 mr-2" /> Phrases (Step 2)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {customPhrases.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-bold border border-slate-100 group transition-colors">
                        <span>{p}</span>
                        <button 
                          onClick={() => setCustomPhrases(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newPhrase}
                      onChange={(e) => setNewPhrase(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPhrase.trim()) {
                          e.preventDefault();
                          if (!customPhrases.includes(newPhrase.trim().toLowerCase())) {
                            setCustomPhrases([...customPhrases, newPhrase.trim().toLowerCase()]);
                          }
                          setNewPhrase('');
                        }
                      }}
                      placeholder="Thêm phrase tùy chỉnh..."
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Sentences Section */}
                <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <MessageSquare className="w-5 h-5 mr-2" /> Sentences (Step 3)
                  </label>
                  <div className="space-y-2">
                    {customSentences.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-bold border border-slate-100 group transition-colors">
                        <span className="flex-1">{s}</span>
                        <button 
                          onClick={() => setCustomSentences(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newSentence}
                      onChange={(e) => setNewSentence(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSentence.trim()) {
                          e.preventDefault();
                          if (!customSentences.includes(newSentence.trim())) {
                            setCustomSentences([...customSentences, newSentence.trim()]);
                          }
                          setNewSentence('');
                        }
                      }}
                      placeholder="Thêm câu tùy chỉnh..."
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-8 sticky top-8">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center">
                <Save className="w-6 h-6 text-indigo-600 mr-2" /> Yêu cầu đạt
              </h3>

              <div className="space-y-6">
                {Object.entries(passingPercentages).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {key === 'vocab' ? 'Step 1: Từ vựng' : 
                         key === 'phrase' ? 'Step 2: Phrase' :
                         key === 'sentence' ? 'Step 3: Câu' :
                         key === 'pronunciation' ? 'Step 4: Phát âm' :
                         'Step 4: Fluency'}
                      </span>
                      <span className="font-extrabold text-indigo-600">{val}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      step="5"
                      value={val}
                      onChange={(e) => setPassingPercentages({...passingPercentages, [key]: parseInt(e.target.value)})}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-slate-900 border-b-4 border-slate-950 hover:bg-slate-800 text-white font-extrabold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center group disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <Plus className="w-5 h-5 mr-1.5 group-hover:rotate-90 transition-transform" /> 
                    Tạo bài tập Nói
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeakingLessonCreator;
