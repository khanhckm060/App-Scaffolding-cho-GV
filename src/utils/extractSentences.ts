/**
 * Tách paragraph thành sentences (kết thúc bằng . ! ?)
 * Chỉ lấy sentences CHỨA vocabulary.
 */
export function extractSentences(paragraph: string, vocabulary: string[]): string[] {
  if (!paragraph || !vocabulary || vocabulary.length === 0) return [];

  // Split by . ! ? while keeping the delimiters
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
  
  return sentences
    .map(s => s.trim())
    .filter(sentence => {
      const sentenceLower = sentence.toLowerCase();
      return vocabulary.some(vocab => {
        const vocabLower = vocab.toLowerCase();
        // Check for whole word match
        const regex = new RegExp(`\\b${vocabLower}\\b`, 'i');
        return regex.test(sentenceLower);
      });
    });
}
