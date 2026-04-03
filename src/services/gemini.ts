import { GoogleGenAI, Type } from "@google/genai";
import { ScaffoldingSteps, VocabularyItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateScaffolding(script: string, targetVocab: string[]): Promise<ScaffoldingSteps> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert English teacher. Create a listening scaffolding lesson for students.
    
    Input:
    - Script: ${script}
    - Target Vocabulary: ${targetVocab.join(", ")}
    
    Requirements:
    1. Step 1: Provide IPA, Vietnamese definition (NO English definition), and an example sentence for each target word.
    2. Step 1.5 (Vocabulary Review): For each target word, create a multiple-choice question (4 options) where the student matches the English word to its Vietnamese definition. Include a short explanation in Vietnamese for why the answer is correct.
    3. Step 1.6 (Audio Practice): For each target word, create a multiple-choice question (4 options) where the student hears the word and chooses the correct English word from the options.
    4. Step 2 (Dictation): Create short phrases (3-7 words) from the script. Ensure ALL target vocabulary words are used across these phrases. Each phrase MUST contain at least one target word.
    5. Step 3 (Gap-fill): Provide the script with the string "[BLANK]" replacing each target vocabulary word. Do NOT use numbers like [1], [2].
    6. Step 4 (Comprehension): Create 3-5 multiple-choice questions about the script. For each question, provide a detailed explanation in Vietnamese of where the answer is found in the script.
    
    Output in JSON format matching this schema:
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
                    answer: { type: Type.INTEGER },
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
                    answer: { type: Type.INTEGER },
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
                    answer: { type: Type.INTEGER },
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

  return JSON.parse(response.text);
}
