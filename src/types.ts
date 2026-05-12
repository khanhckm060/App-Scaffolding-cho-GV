export interface VocabularyItem {
  word: string;
  ipa: string;
  vietnameseDefinition: string;
  example: string;
}

export interface ScaffoldingSteps {
  step1: {
    vocabulary: VocabularyItem[];
  };
  step1_5: {
    questions: {
      word: string;
      options: string[]; // 4 Vietnamese definitions
      answer: number;
      explanation: string;
    }[];
  };
  step1_6: {
    questions: {
      word: string;
      options: string[]; // 4 English words
      answer: number;
    }[];
  };
  step2: {
    phrases: string[];
  };
  step3: {
    gapFillText: string;
    blanks: string[];
  };
  step4: {
    questions: {
      question: string;
      options: string[];
      answer: number;
      explanation: string;
    }[];
  };
}

export interface WritingSteps {
  step1: {
    vocabulary: VocabularyItem[];
  };
  step2: {
    questions: {
      question: string;
      options: string[];
      answer: number;
      explanation: string;
    }[];
  };
  step3: {
    paragraphs: {
      text: string;
      errors: {
        original: string;
        correction: string;
        explanation: string;
      }[];
    }[];
  };
  step4: {
    questions: {
      vietnamese: string;
      english: string;
      explanation: string;
    }[];
  };
  step5: {
    paragraphs: {
      topic: string;
      vietnamese: {
        topicSentence: string;
        supportingSentence: string;
        example: string;
      };
      english: {
        topicSentence: string;
        supportingSentence: string;
        example: string;
      };
      explanation: string;
    }[];
  };
}

export type LessonLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const LEVEL_DESCRIPTIONS: Record<LessonLevel, string> = {
  'A0': 'ko biết gì',
  'A1': 'Movers trên 10 khiên',
  'A2': 'Flyers trên 10 Khiên hoặc KET',
  'B1': 'PET',
  'B2': 'FCE hoặc 5.5 IELTS',
  'C1': '7.0 IELTS trở lên'
};

export type LessonType = 'listening' | 'reading' | 'speaking' | 'writing';

export interface WordAssessment {
  word: string;
  accuracyScore: number;      // 0-100
  errorType: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion';
  syllables?: {               // Added for syllable-level assessment
    text: string;             // e.g., "pre" or "sent"
    accuracyScore: number;
  }[];
}

export interface PronunciationResult {
  accuracyScore: number;      // 0-100
  fluencyScore: number;       // 0-100 (chỉ có ở Step 4)
  completenessScore: number;  // 0-100
  pronunciationScore: number; // 0-100 (overall)
  words: WordAssessment[];
}

export interface SpeakingLessonExtras {
  paragraph: string;          // Đoạn script original
  cleanedParagraph: string;   // Script đã loại bỏ character markers
  speakingVocabulary: string[];       // Từ vựng cần phát âm đúng
  phrases: string[];          // Extracted/Edited phrases
  sentences: string[];        // Extracted/Edited sentences
  passingPercentages: {
    vocab: number;      // 0-100, ví dụ 80
    phrase: number;
    sentence: number;
    pronunciation: number;  // Step 4 - Phát âm
    fluency: number;        // Step 4 - Trôi chảy
  };
}

export interface SpeakingSubmission {
  id?: string;
  assignmentId: string;
  studentEmail: string;
  studentName: string;
  step1Results: PronunciationResult[];  // 1 result per vocab
  step2Results: PronunciationResult[];  // 1 result per phrase
  step3Results: PronunciationResult[];  // 1 result per sentence
  step4Result: PronunciationResult;     // 1 result for paragraph
  overallScore: number;
  completedAt: string;
}

export interface Lesson {
  id?: string;
  type: LessonType;
  title: string;
  level: LessonLevel;
  script?: string; // For listening
  passage?: string; // For reading (single passage or legacy)
  passages?: string[]; // For reading (multiple passages)
  audioUrl?: string;
  audioStart?: number;
  audioEnd?: number;
  vocabulary: VocabularyItem[];
  topic?: string; // For writing/reading context
  grammarPoint?: string; // For writing context
  steps?: ScaffoldingSteps; // For listening
  writingSteps?: WritingSteps; // For writing
  speakingExtras?: SpeakingLessonExtras; // For speaking
  readingQuestions?: ReadingQuestion[]; // For reading (legacy or flat)
  sections?: ExamSection[]; // For structured exams
  teacherId: string;
  createdAt: string;
  passingPercentage?: number;
}

export interface ExamSection {
  title: string;
  description?: string;
  questions: ReadingQuestion[];
}

export interface ReadingQuestion {
  type: string; // multipleChoice, trueFalse, gapFill, matching, openEnded
  question: string;
  options?: string[];
  answer: string | number;
  explanation: string;
}

export interface Result {
  id?: string;
  lessonId: string;
  assignmentId?: string;
  studentName: string;
  studentEmail: string;
  studentId?: string;
  teacherId?: string;
  score: number;
  details: {
    step1?: boolean;
    step2?: boolean;
    step2_correct?: number;
    step3_correct?: number;
    step4_correct?: number;
    step5_correct?: number;
    step6_correct?: number;
    step3?: number; // legacy
    step4?: number; // legacy
    reading?: number; // number of correct reading questions
    total_reading?: number;
    writing_step2_correct?: number;
    writing_step3_correct?: number;
    writing_step4_correct?: number;
    writing_step5_correct?: number;
  };
  completedAt: string;
}

export interface Class {
  id?: string;
  name: string;
  teacherId: string;
  createdAt: string;
}

export interface Student {
  id?: string;
  name: string;
  phone: string;
  email: string;
  classId: string;
  teacherId: string;
}

export interface Assignment {
  id?: string;
  lessonId: string;
  classId: string;
  className?: string;
  studentEmails: string[];
  teacherId: string;
  deadline: string;
  createdAt: string;
  lessonTitle?: string; // For display
  passingPercentage?: number; // New field
}
