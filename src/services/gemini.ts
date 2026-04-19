import { GoogleGenAI, Type } from "@google/genai";
import { ScaffoldingSteps, VocabularyItem } from "../types";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not defined in process.env");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateScaffolding(script: string, targetVocab: string[]): Promise<ScaffoldingSteps> {
  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert English teacher. Create a listening scaffolding lesson for students based on the provided script and vocabulary.
    
    Input:
    - Script: ${script}
    - Target Vocabulary: ${targetVocab.join(", ")}
    
    Task:
    1. Step 1 (Vocabulary): For EACH target word, provide its IPA, Vietnamese definition, and an example sentence.
    2. Step 1.5 (Vocabulary Review): For EACH target word, create a multiple-choice question (4 options) matching the English word to its Vietnamese definition. Include a short explanation in Vietnamese.
    3. Step 1.6 (Audio Practice): For EACH target word, create a multiple-choice question (4 options) where the student hears the word and chooses the correct English word.
    4. Step 2 (Dictation): Create 5-8 short phrases (3-7 words) from the script. If a target word is not in the script, you can create a phrase for it, but prioritize actual script content.
    5. Step 3 (Gap-fill): Provide the script with "[BLANK]" replacing target vocabulary words that appear in it. If a target word is not in the script, do not create a blank for it.
    6. Step 4 (Comprehension): Create 3-5 multiple-choice questions about the script with detailed Vietnamese explanations.
    
    Important:
    - If a target word is not in the script, still include it in Step 1, 1.5, and 1.6.
    - Return ONLY valid JSON.
    
    JSON Schema:
    {
      "step1": { "vocabulary": [{ "word": "string", "ipa": "string", "vietnameseDefinition": "string", "example": "string" }] },
      "step1_5": { "questions": [{ "word": "string", "options": ["string", "string", "string", "string"], "answer": 0, "explanation": "string" }] },
      "step1_6": { "questions": [{ "word": "string", "options": ["string", "string", "string", "string"], "answer": 0 }] },
      "step2": { "phrases": ["string"] },
      "step3": { "gapFillText": "string", "blanks": ["string"] },
      "step4": { "questions": [{ "question": "string", "options": ["string", "string", "string", "string"], "answer": 0, "explanation": "string" }] }
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          step1: {
            type: Type.OBJECT,
            properties: {
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    ipa: { type: Type.STRING },
                    vietnameseDefinition: { type: Type.STRING },
                    example: { type: Type.STRING },
                  },
                  required: ["word", "ipa", "vietnameseDefinition", "example"],
                },
              },
            },
            required: ["vocabulary"],
          },
          step1_5: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.NUMBER },
                    explanation: { type: Type.STRING },
                  },
                  required: ["word", "options", "answer", "explanation"],
                },
              },
            },
            required: ["questions"],
          },
          step1_6: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.NUMBER },
                  },
                  required: ["word", "options", "answer"],
                },
              },
            },
            required: ["questions"],
          },
          step2: {
            type: Type.OBJECT,
            properties: {
              phrases: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["phrases"],
          },
          step3: {
            type: Type.OBJECT,
            properties: {
              gapFillText: { type: Type.STRING },
              blanks: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["gapFillText", "blanks"],
          },
          step4: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.NUMBER },
                    explanation: { type: Type.STRING },
                  },
                  required: ["question", "options", "answer", "explanation"],
                },
              },
            },
            required: ["questions"],
          },
        },
        required: ["step1", "step1_5", "step1_6", "step2", "step3", "step4"],
      },
    },
  });

  const responseText = result.text;
  if (!responseText) {
    throw new Error("AI returned an empty response. Please try again with a different script or vocabulary.");
  }
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse AI response:", responseText);
    throw new Error("AI response was not in a valid format. Please try again.");
  }
}

export interface ReadingLessonParams {
  topic: string;
  sourceType: 'ai' | 'sample';
  sampleText?: string;
  level: string;
  numPassages: number;
  questionTypes: string[];
  quantityPerType?: number;
}

