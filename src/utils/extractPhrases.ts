/**
 * Tách paragraph thành các phrases (cụm 2-5 từ) chứa vocabulary.
 * Ví dụ: paragraph="I want to buy a present for my mom", vocab=["present", "buy"]
 * → phrases=["want to buy", "buy a present", "a present for"]
 */
export function extractPhrases(paragraph: string, vocabulary: string[]): string[] {
  if (!paragraph || !vocabulary || vocabulary.length === 0) return [];

  const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const phrasesSet = new Set<string>();

  sentences.forEach(sentence => {
    const words = sentence.trim().split(/\s+/);
    
    vocabulary.forEach(vocab => {
      const vocabLower = vocab.toLowerCase();
      
      words.forEach((word, index) => {
        // Simple match, ignoring punctuation at the end of words
        const cleanWord = word.replace(/[.,!?;:()]/g, "").toLowerCase();
        
        if (cleanWord === vocabLower) {
          // Take 1-2 words before and 1-2 words after
          // Try to get a 3-word phrase if possible
          
          // Pattern [prev, word, next]
          if (index > 0 && index < words.length - 1) {
            phrasesSet.add(`${words[index-1]} ${words[index]} ${words[index+1]}`.replace(/[.,!?;:()]/g, ""));
          }
          
          // Pattern [word, next, nextNext]
          if (index < words.length - 2) {
            phrasesSet.add(`${words[index]} ${words[index+1]} ${words[index+2]}`.replace(/[.,!?;:()]/g, ""));
          }

          // Pattern [prevPrev, prev, word]
          if (index > 1) {
            phrasesSet.add(`${words[index-2]} ${words[index-1]} ${words[index]}`.replace(/[.,!?;:()]/g, ""));
          }
        }
      });
    });
  });

  return Array.from(phrasesSet).slice(0, 10); // Limit to 10 phrases
}
