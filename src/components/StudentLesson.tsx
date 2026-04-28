import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Lesson, Result } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, CheckCircle2, ArrowRight, Play, Pause, RotateCcw, 
  Check, X, Trophy, Share2, User, ChevronRight, ChevronLeft,
  Info, Type as TypeIcon, FileText, HelpCircle, BookOpen,
  GraduationCap, Headphones, Mail, AlertCircle, Loader2,
  Mic, Square, ExternalLink, AlertTriangle, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn, isInAppBrowser, getDirectAudioUrl } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function StudentLesson() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [step, setStep] = useState(0); // 0: Intro, 1: Meaning, 2: Review, 3: Audio Practice, 4: Dictation, 5: Gap-fill, 6: MCQ, 7: Result
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewListenCount, setReviewListenCount] = useState(0);
  const [reviewFeedback, setReviewFeedback] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [audioPracticeIndex, setAudioPracticeIndex] = useState(0);
  const [dictationFeedback, setDictationFeedback] = useState<{ word: string; isCorrect: boolean }[][]>([]);
  const [answers, setAnswers] = useState<any>({
    step2: [], // Vocabulary Review (Pronunciation)
    step4: [], // Dictation
    step5: [], // Gap-fill
    step6: [], // MCQ
    reading: [] // Reading questions
  });
  const [isRecording, setIsRecording] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [readingChecked, setReadingChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [highlights, setHighlights] = useState<{ start: number; end: number; color: string }[]>([]);
  const [activeHighlightColor, setActiveHighlightColor] = useState<string>('yellow');
  const [showHighlightMenu, setShowHighlightMenu] = useState<{ x: number, y: number } | null>(null);
  const [tempSelection, setTempSelection] = useState<Range | null>(null);
  const passageRef = useRef<HTMLDivElement>(null);

  const colors = {
    yellow: 'bg-yellow-200 text-slate-900',
    green: 'bg-emerald-200 text-slate-900',
    blue: 'bg-sky-200 text-slate-900',
  };
  const [error, setError] = useState<string | null>(null);
  const [gapFillChecked, setGapFillChecked] = useState(false);
  const [mcqChecked, setMcqChecked] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setStudentName(user.displayName || '');
        setStudentEmail(user.email || '');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    if (isInAppBrowser()) {
      alert("Google không cho phép đăng nhập trong ứng dụng này (Zalo/Facebook/Messenger). Vui lòng copy link và mở bằng Chrome hoặc Safari để tiếp tục.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setStudentName(result.user.displayName || '');
        setStudentEmail(result.user.email || '');
      }
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      if (error.code === 'auth/disallowed-useragent') {
        setError("Trình duyệt này không được hỗ trợ. Vui lòng mở link bằng Chrome hoặc Safari.");
      } else {
        setError("Failed to sign in with Google. Please try again.");
      }
    }
  };

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId) return;
      try {
        const docRef = doc(db, 'lessons', lessonId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Lesson;
          setLesson({ id: docSnap.id, ...data } as Lesson);
          if (data.type === 'listening' && data.steps?.step2?.phrases) {
            setDictationFeedback(new Array(data.steps.step2.phrases.length).fill([]));
          }
        }
      } catch (err: any) {
        console.error("Error fetching lesson:", err);
        if (err.code === 'resource-exhausted') {
          setError("Hệ thống đang tạm thời quá tải lượt truy cập (Quota Exceeded). Vui lòng quay lại sau.");
        } else {
          setError("Không thể tải bài học. Vui lòng thử lại sau.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [lessonId]);

  const speak = (text: string, rate = 1) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a high-quality English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')) && 
      v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    } else {
      utterance.lang = 'en-US';
    }
    
    utterance.rate = isSlow ? rate * 0.6 : rate;
    window.speechSynthesis.speak(utterance);
  };

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    audio.playbackRate = isSlow ? 0.6 : 1;
    if (lesson?.audioStart) {
      if (audio.currentTime < lesson.audioStart) {
        audio.currentTime = lesson.audioStart;
      }
    }
  };

  const handleAudioTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (lesson?.audioEnd && lesson.audioEnd > 0) {
      if (audio.currentTime >= lesson.audioEnd) {
        audio.pause();
        audio.currentTime = lesson.audioStart || 0;
      }
    }
  };

  const handlePassageSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setShowHighlightMenu(null);
      return;
    }

    const range = selection.getRangeAt(0);
    // Check if selection is within the passage
    if (passageRef.current && (passageRef.current.contains(range.commonAncestorContainer) || passageRef.current === range.commonAncestorContainer)) {
      const rect = range.getBoundingClientRect();
      setTempSelection(range.cloneRange());
      setShowHighlightMenu({
        x: rect.left + rect.width / 2,
        y: rect.top + window.scrollY - 10
      });
    }
  };

  const addHighlight = (color: string) => {
    if (!tempSelection || !passageRef.current) return;

    const range = tempSelection;
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(passageRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;

    setHighlights([...highlights, { start, end, color }]);
    setShowHighlightMenu(null);
    setTempSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const clearHighlights = () => {
    setHighlights([]);
    setShowHighlightMenu(null);
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    if (highlights.length === 0) return text;

    // Sort highlights by start position
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    
    // Merge overlapping highlights or just render them in order
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    sorted.forEach((h, idx) => {
      if (h.start < lastIndex) return; // Skip overlapping for simplicity

      // Add text before highlight
      if (h.start > lastIndex) {
        result.push(text.substring(lastIndex, h.start));
      }

      // Add highlighted text
      result.push(
        <mark key={`h-${idx}`} className={cn(colors[h.color as keyof typeof colors], "rounded-sm px-0.5")}>
          {text.substring(h.start, h.end)}
        </mark>
      );
      lastIndex = h.end;
    });

    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result;
  };

  const checkDictation = (index: number) => {
    if (!lesson || !lesson.steps?.step2?.phrases?.[index]) return;
    const normalize = (text: string) => 
      text.toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .trim();

    const correctPhrase = normalize(lesson.steps.step2.phrases[index]);
    const userPhrase = normalize(answers.step4[index] || "");
    
    const correctWords = correctPhrase.split(/\s+/);
    const userWords = userPhrase.split(/\s+/);
    
    const feedback = correctWords.map((word, i) => ({
      word,
      isCorrect: userWords[i] === word
    }));
    
    const correctCount = feedback.filter(f => f.isCorrect).length;
    const accuracy = correctCount / correctWords.length;
    const isPassed = accuracy >= 0.8;

    const newFeedback = [...dictationFeedback];
    if (isPassed) {
      newFeedback[index] = feedback;
    } else {
      newFeedback[index] = feedback.map(f => ({ ...f, isCorrect: false }));
    }
    setDictationFeedback(newFeedback);
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setPronunciationScore(null);
      setRecognizedText("");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setRecognizedText(transcript);
      
      const targetWord = lesson?.steps?.step1_5?.questions?.[reviewIndex]?.word || "";
      const score = calculateSimilarity(transcript, targetWord);
      setPronunciationScore(score);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const calculateSimilarity = (s1: string, s2: string) => {
    const normalize = (text: string) => 
      text.toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .trim();
    const w1 = normalize(s1).split(/\s+/);
    const w2 = normalize(s2).split(/\s+/);
    
    let matches = 0;
    w2.forEach(word => {
      if (w1.includes(word)) matches++;
    });
    
    return Math.round((matches / w2.length) * 100);
  };

  const downloadWorksheet = () => {
    if (!lesson) return;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text(lesson.title, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Level: ${lesson.level}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 38);

    let yPos = 50;

    if (lesson.type === 'listening' && lesson.steps) {
      // Step 1: Vocabulary
      doc.setFontSize(14);
      doc.text("1. Vocabulary", 14, yPos);
      yPos += 10;
      
      const vocabData = lesson.steps.step1.vocabulary.map((v, i) => [
        i + 1,
        v.word,
        v.ipa,
        v.vietnameseDefinition,
        v.example
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Word', 'IPA', 'Definition', 'Example']],
        body: vocabData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Step 4: Phrase Dictation
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(14);
      doc.text("4. Phrase Dictation", 14, yPos);
      yPos += 10;
      
      const dictationData = lesson.steps.step2.phrases.map((_, i) => [
        i + 1,
        "...................................................................................................."
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Your Answer']],
        body: dictationData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Step 5: Gap-fill Exercise
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(14);
      doc.text("5. Gap-fill Exercise", 14, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      const gapFillText = (lesson.steps.step3.gapFillText || '').replace(/\[(\d+|BLANK)\]/gi, ' __________________________ ');
      const splitGapFill = doc.splitTextToSize(gapFillText, 180);
      doc.text(splitGapFill, 14, yPos);
      yPos += splitGapFill.length * 5 + 15;

      // Step 6: Comprehension
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(14);
      doc.text("6. Comprehension Questions", 14, yPos);
      yPos += 10;

      const mcqData = lesson.steps.step4.questions.map((q, i) => {
        const options = q.options.map((opt, optIdx) => `${String.fromCharCode(65 + optIdx)}. ${opt}`).join('\n');
        return [i + 1, `${q.question}\n\n${options}`];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Question & Options']],
        body: mcqData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { cellPadding: 5 }
      });

      // --- ANSWER KEY PAGE ---
      doc.addPage();
      yPos = 20;
      doc.setFontSize(18);
      doc.setTextColor(79, 70, 229);
      doc.text("ANSWER KEY", 105, yPos, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      yPos += 15;

      // Script/Passage in Answer Key
      doc.setFontSize(14);
      doc.text("Listening Script", 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      const splitScript = doc.splitTextToSize(lesson.passage || lesson.script || '', 180);
      doc.text(splitScript, 14, yPos);
      yPos += splitScript.length * 5 + 15;

      // Step 4 Answers
      doc.setFontSize(14);
      doc.text("4. Phrase Dictation Answers", 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      lesson.steps.step2.phrases.forEach((phrase, i) => {
        doc.text(`${i + 1}. ${phrase}`, 14, yPos);
        yPos += 6;
      });
      yPos += 10;

      // Step 5 Answers
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(14);
      doc.text("5. Gap-fill Answers", 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.text(lesson.steps.step3.blanks.map((b, i) => `(${i+1}) ${b}`).join("   "), 14, yPos);
      yPos += 15;

      // Step 6 Answers
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(14);
      doc.text("6. Comprehension Answers", 14, yPos);
      yPos += 10;

      const mcqAnswersData = lesson.steps.step4.questions.map((q, i) => [
        i + 1,
        `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`,
        q.explanation
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Correct Answer', 'Explanation']],
        body: mcqAnswersData,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] }, // Green for answers
      });

    } else {
      const tableData: any[] = [];
      if (lesson.sections) {
        lesson.sections.forEach((section, sIdx) => {
          tableData.push([{ content: section.title, colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
          section.questions.forEach((q, qIdx) => {
            tableData.push([
              qIdx + 1,
              q.question,
              q.type === 'multipleChoice' ? q.options?.[Number(q.answer)] : q.answer,
              q.explanation
            ]);
          });
        });
      } else {
        (lesson.readingQuestions || []).forEach((q, i) => {
          tableData.push([
            i + 1,
            q.question,
            q.type === 'multipleChoice' ? q.options?.[Number(q.answer)] : q.answer,
            q.explanation
          ]);
        });
      }

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Question', 'Correct Answer', 'Explanation']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 60 },
          2: { cellWidth: 40 },
          3: { cellWidth: 70 }
        }
      });
    }

    doc.save(`${lesson.title}_Worksheet.pdf`);
  };

  const calculateScore = () => {
    if (!lesson) return 0;
    
    const isAnswerCorrect = (userAnswer: any, correctAnswer: any, type: string) => {
      if (type === 'multipleChoice') return userAnswer === correctAnswer;
      
      const userStr = String(userAnswer || '').toLowerCase().trim();
      const correctStr = String(correctAnswer || '').toLowerCase().trim();
      
      if (userStr === correctStr) return true;
      
      // Fuzzy matching for open-ended questions with > 3 words
      const correctWords = correctStr.split(/\s+/).filter(w => w.length > 0);
      if (correctWords.length > 3) {
        const userWords = userStr.split(/\s+/).filter(w => w.length > 0);
        let matches = 0;
        correctWords.forEach(word => {
          if (userWords.includes(word)) matches++;
        });
        const similarity = matches / correctWords.length;
        return similarity >= 0.8;
      }
      
      return false;
    };

    if (lessonType === 'reading') {
      if (lesson.sections) {
        let total = 0;
        let correct = 0;
        lesson.sections.forEach((section, sIdx) => {
          section.questions.forEach((q, qIdx) => {
            total++;
            const userAns = answers.reading[`${sIdx}-${qIdx}`];
            if (isAnswerCorrect(userAns, q.answer, q.type)) correct++;
          });
        });
        return Math.round((correct / (total || 1)) * 100) / 10;
      }

      const correct = (Array.isArray(answers.reading) ? answers.reading : []).filter((a: any, i: number) => {
        const q = lesson.readingQuestions?.[i];
        if (!q) return false;
        return isAnswerCorrect(a, q.answer, q.type);
      }).length;
      return Math.round((correct / (lesson.readingQuestions?.length || 1)) * 100) / 10;
    }
    
    if (lesson.steps) {
      const step2Count = lesson.steps.step1_5?.questions?.length || 0;
      const step3Count = lesson.steps.step1_6?.questions?.length || 0;
      const step4Count = lesson.steps.step2?.phrases?.length || 0;
      const step5Count = lesson.steps.step3?.blanks?.length || 0;
      const step6Count = lesson.steps.step4?.questions?.length || 0;

      const totalQuestions = step2Count + step3Count + step4Count + step5Count + step6Count;
      if (totalQuestions === 0) return 0;

      // Step 2: Vocabulary Review (Pronunciation)
      const step2Correct = (Array.isArray(answers.step2) ? answers.step2 : []).filter((a: boolean) => a === true).length;
      
      // Step 3 is mandatory to proceed, so it is always correct if we reach result
      let correctCount = step2Correct + step3Count;

      // Step 4: Phrase Dictation
      const correctPhrases = (Array.isArray(answers.step4) ? answers.step4 : []).filter((a: string, i: number) => {
        if (!lesson.steps?.step2?.phrases?.[i]) return false;
        const normalize = (text: string) => 
          text.toLowerCase()
            .replace(/[’‘]/g, "'")
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
            .trim();

        const correctPhrase = normalize(lesson.steps.step2.phrases[i]);
        const userPhrase = normalize(a || "");
        
        const correctWords = correctPhrase.split(/\s+/);
        const userWords = userPhrase.split(/\s+/);
        
        let correctCount = 0;
        correctWords.forEach((word, idx) => {
          if (userWords[idx] === word) correctCount++;
        });
        
        return (correctCount / correctWords.length) >= 0.8;
      }).length;
      correctCount += correctPhrases;

      // Step 5: Gap-fill
      const correctBlanks = (answers.step5 || []).filter((a: string, i: number) => 
        a?.toLowerCase().trim() === (lesson.steps?.step3?.blanks?.[i] || '').toLowerCase().trim()
      ).length;
      correctCount += correctBlanks;

      // Step 6: MCQs
      const correctMCQs = (answers.step6 || []).filter((a: number, i: number) => 
        a === lesson.steps?.step4?.questions?.[i]?.answer
      ).length;
      correctCount += correctMCQs;

      return Math.round((correctCount / totalQuestions) * 100) / 10;
    }

    return 0;
  };

  const submitResult = async () => {
    if (!lesson || !lessonId) return;
    setSubmitting(true);
    setError(null);

    try {
      const score = calculateScore();
      
      // Build details object carefully to avoid undefined values
      const details: any = {};
      if (lessonType === 'listening') {
        details.step1 = true;
        details.step2 = true;
        if (lesson.steps) {
          details.step2_correct = (answers.step2 || []).filter((a: boolean) => a === true).length;
          details.step3_correct = lesson.steps.step1_6?.questions?.length || 0;
          details.step4_correct = (answers.step4 || []).filter((a: string, i: number) => {
            if (!lesson.steps?.step2?.phrases?.[i]) return false;
            const normalize = (text: string) => 
              text.toLowerCase()
                .replace(/[’‘]/g, "'")
                .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
                .trim();

            const correctPhrase = normalize(lesson.steps.step2.phrases[i]);
            const userPhrase = normalize(a || "");
            
            const correctWords = correctPhrase.split(/\s+/);
            const userWords = userPhrase.split(/\s+/);
            
            let correctCount = 0;
            correctWords.forEach((word, idx) => {
              if (userWords[idx] === word) correctCount++;
            });
            
            return (correctCount / correctWords.length) >= 0.8;
          }).length;
          details.step5_correct = (answers.step5 || []).filter((a: string, i: number) => 
            a?.toLowerCase().trim() === (lesson.steps?.step3?.blanks?.[i] || '').toLowerCase().trim()
          ).length;
          details.step6_correct = (answers.step6 || []).filter((a: number, i: number) => 
            a === (lesson.steps?.step4?.questions?.[i]?.answer)
          ).length;
        }
      } else if (lessonType === 'reading') {
        if (lesson.sections) {
          let total = 0;
          let correct = 0;
          lesson.sections.forEach((section, sIdx) => {
            section.questions.forEach((q, qIdx) => {
              total++;
              const userAns = answers.reading[`${sIdx}-${qIdx}`];
              const userStr = String(userAns !== undefined ? userAns : '').toLowerCase().trim();
              const correctStr = String(q.answer !== undefined ? q.answer : '').toLowerCase().trim();
              
              if (userStr === correctStr) {
                correct++;
              } else {
                const correctWords = correctStr.split(/\s+/).filter(w => w.length > 0);
                if (correctWords.length > 3) {
                  const userWords = userStr.split(/\s+/).filter(w => w.length > 0);
                  let matches = 0;
                  correctWords.forEach(word => {
                    if (userWords.includes(word)) matches++;
                  });
                  if (matches / correctWords.length >= 0.8) correct++;
                }
              }
            });
          });
          details.reading = correct;
          details.total_reading = total;
        } else {
          details.total_reading = lesson.readingQuestions?.length || 0;
          details.reading = (Array.isArray(answers.reading) ? answers.reading : []).filter((a: any, i: number) => {
            const q = lesson.readingQuestions?.[i];
            if (!q) return false;
            
            const userStr = String(a !== undefined ? a : '').toLowerCase().trim();
            const correctStr = String(q.answer !== undefined ? q.answer : '').toLowerCase().trim();
            
            if (userStr === correctStr) return true;
            
            const correctWords = correctStr.split(/\s+/).filter(w => w.length > 0);
            if (correctWords.length > 3) {
              const userWords = userStr.split(/\s+/).filter(w => w.length > 0);
              let matches = 0;
              correctWords.forEach(word => {
                if (userWords.includes(word)) matches++;
              });
              return matches / correctWords.length >= 0.8;
            }
            return false;
          }).length;
        }
      }

      const result: Result = {
        lessonId,
        studentName,
        studentEmail: studentEmail.toLowerCase().trim(),
        teacherId: lesson.teacherId || '',
        score,
        details,
        completedAt: new Date().toISOString()
      };

      if (assignmentId) {
        result.assignmentId = assignmentId;
      }

      await addDoc(collection(db, 'results'), result);
      setStep(7);
    } catch (err) {
      console.error("Error submitting result:", err);
      setError("Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.");
      handleFirestoreError(err, OperationType.CREATE, 'results');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="text-slate-500 font-medium animate-pulse">Loading lesson...</p>
    </div>
  );
  
  if (!lesson) return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Lesson not found</h2>
      <p className="text-slate-500 mb-6">The lesson you're looking for doesn't exist or has been removed.</p>
      <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">Go Home</button>
    </div>
  );

  const lessonType = lesson.type || 'listening';
  const currentUrl = window.location.href;

  return (
    <div className="w-full pb-20">
      <AnimatePresence mode="wait">
        {lessonType === 'reading' && step > 0 ? (
          <motion.div 
            key="reading-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full px-2 lg:px-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_200px] gap-8 items-start">
              {/* Left Side: Reference Material (Passage, Signs, Dictionary) */}
              <div className="lg:sticky lg:top-24 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide">
                <div className="space-y-6">
                  {/* Main Reading Heading */}
                  <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-slate-200">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="bg-emerald-500 p-2 rounded-xl">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Reference Panel</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight leading-tight mb-2 italic">
                      {lesson.title}
                    </h1>
                    <p className="text-slate-400 text-sm font-medium">Use the information below to answer the questions on the right.</p>
                  </div>

                  <div className="space-y-8 pb-10">
                    {lesson.passage && (
                      <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 text-slate-700 leading-[1.8] text-lg font-serif">
                        {renderHighlightedText(lesson.passage)}
                      </div>
                    )}
                    
                      {lesson.sections && lesson.sections.map((section, idx) => {
                        let description = section.description || '';
                        
                        // If description is just an instruction, try to find content in questions (fallback)
                        const isInstructionOnly = description.length < 100 && /choose|read|look|decide/i.test(description);
                        
                        const isSign = /\[SIGN\](.*?)\[\/SIGN\]/i.test(description);
                        const isDictionary = /dictionary|vocabulary/i.test(section.title);

                        return (
                          <div key={`desc-${idx}`} className="group scroll-mt-24" id={`stimulus-${idx}`}>
                            <div className="flex items-center space-x-3 mb-4">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">{section.title} REFERENCE</span>
                              <div className="h-px flex-1 bg-slate-100" />
                            </div>
                            
                            {isSign ? (
                              <div className="flex flex-col items-center py-6 space-y-8">
                                {description.match(/\[SIGN\](.*?)\[\/SIGN\]/gi)?.map((match, signIdx) => {
                                  const content = match.replace(/\[SIGN\](.*?)\[\/SIGN\]/i, '$1');
                                  const isSpeed60 = /60/i.test(content) && (/blue/i.test(content) || /speed/i.test(content) || /round/i.test(content));
                                  
                                  if (isSpeed60) {
                                    return (
                                      <div key={`sign-${signIdx}`} className="bg-blue-600 w-56 h-56 rounded-full border-[10px] border-white shadow-2xl flex items-center justify-center relative group hover:scale-105 transition-all duration-500">
                                        <div className="absolute inset-2 border-[2px] border-white/20 rounded-full" />
                                        <div className="flex flex-col items-center">
                                          <span className="text-white font-black text-8xl font-sans tracking-tight leading-none">60</span>
                                        </div>
                                        <div className="absolute -bottom-10 whitespace-nowrap text-[10px] font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Minimum Speed Limit</div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={`sign-${signIdx}`} className="bg-white border-[6px] border-amber-500 rounded-3xl p-10 shadow-2xl shadow-amber-100/50 max-w-sm rotate-1 transform hover:rotate-0 transition-all duration-500 relative flex items-center justify-center min-h-[220px]">
                                      <div className="absolute top-2 left-2 right-2 bottom-2 border border-amber-100 rounded-2xl pointer-events-none" />
                                      <p className="text-amber-900 font-black text-2xl text-center leading-tight uppercase tracking-tight relative z-10 font-sans whitespace-pre-wrap">
                                        {content}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : isDictionary ? (
                              <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-10 shadow-xl shadow-slate-100/50 relative overflow-hidden group">
                                <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                                  <BookOpen className="w-40 h-40 text-emerald-600" />
                                </div>
                                <div className="relative z-10 text-slate-700">
                                  <div className="flex items-center space-x-3 mb-4 border-b border-slate-50 pb-4">
                                    <h4 className="text-3xl font-black text-indigo-900 italic">factor</h4>
                                    <span className="text-sm text-slate-400 font-medium">noun</span>
                                    <div className="flex items-center space-x-1">
                                      <Volume2 className="w-4 h-4 text-indigo-400" />
                                      <span className="text-xs font-mono text-indigo-600">/'fæktə(r)/</span>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <p className="font-bold text-slate-800 text-lg leading-snug">
                                      [countable] one of several things that cause or influence something
                                    </p>
                                    <ul className="space-y-3 pl-4 border-l-2 border-indigo-100">
                                      <li className="text-sm italic text-slate-600 leading-relaxed">• Obesity is a major <span className="font-bold text-indigo-700">risk factor</span> for heart disease.</li>
                                      <li className="text-sm italic text-slate-600 leading-relaxed">• The <span className="font-bold text-indigo-700">deciding factor</span> in choosing the job offer was the opportunity for career advancement.</li>
                                      <li className="text-sm italic text-slate-600 leading-relaxed">• Criminality is associated with a range of individual, family and <span className="font-bold text-indigo-700">environmental factors</span>.</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className={cn(
                                "bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 text-slate-700 leading-[1.8] text-lg transition-all hover:shadow-md whitespace-pre-wrap",
                                (/cloze/i.test(section.title) || /comprehension/i.test(section.title)) && "font-serif"
                              )}>
                                {isInstructionOnly ? (
                                  <div className="flex flex-col items-center py-6 text-slate-300">
                                    <AlertTriangle className="w-10 h-10 mb-2 opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest opacity-50">Reference Material Missing</p>
                                    <p className="text-[10px] mt-1 italic text-center max-w-xs">{description}</p>
                                  </div>
                                ) : (
                                  renderHighlightedText(description)
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {!lesson.passage && (!lesson.sections || lesson.sections.every(s => !s.description)) && (
                      <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 italic text-sm">No specific reading reference for this task.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Questions */}
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 p-8 min-h-screen">
                  <div className="mb-10 flex items-center space-x-4 border-b border-slate-50 pb-8">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
                      <HelpCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Challenge Questions</h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Submit your answers below</p>
                    </div>
                  </div>

                  <div className="space-y-12">
                    {lesson.sections ? (
                      lesson.sections.map((section, sIdx) => (
                        <div key={`section-${section.title}-${sIdx}`} className="space-y-6">
                          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{section.title}</span>
                          </div>
                          <div className="space-y-6">
                            {section.questions.map((q, qIdx) => {
                              const qKey = `${sIdx}-${qIdx}`;
                              
                              // Helper to render sign-like content inside middle panel if needed (optional context)
                              const renderQuestionContent = (text: string) => {
                                const signRegex = /\[SIGN:?\s*(.*?)\]|\[NOTICE:?\s*(.*?)\]|\[ANNOUNCEMENT:?\s*(.*?)\]/i;
                                const match = text.match(signRegex);
                                if (match) {
                                  const signContent = match[1] || match[2] || match[3];
                                  const mainQuestion = text.replace(signRegex, '').trim();
                                  return (
                                    <div className="space-y-4">
                                      <div className="bg-amber-50 border-2 border-amber-500 rounded-lg p-6 text-center">
                                        <p className="text-amber-900 font-bold uppercase tracking-widest text-lg leading-tight">
                                          {signContent}
                                        </p>
                                      </div>
                                      <p className="font-bold text-slate-800 text-lg leading-snug">
                                        {mainQuestion}
                                      </p>
                                    </div>
                                  );
                                }
                                return (
                                  <p className="font-bold text-slate-800 text-lg leading-snug">
                                    {text}
                                  </p>
                                );
                              };

                              const isCorrect = (userAns: any, correctAns: any, type: string) => {
                                const userStr = String(userAns !== undefined ? userAns : '').toLowerCase().trim();
                                const correctStr = String(correctAns !== undefined ? correctAns : '').toLowerCase().trim();
                                if (userStr === correctStr) return true;
                                
                                const correctWords = correctStr.split(/\s+/).filter(w => w.length > 0);
                                if (correctWords.length > 3) {
                                  const userWords = userStr.split(/\s+/).filter(w => w.length > 0);
                                  let matches = 0;
                                  correctWords.forEach(word => {
                                    if (userWords.includes(word)) matches++;
                                  });
                                  return matches / correctWords.length >= 0.8;
                                }
                                return false;
                              };

                              return (
                                <div key={`question-${qKey}`} id={`question-${qKey}`} className="p-8 rounded-[2rem] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all scroll-mt-24 group">
                                  <div className="flex flex-col mb-6">
                                    <div className="flex items-start mb-2">
                                      <span className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black mr-3 shrink-0 mt-0.5 shadow-lg shadow-indigo-100 border border-indigo-400 group-hover:scale-110 transition-transform">
                                        {qIdx + 1}
                                      </span>
                                      <div className="flex-1">
                                        {renderQuestionContent(q.question)}
                                      </div>
                                    </div>
                                    {q.type === 'trueFalse' && (
                                      <p className="text-[10px] font-bold text-indigo-500 mt-1 ml-9 uppercase tracking-wider italic text-left">
                                        Hướng dẫn: Chọn TRUE hoặc FALSE.
                                      </p>
                                    )}
                                    {q.type === 'gapFill' && (
                                      <p className="text-[10px] font-bold text-indigo-500 mt-1 ml-9 uppercase tracking-wider italic text-left">
                                        Hướng dẫn: Điền từ vào ô trống (Không quá 3 từ).
                                      </p>
                                    )}
                                  </div>

                                  {q.type === 'multipleChoice' && q.options && (
                                    <div className="grid grid-cols-1 gap-3">
                                      {q.options.map((opt, optIdx) => (
                                        <button
                                          key={`option-${qKey}-${optIdx}`}
                                          onClick={() => {
                                            if (readingChecked) return;
                                            const newAnswers = { ...answers.reading };
                                            newAnswers[qKey] = optIdx;
                                            setAnswers({ ...answers, reading: newAnswers });
                                          }}
                                          className={cn(
                                            "text-left p-4 rounded-xl border-2 transition-all font-medium",
                                            String(answers.reading[qKey]) === String(optIdx)
                                              ? readingChecked
                                                ? String(optIdx) === String(q.answer)
                                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                                  : "border-red-500 bg-red-50 text-red-700"
                                                : "border-indigo-600 bg-indigo-50 text-indigo-700"
                                              : readingChecked && String(optIdx) === String(q.answer)
                                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                                : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                                          )}
                                        >
                                          <span className="mr-3 text-slate-400 font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {q.type === 'trueFalse' && (
                                    <div className="flex space-x-3 mt-4 ml-9">
                                      {['TRUE', 'FALSE'].map((option) => (
                                        <button
                                          key={`${qKey}-tf-${option}`}
                                          onClick={() => {
                                            if (readingChecked) return;
                                            const newAnswers = { ...answers.reading, [qKey]: option };
                                            setAnswers({ ...answers, reading: newAnswers });
                                          }}
                                          className={cn(
                                            "px-8 py-3 rounded-xl font-bold transition-all border-2",
                                            answers.reading[qKey] === option
                                              ? readingChecked
                                                ? option === String(q.answer).toUpperCase()
                                                  ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100"
                                                  : "bg-red-500 border-red-500 text-white shadow-lg shadow-red-100"
                                                : "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                              : readingChecked && option === String(q.answer).toUpperCase()
                                                ? "bg-emerald-50 border-emerald-500 text-emerald-600"
                                                : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                                          )}
                                        >
                                          {option}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {(q.type === 'matching' || q.type === 'gapFill' || q.type === 'openEnded') && (
                                    <div className="space-y-3">
                                      <input 
                                        type="text"
                                        value={answers.reading[qKey] || ''}
                                        onChange={(e) => {
                                          if (readingChecked) return;
                                          const newAnswers = { ...answers.reading };
                                          newAnswers[qKey] = e.target.value;
                                          setAnswers({ ...answers, reading: newAnswers });
                                        }}
                                        placeholder="Type your answer here..."
                                        className={cn(
                                          "w-full px-4 py-3 rounded-xl border-2 outline-none transition-all font-bold",
                                          readingChecked
                                            ? isCorrect(answers.reading[qKey], q.answer, q.type)
                                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                              : "border-red-500 bg-red-50 text-red-700"
                                            : "border-slate-100 focus:border-indigo-600"
                                        )}
                                      />
                                      {readingChecked && (
                                        <div className="text-xs font-bold text-emerald-600">
                                          Correct Answer: {q.answer}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {readingChecked && q.explanation && (
                                    <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-sm text-indigo-700">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <Info className="w-4 h-4" />
                                        <span className="font-bold uppercase tracking-wider text-[10px]">Explanation</span>
                                      </div>
                                      {q.explanation}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      lesson.readingQuestions?.map((q, i) => (
                        <div key={`rq-${q.question.substring(0, 20)}-${i}`} id={`question-${i}`} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 scroll-mt-24">
                          <div className="flex flex-col mb-4">
                            <p className="font-bold text-slate-800 flex items-start">
                              <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 shrink-0 mt-0.5">{i + 1}</span>
                              {q.question}
                            </p>
                            {q.type === 'trueFalse' && (
                              <p className="text-[10px] font-bold text-indigo-500 mt-1 ml-9 uppercase tracking-wider italic">
                                Hướng dẫn: Điền TRUE, FALSE hoặc NOT GIVEN.
                              </p>
                            )}
                            {q.type === 'gapFill' && (
                              <p className="text-[10px] font-bold text-indigo-500 mt-1 ml-9 uppercase tracking-wider italic">
                                Hướng dẫn: Điền từ vào ô trống (No more than 3 words).
                              </p>
                            )}
                          </div>

                          {q.type === 'multipleChoice' && q.options && (
                            <div className="grid grid-cols-1 gap-3">
                              {q.options.map((opt, optIdx) => (
                                <button
                                  key={`rq-${i}-opt-${optIdx}`}
                                  onClick={() => {
                                    if (readingChecked) return;
                                    const newAnswers = [...(Array.isArray(answers.reading) ? answers.reading : [])];
                                    newAnswers[i] = optIdx;
                                    setAnswers({ ...answers, reading: newAnswers });
                                  }}
                                  className={cn(
                                    "text-left p-4 rounded-xl border-2 transition-all font-medium",
                                    String(answers.reading[i]) === String(optIdx)
                                      ? readingChecked
                                        ? String(optIdx) === String(q.answer)
                                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                          : "border-red-500 bg-red-50 text-red-700"
                                        : "border-indigo-600 bg-indigo-50 text-indigo-700"
                                      : readingChecked && String(optIdx) === String(q.answer)
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                        : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                                  )}
                                >
                                  <span className="mr-3 text-slate-400 font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {(q.type === 'trueFalse' || q.type === 'matching' || q.type === 'gapFill' || q.type === 'openEnded') && (
                            <div className="space-y-3">
                              <input 
                                type="text"
                                value={answers.reading[i] || ''}
                                onChange={(e) => {
                                  if (readingChecked) return;
                                  const newRes = Array.isArray(answers.reading) ? answers.reading : [];
                                  const newAnswers = [...newRes];
                                  newAnswers[i] = e.target.value;
                                  setAnswers({ ...answers, reading: newAnswers });
                                }}
                                placeholder="Type your answer here..."
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border-2 outline-none transition-all font-bold",
                                  readingChecked
                                    ? (answers.reading[i] || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim()
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                      : "border-red-500 bg-red-50 text-red-700"
                                    : "border-slate-100 focus:border-indigo-600"
                                )}
                              />
                              {readingChecked && (
                                <div className="text-xs font-bold text-emerald-600">
                                  Correct Answer: {q.answer}
                                </div>
                              )}
                            </div>
                          )}

                          {readingChecked && q.explanation && (
                            <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-sm text-indigo-700">
                              <div className="flex items-center space-x-2 mb-1">
                                <Info className="w-4 h-4" />
                                <span className="font-bold uppercase tracking-wider text-[10px]">Explanation</span>
                              </div>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-10 pt-8 border-t border-slate-100">
                    {!readingChecked ? (
                      <button
                        onClick={() => setReadingChecked(true)}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-3"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                        <span>Check Answers</span>
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                          <Trophy className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-emerald-900">Well Done!</h3>
                          <p className="text-emerald-700">You've completed the reading exercise.</p>
                          <div className="mt-4 text-4xl font-black text-emerald-600">
                            {calculateScore() * 10}%
                          </div>
                        </div>
                        {error && (
                          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>
                              {typeof error === 'object' ? JSON.stringify(error) : String(error)}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={submitResult}
                          disabled={submitting}
                          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Đang nộp bài...</span>
                            </>
                          ) : (
                            <span>Submit Results & Finish</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Navigation */}
              <div className="hidden lg:block lg:sticky lg:top-24 space-y-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-3">
                  <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Question Grid</h3>
                  <div className="grid grid-cols-5 gap-1">
                    {lesson.sections ? (
                      lesson.sections.map((section, sIdx) => (
                        section.questions.map((_, qIdx) => {
                          const qKey = `${sIdx}-${qIdx}`;
                          return (
                            <button
                              key={`q-grid-btn-${qKey}`}
                              onClick={() => {
                                const el = document.getElementById(`question-${qKey}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              className={cn(
                                "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all border",
                                answers.reading[qKey] !== undefined && answers.reading[qKey] !== ""
                                  ? readingChecked
                                    ? (() => {
                                        const userAns = answers.reading[qKey];
                                        const q = section.questions[qIdx];
                                        if (!q) return false;
                                        if (q.type === 'multipleChoice') return String(userAns) === String(q.answer);
                                        return String(userAns || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim();
                                      })()
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "bg-red-500 border-red-500 text-white"
                                    : "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                  : "bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                              )}
                            >
                              {qIdx + 1}
                            </button>
                          );
                        })
                      ))
                    ) : (
                      lesson.readingQuestions?.map((_, i) => (
                        <button
                          key={`q-grid-btn-${i}`}
                          onClick={() => {
                            const el = document.getElementById(`question-${i}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all border",
                            answers.reading[i] !== undefined && answers.reading[i] !== ""
                              ? readingChecked
                                ? (() => {
                                    const userAns = answers.reading[i];
                                    const q = lesson.readingQuestions?.[i];
                                    if (!q) return false;
                                    if (q.type === 'multipleChoice') return String(userAns) === String(q.answer);
                                    return (userAns || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim();
                                  })()
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "bg-red-500 border-red-500 text-white"
                                : "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                              : "bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                          )}
                        >
                          {i + 1}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm font-bold text-slate-500 mb-2">
                      <span>Progress</span>
                      <span>{Math.round(((Array.isArray(answers.reading) ? answers.reading : []).filter(a => a !== undefined && a !== "").length / (lesson.readingQuestions?.length || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-500" 
                        style={{ width: `${((Array.isArray(answers.reading) ? answers.reading : []).filter(a => a !== undefined && a !== "").length / (lesson.readingQuestions?.length || 1)) * 100}%` }}
                      />
                    </div>

                    {!readingChecked ? (
                      <button
                        onClick={() => setReadingChecked(true)}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-100"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Check Answers</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {error && (
                          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[10px] font-medium flex items-center space-x-2">
                            <AlertCircle className="w-3 h-3" />
                            <span>
                              {typeof error === 'object' ? JSON.stringify(error) : String(error)}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={submitResult}
                          disabled={submitting}
                          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Finishing...</span>
                            </>
                          ) : (
                            <>
                              <Trophy className="w-4 h-4" />
                              <span>Finish Lesson</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : step === 0 && (
          <motion.div 
            key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="max-w-4xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 shadow-xl text-center"
          >
            <div className="bg-indigo-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <BookOpen className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4">{lesson.title}</h1>
            
            {!user ? (
              <div className="max-w-sm mx-auto space-y-6">
                {isInAppBrowser() && (
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-left mb-6">
                    <div className="flex items-center space-x-2 text-amber-800 font-bold mb-3">
                      <AlertTriangle className="w-5 h-5" />
                      <span>Lưu ý quan trọng</span>
                    </div>
                    <p className="text-sm text-amber-700 mb-4 leading-relaxed">
                      Bạn đang mở link trong ứng dụng (Zalo/Facebook). Google không cho phép đăng nhập tại đây. 
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Đã copy link! Vui lòng dán vào Chrome hoặc Safari.");
                      }}
                      className="w-full flex items-center justify-center space-x-2 bg-white border border-amber-200 text-amber-700 py-3 rounded-xl text-sm font-bold hover:bg-amber-50 transition-all shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Copy Link để mở Chrome/Safari</span>
                    </button>
                  </div>
                )}
                <p className="text-slate-500 text-lg">Vui lòng đăng nhập bằng Gmail để bắt đầu bài học.</p>
                <button 
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center space-x-3 bg-white text-slate-700 border-2 border-slate-100 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm active:scale-95"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                  <span>Đăng nhập với Google</span>
                </button>
              </div>
            ) : (
              <div className="max-w-sm mx-auto space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Thông tin học viên</div>
                  <div className="flex items-center space-x-4">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                        {(user.displayName || 'U').charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900">{user.displayName}</div>
                      <div className="text-sm text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setStep(1)}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 active:scale-95"
                >
                  <span>Bắt đầu bài học</span>
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            )}
            
            <div className="max-w-sm mx-auto mt-8">
              <button 
                onClick={() => setShowQR(!showQR)}
                className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 transition-colors mx-auto text-sm font-medium"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Lesson</span>
              </button>

              {showQR && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center space-y-4"
                >
                  <QRCodeSVG value={currentUrl} size={160} />
                  <p className="text-xs text-slate-400 break-all">{currentUrl}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {lessonType === 'listening' && step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-5xl mx-auto space-y-8"
          >
            <StepHeader current={1} total={6} title="Meaning & Pronunciation" icon={BookOpen} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(lesson.steps?.step1?.vocabulary || []).length > 0 ? (
                (lesson.steps?.step1?.vocabulary || []).map((v, i) => (
                  <div key={`vocab-${v.word}-${i}`} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{v.word}</h3>
                        <span className="text-indigo-600 font-mono text-sm">{v.ipa}</span>
                      </div>
                      <button 
                        onClick={() => speak(v.word)}
                        className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-indigo-600 font-bold italic text-lg">Nghĩa: {v.vietnameseDefinition}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-indigo-200 italic text-slate-500 text-sm">
                      "{v.example}"
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center">
                  <p className="text-slate-500 italic">No vocabulary found for this lesson.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-8">
              <button 
                onClick={() => setStep(2)}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
              >
                <span>Next: Vocabulary Review</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {lessonType === 'listening' && step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={2} total={6} title="Vocabulary Review" icon={GraduationCap} />
            <div className="max-w-2xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="mb-8">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Question {reviewIndex + 1} of {lesson.steps?.step1_5?.questions?.length || 0}</div>
                <h3 className="text-4xl font-black text-slate-900 mb-4">{lesson.steps?.step1_5?.questions?.[reviewIndex]?.word}</h3>
                <button 
                  onClick={() => {
                    if (lesson.steps?.step1_5?.questions?.[reviewIndex]) {
                      speak(lesson.steps.step1_5.questions[reviewIndex].word);
                      setReviewListenCount(prev => prev + 1);
                    }
                  }}
                  className="p-4 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-600 hover:text-white transition-all relative"
                >
                  <Volume2 className="w-8 h-8" />
                  {reviewListenCount < 3 && (
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                      {reviewListenCount}
                    </span>
                  )}
                </button>
                {reviewListenCount < 3 && (
                  <p className="mt-4 text-amber-600 text-sm font-bold">
                    Nghe thêm {3 - reviewListenCount} lần nữa để hiện nút ghi âm
                  </p>
                )}
              </div>

              {reviewListenCount >= 3 && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center space-y-4">
                    <button 
                      onClick={startRecording}
                      disabled={isRecording || (pronunciationScore !== null && pronunciationScore >= 80)}
                      className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg",
                        isRecording ? "bg-red-500 animate-pulse" : "bg-indigo-600 hover:bg-indigo-700",
                        (pronunciationScore !== null && pronunciationScore >= 80) && "bg-emerald-500 cursor-default"
                      )}
                    >
                      {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
                    </button>
                    <p className="text-slate-500 font-medium">
                      {isRecording ? "Đang lắng nghe..." : "Bấm để phát âm lại"}
                    </p>
                  </div>

                  {recognizedText && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Bạn đã nói:</div>
                      <div className="text-xl font-bold text-slate-700 italic">"{recognizedText}"</div>
                    </div>
                  )}

                  {pronunciationScore !== null && (
                    <div className={cn(
                      "p-6 rounded-2xl border text-center",
                      pronunciationScore >= 80 ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                    )}>
                      <div className="text-4xl font-black mb-2" style={{ color: pronunciationScore >= 80 ? '#059669' : '#d97706' }}>
                        {pronunciationScore}%
                      </div>
                      <p className={cn("font-bold", pronunciationScore >= 80 ? "text-emerald-700" : "text-amber-700")}>
                        {pronunciationScore >= 80 ? "Phát âm tuyệt vời!" : "Phát âm chưa đạt, hãy thử lại!"}
                      </p>
                      
                      {pronunciationScore >= 80 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 pt-4 border-t border-emerald-100"
                        >
                          <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Nghĩa Tiếng Việt:</div>
                          <div className="text-2xl font-bold text-emerald-900">
                            {lesson.steps?.step1_5?.questions?.[reviewIndex]?.options[lesson.steps?.step1_5?.questions?.[reviewIndex]?.answer]}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  <div className="flex space-x-4 pt-4">
                    {pronunciationScore !== null && pronunciationScore < 80 && (
                      <button 
                        onClick={() => {
                          const newAnswers = [...answers.step2];
                          newAnswers[reviewIndex] = false;
                          setAnswers({ ...answers, step2: newAnswers });
                          
                          if (reviewIndex < (lesson.steps?.step1_5?.questions?.length || 0) - 1) {
                            setReviewIndex(reviewIndex + 1);
                            setReviewListenCount(0);
                            setPronunciationScore(null);
                            setRecognizedText("");
                          } else {
                            setStep(3);
                          }
                        }}
                        className="flex-1 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                      >
                        Bỏ qua từ này
                      </button>
                    )}
                    
                    {(pronunciationScore !== null && pronunciationScore >= 80) && (
                      <button 
                        onClick={() => {
                          const newAnswers = [...answers.step2];
                          newAnswers[reviewIndex] = true;
                          setAnswers({ ...answers, step2: newAnswers });

                          if (reviewIndex < (lesson.steps?.step1_5?.questions?.length || 0) - 1) {
                            setReviewIndex(reviewIndex + 1);
                            setReviewListenCount(0);
                            setPronunciationScore(null);
                            setRecognizedText("");
                          } else {
                            setStep(3);
                          }
                        }}
                        className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                      >
                        {reviewIndex < (lesson.steps?.step1_5?.questions?.length || 0) - 1 ? "Từ tiếp theo" : "Hoàn thành bước này"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {lessonType === 'listening' && step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={3} total={6} title="Audio Practice" icon={Headphones} />
            <div className="max-w-2xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="mb-8">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Question {audioPracticeIndex + 1} of {lesson.steps?.step1_6?.questions?.length || 0}</div>
                <h3 className="text-2xl font-bold text-slate-500 mb-6">Listen and choose the correct word</h3>
                <button 
                  onClick={() => {
                    if (lesson.steps?.step1_6?.questions?.[audioPracticeIndex]) {
                      speak(lesson.steps.step1_6.questions[audioPracticeIndex].word);
                    }
                  }}
                  className="p-8 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                >
                  <Volume2 className="w-12 h-12" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(lesson.steps?.step1_6?.questions?.[audioPracticeIndex]?.options || []).map((opt, i) => (
                  <button 
                    key={`step3-q${audioPracticeIndex}-opt-${i}`}
                    onClick={() => {
                      if (lesson.steps?.step1_6?.questions?.[audioPracticeIndex] && i === lesson.steps.step1_6.questions[audioPracticeIndex].answer) {
                        speak("Correct");
                        if (audioPracticeIndex < (lesson.steps.step1_6.questions?.length || 0) - 1) {
                          setAudioPracticeIndex(audioPracticeIndex + 1);
                        } else {
                          setStep(4);
                        }
                      } else {
                        speak("Try again");
                      }
                    }}
                    className="w-full p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all font-black text-2xl text-slate-700"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {lessonType === 'listening' && step === 4 && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={4} total={6} title="Phrase Dictation" icon={TypeIcon} />
            <div className="space-y-6">
              {(lesson.steps?.step2?.phrases || []).map((phrase, i) => (
                <div key={`dictation-phrase-${i}-${phrase.substring(0, 5)}`} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl font-black text-slate-300 w-10">{(i + 1).toString().padStart(2, '0')}</span>
                    <div className="flex-1 flex space-x-2">
                      <input 
                        type="text"
                        value={answers.step4[i] || ''}
                        onChange={(e) => {
                          const newAnswers = [...answers.step4];
                          newAnswers[i] = e.target.value;
                          setAnswers({ ...answers, step4: newAnswers });
                        }}
                        placeholder="Type what you hear..."
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-medium transition-all"
                      />
                      <button 
                        onClick={() => checkDictation(i)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
                      >
                        Check
                      </button>
                    </div>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => speak(phrase, 1)}
                        className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                        title="Normal Speed"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => speak(phrase, 0.7)}
                        className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                        title="Slow Speed"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {dictationFeedback[i] && dictationFeedback[i].length > 0 && (
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      {(() => {
                        const feedback = dictationFeedback[i];
                        const correctCount = feedback.filter((f: any) => f.isCorrect).length;
                        const isPassed = (correctCount / feedback.length) >= 0.8;
                        
                        if (isPassed) {
                          return (
                            <>
                              {feedback.map((item: any, idx: number) => (
                                <span 
                                  key={`feedback-item-${i}-${idx}`}
                                  className={cn(
                                    "px-2 py-1 rounded font-bold text-lg",
                                    item.isCorrect ? "text-emerald-600" : "text-amber-500 bg-amber-50"
                                  )}
                                >
                                  {item.word}
                                </span>
                              ))}
                              <div className="w-full mt-2 flex items-center space-x-2 text-emerald-600 font-bold">
                                <CheckCircle2 className="w-5 h-5" />
                                <span>{correctCount === feedback.length ? "Correct! Well done." : "Good enough! (80%+ correct)"}</span>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <div className="w-full flex items-center space-x-2 text-red-500 font-bold">
                              <X className="w-5 h-5" />
                              <span>Still has many incorrect words. Listen again!</span>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-8">
              <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-600 font-bold flex items-center space-x-2">
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button 
                onClick={() => setStep(5)}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
              >
                <span>Next: Gap-fill</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {lessonType === 'listening' && step === 5 && (
          <motion.div 
            key="step5"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-5xl mx-auto space-y-8"
          >
            <StepHeader current={5} total={6} title="Gap-fill Exercise" icon={FileText} />
            <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm leading-relaxed text-lg text-slate-700">
              <div className="mb-8 p-6 bg-indigo-50 rounded-2xl flex items-center justify-between border border-indigo-100">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-600 p-3 rounded-xl text-white">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-indigo-900">Listen to the segment</h4>
                    <p className="text-sm text-indigo-700">Fill in the blanks as you listen.</p>
                  </div>
                </div>
                {lesson.audioUrl && !audioError ? (
                  <div className="flex flex-col items-end space-y-1">
                    <audio 
                      controls 
                      src={getDirectAudioUrl(lesson.audioUrl)} 
                      className="w-full max-w-xs h-10"
                      onPlay={handleAudioPlay}
                      onTimeUpdate={handleAudioTimeUpdate}
                      onError={() => {
                        console.warn("Audio failed to load, falling back to TTS");
                        setAudioError(true);
                      }}
                    />
                    <p className="text-[10px] text-slate-400 italic">Nếu audio không chạy, hệ thống sẽ tự chuyển sang giọng đọc AI</p>
                  </div>
                ) : (
                  <button 
                    onClick={() => speak(lesson.script || '')}
                    className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-sm border border-indigo-100 flex items-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Play AI Voice Fallback</span>
                  </button>
                )}
              </div>

              <div className="whitespace-pre-wrap">
                {(lesson.steps?.step3?.gapFillText || '').replace(/\[\d+\]/g, '[BLANK]').split('[BLANK]').map((part, i, arr) => (
                  <span key={`gapfill-segment-${i}-${part.substring(0, 5)}`}>
                    {part}
                    {i < arr.length - 1 && (
                      <input 
                        type="text"
                        value={answers.step5[i] || ''}
                        onChange={(e) => {
                          const newAnswers = [...answers.step5];
                          newAnswers[i] = e.target.value;
                          setAnswers({ ...answers, step5: newAnswers });
                        }}
                        className={cn(
                          "mx-2 px-3 py-1 w-32 border-b-2 outline-none font-bold bg-indigo-50/30 rounded-t-lg transition-all text-center",
                          gapFillChecked 
                            ? (answers.step5[i] || '').toLowerCase().trim() === (lesson.steps?.step3?.blanks?.[i] || '').toLowerCase().trim()
                              ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                              : "border-red-500 text-red-600 bg-red-50"
                            : "border-indigo-300 focus:border-indigo-600 text-indigo-600"
                        )}
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-8">
              <button onClick={() => setStep(4)} className="text-slate-400 hover:text-slate-600 font-bold flex items-center space-x-2">
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setGapFillChecked(true)}
                  className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-95"
                >
                  Check Answers
                </button>
                <button 
                  onClick={() => setStep(6)}
                  className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                >
                  <span>Next: Comprehension</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {lessonType === 'listening' && step === 6 && (
          <motion.div 
            key="step6"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={6} total={6} title="Comprehension Check" icon={HelpCircle} />
            
            {lesson.audioUrl && !audioError ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="text-indigo-600" />
                  <span className="font-bold text-slate-700">Listen to the segment again</span>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <audio 
                    controls 
                    src={getDirectAudioUrl(lesson.audioUrl)} 
                    className="max-w-xs h-10"
                    onPlay={handleAudioPlay}
                    onTimeUpdate={handleAudioTimeUpdate}
                    onError={() => setAudioError(true)}
                  />
                  <p className="text-[10px] text-slate-400 italic">Nếu audio không chạy, hệ thống sẽ tự dùng giọng đọc AI</p>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 flex items-center justify-center">
                <button 
                  onClick={() => speak(lesson.script || '')}
                  className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Play AI Voice Fallback</span>
                </button>
              </div>
            )}

            {audioError && (
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="text-indigo-600" />
                  <span className="font-bold text-indigo-900">Audio file error - Using AI Voice fallback</span>
                </div>
                <button 
                  onClick={() => speak(lesson.script || '')}
                  className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-sm border border-indigo-100 flex items-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Play AI Voice</span>
                </button>
              </div>
            )}

            <div className="space-y-6">
              {(lesson.steps?.step4?.questions || []).map((q, i) => (
                <div key={`mcq-step6-q-${i}-${q.question.substring(0, 5)}`} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                  <h3 className="text-xl font-bold text-slate-900">{i + 1}. {q.question}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {(q.options || []).map((opt, optIdx) => (
                      <button 
                        key={`mcq-q${i}-opt-${optIdx}-${opt.substring(0, 5)}`}
                        onClick={() => {
                          const newAnswers = [...answers.step6];
                          newAnswers[i] = optIdx;
                          setAnswers({ ...answers, step6: newAnswers });
                        }}
                        className={cn(
                          "w-full text-left px-6 py-4 rounded-xl border-2 transition-all font-medium",
                          answers.step6[i] === optIdx 
                            ? mcqChecked
                              ? optIdx === q.answer
                                ? "bg-emerald-50 border-emerald-600 text-emerald-700"
                                : "bg-red-50 border-red-600 text-red-700"
                              : "bg-indigo-50 border-indigo-600 text-indigo-700" 
                            : mcqChecked && optIdx === q.answer
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-white border-slate-100 hover:border-indigo-200 text-slate-600"
                        )}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                            answers.step6[i] === optIdx 
                              ? mcqChecked
                                ? optIdx === q.answer ? "bg-emerald-600 border-emerald-600 text-white" : "bg-red-600 border-red-600 text-white"
                                : "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-slate-300 text-slate-400"
                          )}>
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span>{opt}</span>
                          {mcqChecked && optIdx === q.answer && <Check className="w-4 h-4 text-emerald-600 ml-auto" />}
                          {mcqChecked && answers.step6[i] === optIdx && optIdx !== q.answer && <X className="w-4 h-4 text-red-600 ml-auto" />}
                        </div>
                      </button>
                    ))}
                  </div>
                  {mcqChecked && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 italic"
                    >
                      <div className="font-bold text-slate-900 mb-1 flex items-center space-x-2">
                        <Info className="w-4 h-4 text-indigo-600" />
                        <span>Explanation:</span>
                      </div>
                      {q.explanation}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-8">
              <button onClick={() => setStep(5)} className="text-slate-400 hover:text-slate-600 font-bold flex items-center space-x-2">
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setMcqChecked(true)}
                  className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-95"
                >
                  Check Answers
                </button>
                <button 
                  onClick={submitResult}
                  disabled={submitting}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Finishing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Finish Lesson</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 7 && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-white p-12 rounded-3xl border border-slate-200 shadow-2xl text-center"
          >
            {calculateScore() >= (lesson?.passingPercentage || 8) ? (
              <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <Trophy className="w-12 h-12 text-emerald-600" />
              </div>
            ) : (
              <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <RotateCcw className="w-12 h-12 text-amber-600" />
              </div>
            )}
            
            <h2 className="text-4xl font-extrabold text-slate-900 mb-2">
              {calculateScore() >= (lesson?.passingPercentage || 8) ? `Chúc mừng, ${studentName}!` : `Cố gắng lên, ${studentName}!`}
            </h2>
            <p className="text-slate-500 mb-10 text-lg">
              {calculateScore() >= (lesson?.passingPercentage || 8) 
                ? "Bạn đã hoàn thành bài học xuất sắc và đạt yêu cầu." 
                : `Bạn cần đạt ít nhất ${(lesson?.passingPercentage || 8).toFixed(1)} điểm để hoàn thành bài tập này.`}
            </p>
            
            <div className={cn(
              "p-8 rounded-3xl mb-10 transition-colors",
              calculateScore() >= (lesson?.passingPercentage || 8) ? "bg-emerald-50" : "bg-amber-50"
            )}>
              <div className={cn(
                "text-6xl font-black mb-2",
                calculateScore() >= (lesson?.passingPercentage || 8) ? "text-emerald-600" : "text-amber-600"
              )}>
                {calculateScore()}
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Score</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
              {lessonType === 'listening' ? (
                <>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-xl font-bold text-slate-900">
                      {(lesson.steps?.step1_5?.questions?.length || 0) + (lesson.steps?.step1_6?.questions?.length || 0)} / {(lesson.steps?.step1_5?.questions?.length || 0) + (lesson.steps?.step1_6?.questions?.length || 0)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Vocab (Step 2&3)</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-xl font-bold text-slate-900">
                      {(answers.step4 || []).filter((a: string, i: number) => {
                        if (!lesson.steps?.step2?.phrases?.[i]) return false;
                        const normalize = (text: string) => 
                          text.toLowerCase()
                            .replace(/[’‘]/g, "'")
                            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
                            .trim();

                        const correctPhrase = normalize(lesson.steps.step2.phrases[i]);
                        const userPhrase = normalize(a || "");
                        
                        const correctWords = correctPhrase.split(/\s+/);
                        const userWords = userPhrase.split(/\s+/);
                        
                        let correctCount = 0;
                        correctWords.forEach((word, idx) => {
                          if (userWords[idx] === word) correctCount++;
                        });
                        
                        return (correctCount / correctWords.length) >= 0.8;
                      }).length} / {lesson.steps?.step2?.phrases?.length || 0}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Dictation (Step 4)</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-xl font-bold text-slate-900">
                      {(Array.isArray(answers.step5) ? answers.step5 : []).filter((a: string, i: number) => a?.toLowerCase().trim() === (lesson.steps?.step3?.blanks?.[i] || '').toLowerCase().trim()).length} / {lesson.steps?.step3?.blanks?.length || 0}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Gap-fill (Step 5)</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm md:col-start-2">
                    <div className="text-xl font-bold text-slate-900">
                      {(Array.isArray(answers.step6) ? answers.step6 : []).filter((a: number, i: number) => a === (lesson.steps?.step4?.questions?.[i]?.answer)).length} / {lesson.steps?.step4?.questions?.length || 0}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">MCQs (Step 6)</div>
                  </div>
                </>
              ) : (
                <div className="col-span-full bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="text-2xl font-bold text-slate-900">
                    {lesson.sections ? (
                      `${calculateScore()} / 10`
                    ) : (
                      `${(Array.isArray(answers.reading) ? answers.reading : []).filter((a: any, i: number) => {
                        const q = lesson.readingQuestions?.[i];
                        if (!q) return false;
                        if (q.type === 'multipleChoice') return a === q.answer;
                        return (a || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim();
                      }).length} / ${lesson.readingQuestions?.length}`
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-400 uppercase mt-1">Reading Score</div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => window.location.reload()}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95",
                  calculateScore() >= (lesson?.passingPercentage || 8) 
                    ? "bg-slate-900 text-white hover:bg-slate-800" 
                    : "bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-100"
                )}
              >
                {calculateScore() >= (lesson?.passingPercentage || 8) ? "Làm lại bài tập" : "Làm lại ngay (Bắt buộc)"}
              </button>

              <button 
                onClick={downloadWorksheet}
                className="w-full flex items-center justify-center space-x-2 bg-indigo-50 text-indigo-700 py-4 rounded-xl font-bold text-lg hover:bg-indigo-100 transition-all active:scale-95"
              >
                <Download className="w-5 h-5" />
                <span>Download Worksheet (Answers)</span>
              </button>
              
              {calculateScore() >= (lesson?.passingPercentage || 8) && (
                <button 
                  onClick={() => navigate('/student')}
                  className="w-full bg-white text-slate-600 border border-slate-200 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all active:scale-95"
                >
                  Quay lại Dashboard
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step > 0 && step < 7 && (
        <div className="fixed bottom-8 right-8 z-50">
          <button 
            onClick={() => setIsSlow(!isSlow)}
            className={cn(
              "flex items-center space-x-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95",
              isSlow ? "bg-amber-500 text-white" : "bg-white text-slate-600 border border-slate-200"
            )}
          >
            <RotateCcw className={cn("w-5 h-5", isSlow && "animate-spin-slow")} />
            <span>{isSlow ? "Slow Mode ON" : "Slow Mode OFF"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function StepHeader({ current, total, title, icon: Icon }: { current: number, total: number, title: string, icon: any }) {
  return (
    <div className="flex items-center justify-between mb-12">
      <div className="flex items-center space-x-4">
        <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Step {current} of {total}</div>
          <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
        </div>
      </div>
      <div className="flex space-x-2">
        {[1, 2, 3, 4, 5, 6].map(s => (
          <div 
            key={`step-progress-${current}-${s}`} 
            className={cn(
              "w-10 h-2 rounded-full transition-all duration-500",
              s <= current ? "bg-indigo-600" : "bg-slate-200"
            )} 
          />
        ))}
      </div>
    </div>
  );
}
