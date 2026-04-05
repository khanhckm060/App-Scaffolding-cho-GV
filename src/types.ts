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

export interface Lesson {
  id?: string;
  title: string;
  script: string;
  audioUrl?: string;
  audioStart?: number;
  audioEnd?: number;
  vocabulary: VocabularyItem[];
  steps: ScaffoldingSteps;
  teacherId: string;
  createdAt: string;
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
    step1: boolean;
    step2: boolean;
    step3: number; // number of correct blanks
    step4: number; // number of correct MCQs
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
}
