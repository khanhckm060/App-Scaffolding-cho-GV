/**
 * Loại bỏ character markers (Female:, Male:, A:, B:, Person 1:, etc.) khỏi script.
 * Pattern: từ đầu dòng + ":" + space.
 * 
 * Ví dụ:
 *   Input:  "Female: I want to buy.\nMale: What about a bag?"
 *   Output: "I want to buy. What about a bag?"
 */
export function cleanScript(script: string): string {
  if (!script) return "";
  
  return script
    .split('\n')
    .map(line => {
      // Remove pattern "Word:" or "Word Number:" or "A:" at start of line
      // Match: 1-30 chars (letter/number/space), then ":", then optional space
      return line.replace(/^\s*[A-Za-z][A-Za-z0-9\s]{0,30}:\s*/, '');
    })
    .join(' ')                    // Join lines with space
    .replace(/\s+/g, ' ')         // Multiple spaces → single space
    .trim();
}
