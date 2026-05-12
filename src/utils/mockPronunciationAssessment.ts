import { PronunciationResult, WordAssessment } from '../types';

/**
 * MOCK function - sẽ replace bằng Azure Speech API sau.
 * Random scores 60-95% để demo UI.
 * TODO: Replace with real API call to /api/speaking-assess
 */
export async function mockAssessPronunciation(
  audioBlob: Blob,
  targetText: string
): Promise<PronunciationResult> {
  console.log(`[MockAssessment] Assessing audio for text: "${targetText}"`, audioBlob);
  
  // Simulate API delay 2-3 seconds
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
  
  const words = targetText.split(/\s+/).filter(w => w.length > 0);
  const wordAssessments: WordAssessment[] = words.map(word => {
    const score = 60 + Math.random() * 38; // 60-98
    return {
      word: word.replace(/[.,!?;:()]/g, ""),
      accuracyScore: Math.round(score),
      errorType: score < 70 ? (Math.random() > 0.5 ? 'Mispronunciation' : 'Omission') : 'None'
    };
  });
  
  const avgAccuracy = wordAssessments.reduce((sum, w) => sum + w.accuracyScore, 0) / wordAssessments.length;
  const fluency = 70 + Math.random() * 25;
  const completeness = 100;
  
  return {
    accuracyScore: Math.round(avgAccuracy),
    fluencyScore: Math.round(fluency),
    completenessScore: completeness,
    pronunciationScore: Math.round(avgAccuracy * 0.7 + fluency * 0.3),
    words: wordAssessments
  };
}