export async function generateReadingLesson(params: ReadingLessonParams) {
  const prompt = `Role: Bạn là một chuyên gia khảo thí ngôn ngữ và biên soạn tài liệu tiếng Anh (ESL Content Creator), am hiểu sâu sắc khung tham chiếu ngôn ngữ chuẩn Châu Âu (CEFR) và cấu trúc đề thi của Cambridge (Movers, Flyers, KET, PET) cũng như IELTS.

Task: Nhiệm vụ của bạn là tạo ra các bài tập Reading cá nhân hóa dựa trên các thông số đầu vào từ người dùng.

Input Parameters:
- Topic: ${params.topic}
- Source Type: ${params.sourceType === 'ai' ? 'AI tự tạo nội dung' : 'Dựa trên bài mẫu được cung cấp'}
${params.sampleText ? `- Sample Text: ${params.sampleText}` : ''}
- Level: ${params.level}
- Number of Passages: ${params.numPassages}
- Question Types: ${params.questionTypes.join(', ')}
- Quantity per Type: ${params.quantityPerType || 'AI tự quyết định'}

Constraints & Quality Standards:
1. Độ khó (Level): Phải bám sát từ vựng và cấu trúc ngữ pháp của từng cấp độ. Ví dụ: A1 dùng câu đơn, từ vựng hình ảnh; B2 dùng câu phức, từ vựng học thuật.
2. Dạng câu hỏi (Question Types): Phải khớp với định dạng thi thực tế.
   - Nếu chọn A1-A2: Ưu tiên Matching, True/False, Gap-fill ngắn.
   - Nếu chọn B1-B2/IELTS: Ưu tiên Matching Headings, T/F/NG, Multiple Choice phức tạp.

Output Structure:
1. Tiêu đề bài đọc (title).
2. Nội dung bài đọc (passage).
3. Danh sách câu hỏi (questions).
4. Đáp án (answer) và giải thích ngắn gọn lý do chọn (explanation).

Output in JSON format with this structure:
{
  "title": "string",
  "passage": "string",
  "questions": [
    {
      "type": "string",
      "question": "string",
      "options": ["string", "string", "string", "string"], // Only for Multiple Choice
      "answer": "string or number",
      "explanation": "string"
    }
  ],
  "vocabulary": [
    { "word": "string", "ipa": "string", "vietnameseDefinition": "string", "example": "string" }
  ]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          passage: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["type", "question", "answer", "explanation"],
            },
          },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                ipa: { type: Type.STRING },
                vietnameseDefinition: { type: Type.STRING },
                example: { type: Type.STRING },
              },
              required: ["word", "ipa", "vietnameseDefinition", "example"],
            },
          },
        },
        required: ["title", "passage", "questions", "vocabulary"],
      },
    },
  });

  const responseText = response.text;
  return JSON.parse(responseText);
}

export interface WritingLessonParams {
  title: string;
  topic: string;
  vocabularyList?: string;
  grammarPoint: string;
  level: string;
}

export async function generateWritingLesson(params: WritingLessonParams) {
  const prompt = `Role: Bạn là một chuyên gia biên soạn tài liệu tiếng Anh (ESL Content Creator), am hiểu sâu sắc khung tham chiếu ngôn ngữ chuẩn Châu Âu (CEFR) và cấu trúc đề thi IELTS.

Task: Nhiệm vụ của bạn là tạo ra một bài tập Writing cá nhân hóa dựa trên các thông số đầu vào.

Input Parameters:
- Lesson Title: ${params.title}
- Topic: ${params.topic}
- Vocabulary List (if provided): ${params.vocabularyList || 'AI tự tạo dựa trên topic'}
- Grammar Point: ${params.grammarPoint}
- Level: ${params.level}

Output Structure (5 Steps):
1. Step 1 (Vocabulary): Cung cấp 5-8 từ vựng quan trọng liên quan đến topic. Mỗi từ có IPA, nghĩa tiếng Việt và ví dụ.
2. Step 2 (Grammar MCQs): Tạo 20 câu hỏi trắc nghiệm (A, B, C, D) tập trung vào chủ điểm ngữ pháp "${params.grammarPoint}". Mỗi câu có giải thích chi tiết tại sao chọn đáp án đó.
3. Step 3 (Error Identification): Tạo 2 đoạn văn (mỗi đoạn 3-5 câu) có chứa 3-5 lỗi sai về ngữ pháp "${params.grammarPoint}" và có sử dụng từ vựng ở Step 1. Liệt kê các lỗi sai, cách sửa và giải thích.
4. Step 4 (Sentence Translation): Tạo 5 câu tiếng Việt (chứa từ vựng và ngữ pháp yêu cầu), yêu cầu dịch sang tiếng Anh. Cung cấp đáp án và giải thích.
5. Step 5 (IELTS Paragraph): Tạo 1 chủ đề viết đoạn văn IELTS. Cung cấp 1 đoạn văn mẫu 3 câu theo format: Topic sentence -> Supporting sentence -> Example. Đoạn văn phải chứa từ vựng và ngữ pháp yêu cầu. Cung cấp bản dịch tiếng Việt tương ứng cho từng câu.

Output in JSON format with this structure:
{
  "title": "string",
  "vocabulary": [
    { "word": "string", "ipa": "string", "vietnameseDefinition": "string", "example": "string" }
  ],
  "writingSteps": {
    "step1": { "vocabulary": [...] },
    "step2": { "questions": [{ "question": "string", "options": ["string", "string", "string", "string"], "answer": 0, "explanation": "string" }] },
    "step3": { "paragraphs": [{ "text": "string", "errors": [{ "original": "string", "correction": "string", "explanation": "string" }] }] },
    "step4": { "questions": [{ "vietnamese": "string", "english": "string", "explanation": "string" }] },
    "step5": { "paragraphs": [{ "topic": "string", "vietnamese": { "topicSentence": "string", "supportingSentence": "string", "example": "string" }, "english": { "topicSentence": "string", "supportingSentence": "string", "example": "string" }, "explanation": "string" }] }
  }
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                ipa: { type: Type.STRING },
                vietnameseDefinition: { type: Type.STRING },
                example: { type: Type.STRING },
              },
              required: ["word", "ipa", "vietnameseDefinition", "example"],
            },
          },
          writingSteps: {
            type: Type.OBJECT,
            properties: {
              step1: {
                type: Type.OBJECT,
                properties: {
                  vocabulary: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        ipa: { type: Type.STRING },
                        vietnameseDefinition: { type: Type.STRING },
                        example: { type: Type.STRING },
                      },
                      required: ["word", "ipa", "vietnameseDefinition", "example"],
                    },
                  },
                },
                required: ["vocabulary"],
              },
              step2: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        answer: { type: Type.NUMBER },
                        explanation: { type: Type.STRING },
                      },
                      required: ["question", "options", "answer", "explanation"],
                    },
                  },
                },
                required: ["questions"],
              },
              step3: {
                type: Type.OBJECT,
                properties: {
                  paragraphs: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        errors: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              original: { type: Type.STRING },
                              correction: { type: Type.STRING },
                              explanation: { type: Type.STRING },
                            },
                            required: ["original", "correction", "explanation"],
                          },
                        },
                      },
                      required: ["text", "errors"],
                    },
                  },
                },
                required: ["paragraphs"],
              },
              step4: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        vietnamese: { type: Type.STRING },
                        english: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                      },
                      required: ["vietnamese", "english", "explanation"],
                    },
                  },
                },
                required: ["questions"],
              },
              step5: {
                type: Type.OBJECT,
                properties: {
                  paragraphs: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        topic: { type: Type.STRING },
                        vietnamese: {
                          type: Type.OBJECT,
                          properties: {
                            topicSentence: { type: Type.STRING },
                            supportingSentence: { type: Type.STRING },
                            example: { type: Type.STRING },
                          },
                          required: ["topicSentence", "supportingSentence", "example"],
                        },
                        english: {
                          type: Type.OBJECT,
                          properties: {
                            topicSentence: { type: Type.STRING },
                            supportingSentence: { type: Type.STRING },
                            example: { type: Type.STRING },
                          },
                          required: ["topicSentence", "supportingSentence", "example"],
                        },
                        explanation: { type: Type.STRING },
                      },
                      required: ["topic", "vietnamese", "english", "explanation"],
                    },
                  },
                },
                required: ["paragraphs"],
              },
            },
            required: ["step1", "step2", "step3", "step4", "step5"],
          },
        },
        required: ["title", "vocabulary", "writingSteps"],
      },
    },
  });

  const responseText = response.text;
  return JSON.parse(responseText);
}

