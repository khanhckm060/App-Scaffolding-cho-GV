import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { generateWritingLesson } from '../services/gemini';
import { LessonLevel, LEVEL_DESCRIPTIONS } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { motion } from 'motion/react';
import { PenTool, Sparkles, Loader2, ChevronLeft, BookOpen, Target, GraduationCap } from 'lucide-react';

export default function WritingLessonCreator() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    vocabularyList: '',
    grammarPoint: '',
    level: 'B1' as LessonLevel
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const lessonContent = await generateWritingLesson(formData);
      
      try {
        await addDoc(collection(db, 'lessons'), {
          ...lessonContent,
          type: 'writing',
          level: formData.level,
          topic: formData.topic,
          grammarPoint: formData.grammarPoint,
          teacherId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'lessons');
      }

      navigate('/teacher?tab=lessons');
    } catch (error) {
      console.error("Failed to generate writing lesson:", error);
      alert("Có lỗi xảy ra khi tạo bài tập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <button 
        onClick={() => navigate('/teacher')}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-8 transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
        Quay lại Dashboard
      </button>

      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl shadow-slate-200/50">
        <div className="flex items-center space-x-4 mb-10">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200">
            <PenTool className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Thiết kế bài tập Viết</h2>
            <p className="text-slate-500">AI sẽ giúp bạn soạn thảo lộ trình luyện viết 5 bước chuyên sâu.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-slate-700 uppercase tracking-wider">
                <BookOpen className="w-4 h-4 mr-2 text-indigo-500" />
                Tên bài học
              </label>
              <input 
                type="text" 
                required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="Ví dụ: Luyện viết về Environment"
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all bg-slate-50/50"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-slate-700 uppercase tracking-wider">
                <GraduationCap className="w-4 h-4 mr-2 text-indigo-500" />
                Trình độ mục tiêu
              </label>
              <select 
                value={formData.level}
                onChange={e => setFormData({...formData, level: e.target.value as LessonLevel})}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 appearance-none"
              >
                {Object.entries(LEVEL_DESCRIPTIONS).map(([lvl, desc]) => (
                  <option key={lvl} value={lvl}>{lvl} - {desc}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-slate-700 uppercase tracking-wider">
                <Target className="w-4 h-4 mr-2 text-indigo-500" />
                Chủ đề hoặc Từ vựng
              </label>
              <input 
                type="text" 
                required
                value={formData.topic}
                onChange={e => setFormData({...formData, topic: e.target.value})}
                placeholder="Ví dụ: Climate Change hoặc nhập list từ vựng..."
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all bg-slate-50/50"
              />
              <p className="text-[10px] text-slate-400 italic">Nhập chủ đề để AI tự gợi ý từ vựng, hoặc nhập danh sách từ cách nhau bằng dấu phẩy.</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-slate-700 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                Chủ điểm ngữ pháp
              </label>
              <input 
                type="text" 
                required
                value={formData.grammarPoint}
                onChange={e => setFormData({...formData, grammarPoint: e.target.value})}
                placeholder="Ví dụ: Passive Voice, Relative Clauses..."
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all bg-slate-50/50"
              />
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>AI đang biên soạn bài tập...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Tạo bài tập với AI</span>
                </>
              )}
            </button>
            <p className="text-center text-slate-400 text-xs mt-4">
              Quá trình này có thể mất 15-30 giây để AI tạo ra nội dung chất lượng cao.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
