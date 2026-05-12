import { PronunciationResult, WordAssessment } from '../types';

/**
 * MOCK function - sẽ replace bằng Azure Speech API sau.
 * Tự generate syllable breakdown để UI test được.
 * TODO: Replace với real API call tới /api/speaking-assess
 */
export async function mockAssessPronunciation(
  audioBlob: Blob,
  targetText: string
): Promise<PronunciationResult> {
  console.log(`[MockAssessment] Assessing audio for text: "${targetText}"`, audioBlob);
  
  // Simulate API delay 1.5-2.5 seconds
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  
  const words = targetText.split(/\s+/).filter(w => w.length > 0);
  const wordAssessments: WordAssessment[] = words.map(word => {
    const baseScore = 60 + Math.random() * 38; // 60-98
    const syllables = generateMockSyllables(word.replace(/[.,!?;:()]/g, ""), baseScore);

    return {
      word: word.replace(/[.,!?;:()]/g, ""),
      accuracyScore: Math.round(baseScore),
      errorType: baseScore < 70 ? (Math.random() > 0.5 ? 'Mispronunciation' : 'Omission') : 'None',
      syllables
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

/**
 * Fake syllable split - chỉ để demo UI.
 * Real Azure sẽ trả phoneme thật.
 */
function generateMockSyllables(word: string, baseScore: number): { text: string; accuracyScore: number }[] {
  // Nếu từ ngắn (≤ 3 ký tự), không split
  if (word.length <= 3) {
    return [{ text: word, accuracyScore: Math.round(baseScore) }];
  }
  
  // Split tại điểm giữa của từ (đơn giản hóa)
  const midPoint = Math.floor(word.length / 2);
  const firstHalf = word.substring(0, midPoint);
  const secondHalf = word.substring(midPoint);
  
  // Random score cho từng nửa - 1 nửa cao 1 nửa thấp
  const score1 = baseScore + (Math.random() * 20 - 10); // ±10
  const score2 = baseScore + (Math.random() * 20 - 10);
  
  return [
    { text: firstHalf, accuracyScore: Math.round(Math.max(40, Math.min(100, score1))) },
    { text: secondHalf, accuracyScore: Math.round(Math.max(40, Math.min(100, score2))) }
  ];
}
