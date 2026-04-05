import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import { saveAs } from 'file-saver';
import { Lesson } from '../types';

export async function downloadWorksheet(lesson: Lesson) {
  try {
    const doc = new Document({
      sections: [
      {
        properties: {},
        children: [
          // School Header
          new Paragraph({
            children: [
              new TextRun({ text: "ENGLISH SKILLS AI - WORKSHEET", bold: true, color: "4F46E5", size: 20 }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Name: __________________________   Date: ____________", size: 20 }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
          }),

          // Title
          new Paragraph({
            text: lesson.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Level: ${lesson.level}`, bold: true }),
              new TextRun({ text: ` | Type: ${lesson.type.toUpperCase()}`, bold: true }),
              new TextRun({ text: ` | Date: ${new Date(lesson.createdAt).toLocaleDateString()}`, bold: true }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),

          // Content (Passage or Script)
          new Paragraph({
            text: lesson.type === 'reading' ? 'READING PASSAGE' : 'LISTENING SCRIPT',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: lesson.type === 'reading' ? (lesson.passage || '') : (lesson.script || ''),
                size: 24, // 12pt
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 600, line: 360 }, // 1.5 line spacing
          }),

          // Vocabulary
          new Paragraph({
            text: 'VOCABULARY LIST',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...(lesson.vocabulary || []).map(v => 
            new Paragraph({
              children: [
                new TextRun({ text: `• ${v.word} `, bold: true, size: 22 }),
                new TextRun({ text: `(${v.ipa}): `, italics: true, size: 22 }),
                new TextRun({ text: `${v.vietnameseDefinition}`, size: 22 }),
              ],
              indent: { left: 360 },
              spacing: { after: 100 },
            })
          ),
          new Paragraph({ text: '', spacing: { after: 400 } }),

          // Questions
          new Paragraph({
            text: 'PRACTICE QUESTIONS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 600, after: 200 },
          }),
          ...(lesson.type === 'reading' ? (lesson.readingQuestions || []) : (lesson.steps?.step4?.questions || [])).map((q, i) => {
            const questionParagraphs = [
              new Paragraph({
                children: [
                  new TextRun({ text: `${i + 1}. `, bold: true, size: 24 }),
                  new TextRun({ text: q.question, size: 24 }),
                ],
                spacing: { before: 300, after: 150 },
              })
            ];

            if (q.options && q.options.length > 0) {
              q.options.forEach((opt, optIdx) => {
                questionParagraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${String.fromCharCode(65 + optIdx)}. `, bold: true, size: 22 }),
                      new TextRun({ text: opt, size: 22 }),
                    ],
                    indent: { left: 720 },
                    spacing: { after: 80 },
                  })
                );
              });
            } else {
              questionParagraphs.push(
                new Paragraph({
                  text: '__________________________________________________________________',
                  indent: { left: 720 },
                  spacing: { after: 200 },
                })
              );
            }

            return questionParagraphs;
          }).flat(),

          // Answer Key (New Page)
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            text: 'ANSWER KEY & EXPLANATIONS',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),
          ...(lesson.type === 'reading' ? (lesson.readingQuestions || []) : (lesson.steps?.step4?.questions || [])).map((q, i) => {
            let answerText = q.answer.toString();
            if (q.options && q.options.length > 0) {
              const idx = typeof q.answer === 'number' ? q.answer : parseInt(q.answer);
              if (!isNaN(idx) && q.options[idx]) {
                answerText = `${String.fromCharCode(65 + idx)}. ${q.options[idx]}`;
              }
            }

            return [
              new Paragraph({
                children: [
                  new TextRun({ text: `Question ${i + 1}: `, bold: true, size: 24 }),
                  new TextRun({ text: answerText, color: '2E7D32', bold: true, size: 24 }),
                ],
                spacing: { before: 400, after: 150 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Explanation: ', italics: true, bold: true, size: 20, color: '666666' }),
                  new TextRun({ text: q.explanation, italics: true, size: 20, color: '666666' }),
                ],
                indent: { left: 360 },
                spacing: { after: 300 },
              })
            ];
          }).flat(),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${lesson.title.replace(/[^a-z0-9]/gi, '_')}_Worksheet.docx`);
  } catch (error) {
    console.error("Error generating worksheet:", error);
  }
}
