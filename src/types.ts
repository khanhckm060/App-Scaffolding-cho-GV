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
  steps?: ScaffoldingSteps; // For listening
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
    step3?: number; // number of correct blanks
    step4?: number; // number of correct MCQs
    reading?: number; // number of correct reading questions
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
