/**
 * Extract sentences từ paragraph (split by . ! ?).
 * Chỉ giữ sentences CHỨA ít nhất 1 vocab word.
 */
export function extractSentences(paragraph: string, vocabulary: string[]): string[] {
  if (!paragraph || !vocabulary || vocabulary.length === 0) return [];
  
  const vocabLower = vocabulary.map(v => v.toLowerCase());
  const sentences = paragraph
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences.filter(sentence => {
    const wordsLower = sentence.toLowerCase().replace(/[.,!?;:"]/g, '').split(/\s+/);
    return vocabLower.some(vocab => wordsLower.includes(vocab));
  });
}
