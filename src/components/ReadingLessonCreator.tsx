import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Lesson, ReadingQuestion, LessonLevel, LEVEL_DESCRIPTIONS } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { BookOpen, Sparkles, AlertCircle, ChevronLeft, Send, CheckCircle2, Loader2, Plus, Trash2, FileText, Link as LinkIcon, Upload, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import mammoth from 'mammoth';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default function ReadingLessonCreator() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<LessonLevel>('A2');
  const [sourceType, setSourceType] = useState<'ai' | 'file' | 'link' | 'manual'>('ai');
  const [manualPassage, setManualPassage] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [numPassages, setNumPassages] = useState(1);
  const [questionTypes, setQuestionTypes] = useState({
    matching: true,
    trueFalse: true,
    multipleChoice: true,
    gapFill: false
  });
  const [numQuestions, setNumQuestions] = useState(5);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      setError('Vui lòng tải lên file Word (.docx)');
      return;
    }

    setLoading(true);
    setFileName(file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setFileContent(result.value);
      setError(null);
    } catch (err) {
      console.error('Error parsing docx:', err);
      setError('Không thể đọc file Word này. Vui lòng thử lại hoặc dán văn bản trực tiếp.');
    } finally {
      setLoading(false);
    }
  };

  const generateLesson = async () => {
    if (sourceType === 'ai' && !topic) {
      setError('Vui lòng nhập chủ đề bài đọc');
      return;
    }
    if (sourceType === 'manual' && !manualPassage) {
      setError('Vui lòng nhập nội dung bài đọc');
      return;
    }
    if (sourceType === 'file' && !fileContent) {
      setError('Vui lòng tải lên file Word');
      return;
    }
    if (sourceType === 'link' && !spreadsheetUrl) {
      setError('Vui lòng nhập link spreadsheet hoặc website');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let prompt = '';
      let tools: any[] = [];

      if (sourceType === 'ai') {
        prompt = `Generate an English reading comprehension lesson for level ${level} (CEFR). 
           Topic: ${topic}. 
           Generate ${numPassages} separate passages.
           Include the following question types: ${Object.entries(questionTypes).filter(([_, v]) => v).map(([k]) => k).join(', ')}.
           Generate exactly ${numQuestions} questions for EACH of the ${numPassages} passages.
           Distribute the selected question types randomly and evenly across the passages.`;
      } else if (sourceType === 'link') {
        prompt = `Generate an English reading comprehension lesson for level ${level} (CEFR) based on the content from this URL: ${spreadsheetUrl}.
           Number of passages to extract/generate: ${numPassages}.
           Include the following question types: ${Object.entries(questionTypes).filter(([_, v]) => v).map(([k]) => k).join(', ')}.
           Generate exactly ${numQuestions} questions for EACH of the ${numPassages} passages.
           Distribute the selected question types randomly and evenly across the passages.`;
        tools = [{ urlContext: {} }];
      } else {
        const content = sourceType === 'file' ? fileContent : manualPassage;
        prompt = `Generate comprehension questions for the following English text at level ${level}.
           Text: ${content}
           Number of passages to focus on: ${numPassages}.
           Include the following question types: ${Object.entries(questionTypes).filter(([_, v]) => v).map(([k]) => k).join(', ')}.
           Generate exactly ${numQuestions} questions for EACH of the ${numPassages} passages.
           Distribute the selected question types randomly and evenly across the passages.`;
      }

      prompt += `
           Return the result in JSON format with the following structure:
           {
             "lessons": [
               {
                 "title": "A catchy title for this passage",
                 "passage": "The full reading text for this passage",
                 "vocabulary": [{"word": "string", "ipa": "string", "vietnameseDefinition": "string", "example": "string"}],
                 "questions": [
                   {
                     "type": "matching | trueFalse | multipleChoice | gapFill",
                     "question": "The question text",
                     "options": ["Option A", "Option B", "Option C", "Option D"], // Only for multipleChoice
                     "answer": "The correct answer (string for matching/gapFill, index 0-3 for multipleChoice, 'True'/'False'/'Not Given' for trueFalse)",
                     "explanation": "Why this is the correct answer"
                   }
                 ]
               }
             ]
           }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: tools.length > 0 ? tools : undefined,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lessons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    passage: { type: Type.STRING },
                    vocabulary: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          word: { type: Type.STRING },
                          ipa: { type: Type.STRING },
                          vietnameseDefinition: { type: Type.STRING },
                          example: { type: Type.STRING }
                        },
                        required: ["word", "ipa", "vietnameseDefinition", "example"]
                      }
                    },
                    questions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          type: { type: Type.STRING },
                          question: { type: Type.STRING },
                          options: { type: Type.ARRAY, items: { type: Type.STRING } },
                          answer: { type: Type.STRING },
                          explanation: { type: Type.STRING }
                        },
                        required: ["type", "question", "answer", "explanation"]
                      }
                    }
                  },
                  required: ["title", "passage", "vocabulary", "questions"]
                }
              }
            },
            required: ["lessons"]
          }
        }
      });

      const data = JSON.parse(response.text);
      
      for (const lessonData of data.lessons) {
        const newLesson: Omit<Lesson, 'id'> = {
          type: 'reading',
          title: lessonData.title,
          level: level,
          passage: lessonData.passage,
          vocabulary: lessonData.vocabulary,
          readingQuestions: lessonData.questions,
          teacherId: auth.currentUser?.uid || '',
          createdAt: new Date().toISOString()
        };

        try {
          await addDoc(collection(db, 'lessons'), newLesson);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'lessons');
        }
      }
      navigate('/teacher?tab=lessons');
    } catch (err: any) {
      console.error("Error generating lesson:", err);
      setError("Có lỗi xảy ra khi tạo bài tập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={() => navigate('/teacher')}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-8 transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">Quay lại Dashboard</span>
      </button>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-indigo-100 font-bold tracking-wider uppercase text-sm">Reading Creator</span>
            </div>
            <h1 className="text-3xl font-extrabold">Tạo bài tập Reading mới</h1>
            <p className="text-indigo-100 mt-2">Sử dụng AI để tạo bài đọc và câu hỏi theo chuẩn quốc tế.</p>
          </div>
          <Sparkles className="absolute top-1/2 right-8 -translate-y-1/2 w-32 h-32 text-white/10 rotate-12" />
        </div>

        <div className="p-8 space-y-8">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center space-x-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Nguồn bài đọc
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setSourceType('ai')}
                    className={`py-3 px-4 rounded-xl border-2 font-bold transition-all flex items-center justify-center space-x-2 ${
                      sourceType === 'ai' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>AI tự soạn</span>
                  </button>
                  <button
                    onClick={() => setSourceType('file')}
                    className={`py-3 px-4 rounded-xl border-2 font-bold transition-all flex items-center justify-center space-x-2 ${
                      sourceType === 'file' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>File Word</span>
                  </button>
                  <button
                    onClick={() => setSourceType('link')}
                    className={`py-3 px-4 rounded-xl border-2 font-bold transition-all flex items-center justify-center space-x-2 ${
                      sourceType === 'link' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Link/URL</span>
                  </button>
                  <button
                    onClick={() => setSourceType('manual')}
                    className={`py-3 px-4 rounded-xl border-2 font-bold transition-all flex items-center justify-center space-x-2 ${
                      sourceType === 'manual' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Dán văn bản</span>
                  </button>
                </div>
              </div>

              {sourceType === 'ai' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Chủ đề bài đọc
                  </label>
                  <input 
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="VD: Global Warming, Artificial Intelligence, Travel..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </motion.div>
              )}

              {sourceType === 'file' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Tải lên file Word (.docx)
                  </label>
                  <div className="relative group">
                    <input 
                      type="file"
                      accept=".docx"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="word-upload"
                    />
                    <label 
                      htmlFor="word-upload"
                      className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer group"
                    >
                      <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                        <Upload className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                      </div>
                      <span className="font-bold text-slate-700">{fileName || 'Chọn file .docx từ máy tính'}</span>
                      <span className="text-xs text-slate-400 mt-2">Hỗ trợ định dạng Microsoft Word (.docx)</span>
                    </label>
                  </div>
                  {fileContent && (
                    <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm text-emerald-700 font-medium">Đã đọc nội dung file thành công</span>
                    </div>
                  )}
                </motion.div>
              )}

              {sourceType === 'link' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Link Spreadsheet hoặc Website
                  </label>
                  <div className="relative group">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="url"
                      value={spreadsheetUrl}
                      onChange={(e) => setSpreadsheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">
                    AI sẽ tự động truy cập và trích xuất nội dung từ đường dẫn này.
                  </p>
                </motion.div>
              )}

              {sourceType === 'manual' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Nội dung văn bản
                  </label>
                  <textarea 
                    value={manualPassage}
                    onChange={(e) => setManualPassage(e.target.value)}
                    placeholder="Dán nội dung bài đọc tiếng Anh vào đây..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-32 resize-none"
                  />
                </motion.div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Trình độ (CEFR)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['A1', 'A2', 'B1', 'B2', 'C1'] as LessonLevel[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      className={`py-2 rounded-lg border font-bold text-sm transition-all ${
                        level === l 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">
                  {LEVEL_DESCRIPTIONS[level]}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Loại câu hỏi
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'matching', label: 'Nối từ/ý (Matching)' },
                    { id: 'trueFalse', label: 'Đúng/Sai/Không đề cập (T/F/NG)' },
                    { id: 'multipleChoice', label: 'Trắc nghiệm (MCQ)' },
                    { id: 'gapFill', label: 'Điền từ (Gap Fill)' },
                  ].map((type) => (
                    <label key={type.id} className="flex items-center p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox"
                        checked={questionTypes[type.id as keyof typeof questionTypes]}
                        onChange={(e) => setQuestionTypes({...questionTypes, [type.id]: e.target.checked})}
                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 mr-3"
                      />
                      <span className="font-medium text-slate-700">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Số lượng bài đọc (Passages): {numPassages}
                </label>
                <input 
                  type="range"
                  min="1"
                  max="5"
                  value={numPassages}
                  onChange={(e) => setNumPassages(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  <span>1 bài</span>
                  <span>5 bài</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Số lượng câu hỏi (mỗi đoạn): {numQuestions}
                </label>
                <input 
                  type="range"
                  min="3"
                  max="15"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  <span>3 câu</span>
                  <span>15 câu</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button
              onClick={generateLesson}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-3 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Đang xử lý với AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>Tạo bài tập Reading</span>
                </>
              )}
            </button>
            <p className="text-center text-slate-400 text-xs mt-4">
              AI sẽ mất khoảng 10-20 giây để soạn thảo nội dung chất lượng cao.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