export interface WritingCheckResult {
  correct: boolean;
  score?: number; // 0-100
  feedback: string;
  suggestedCorrection?: string;
}

export async function checkStep3Correction(original: string, correction: string, studentAnswer: string): Promise<WritingCheckResult> {
  const prompt = `You are an English teacher. 
  Original incorrect sentence: "${original}"
  Target correction: "${correction}"
  Student's answer: "${studentAnswer}"

  Task: Check if the student's answer accurately corrects the error. 
  Rule: Ignore minor mistakes like punctuation or small typos if the main grammar error is fixed. If it matches roughly 80% of the target correction's intent and grammar, mark it as correct.
  
  Return ONLY JSON:
  {
    "correct": boolean,
    "feedback": "string in Vietnamese explaining why or what minor mistake was made"
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING }
        },
        required: ["correct", "feedback"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function checkWritingGrammar(targetVietnamese: string, targetEnglish: string, studentAnswer: string): Promise<WritingCheckResult> {
  const prompt = `You are an English teacher.
  Vietnamese sentence: "${targetVietnamese}"
  Reference English translation: "${targetEnglish}"
  Student's provided translation: "${studentAnswer}"

  Task: 
  1. Check if the student used correct grammar.
  2. If the grammar is correct and the meaning matches the Vietnamese sentence, set "correct" to true.
  3. If there are grammar errors, set "correct" to false and provide specific feedback in Vietnamese on how to fix them.
  4. Accuracy should be around 80% to be considered correct, ignoring very minor punctuation issues.

  Return ONLY JSON:
  {
    "correct": boolean,
    "feedback": "string in Vietnamese detail instructions",
    "suggestedCorrection": "string (the student's sentence with fixes or a better version)"
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING },
          suggestedCorrection: { type: Type.STRING }
        },
        required: ["correct", "feedback", "suggestedCorrection"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function checkParagraphGrammar(topic: string, referenceEnglish: string, studentAnswer: string): Promise<WritingCheckResult> {
  const prompt = `You are an English teacher.
  Paragraph Topic: "${topic}"
  Reference sample paragraph: "${referenceEnglish}"
  Student's written paragraph: "${studentAnswer}"

  Task:
  1. Check if the student's paragraph is grammatically correct.
  2. Ensure it follows the logical flow (Topic -> Supporting -> Example) if applicable.
  3. Set "correct" to true if it is 80% accurate and grammatically sound.
  4. If incorrect, provide detailed feedback in Vietnamese identifying specific errors and how to fix them.

  Return ONLY JSON:
  {
    "correct": boolean,
    "feedback": "string in Vietnamese detail instructions",
    "suggestedCorrection": "string (the student's paragraph with corrections)"
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING },
          suggestedCorrection: { type: Type.STRING }
        },
        required: ["correct", "feedback", "suggestedCorrection"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function explainMCQAnswer(question: string, options: string[], selectedOption: string, isCorrect: boolean, correctAnswer: string): Promise<string> {
  const prompt = `You are an English teacher providing scaffolding feedback. 
  Question: "${question}"
  Options: ${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(", ")}
  Student selected: "${selectedOption}"
  The correct answer is: "${correctAnswer}" (FOR INTERNAL REFERENCE ONLY - DO NOT REVEAL)
  Status: ${isCorrect ? "Correct" : "Incorrect"}

  Task: Provide a short feedback in Vietnamese.
  - CRITICAL: DO NOT reveal the correct answer choice (text or letter) in your explanation.
  - If incorrect: Explain why the student's choice ("${selectedOption}") is wrong. 
    Give a generic hint about the grammar rule needed (e.g., "The subject cannot perform this action", "This requires a passive structure", "Check the tense marker"). 
    The goal is for the student to identify the correct answer themselves based on your hint.
  - If correct: Confirm why their choice is correct based on grammar rules.
  
  Keep it concise (max 2 sentences).
  Return ONLY the explanation string.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  return response.text;
}
