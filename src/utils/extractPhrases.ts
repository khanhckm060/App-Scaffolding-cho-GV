/**
 * Extract phrases (2-4 từ) chứa vocabulary từ paragraph.
 * Phrase = consecutive words trong paragraph, có chứa ít nhất 1 vocab.
 * Loại bỏ duplicates.
 */
export function extractPhrases(paragraph: string, vocabulary: string[]): string[] {
  if (!paragraph || !vocabulary || vocabulary.length === 0) return [];

  const cleanText = paragraph.replace(/[.,!?;:"]/g, '').toLowerCase();
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const vocabLower = vocabulary.map(v => v.toLowerCase());
  const phrases = new Set<string>();
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (vocabLower.includes(word)) {
      // Create phrases with lengths 2, 3, 4 that include the current word
      for (let len = 2; len <= 4; len++) {
        for (let s = Math.max(0, i - (len - 1)); s <= i; s++) {
          if (s + len <= words.length) {
            const phraseWords = words.slice(s, s + len);
            const phrase = phraseWords.join(' ');
            if (phrase.split(' ').length === len) {
              phrases.add(phrase);
            }
          }
        }
      }
    }
  }
  
  // Return a diverse selection, but limit the number
  return Array.from(phrases).slice(0, 15);
}
