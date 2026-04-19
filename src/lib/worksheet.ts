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
              new TextRun({ text: `Level: ${lesson.level || 'N/A'}`, bold: true }),
              new TextRun({ text: ` | Type: ${(lesson.type || 'listening').toUpperCase()}`, bold: true }),
              new TextRun({ text: ` | Date: ${lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString() : 'N/A'}`, bold: true }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
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
                new TextRun({ text: `• ${v.word || ''} `, bold: true, size: 22 }),
                new TextRun({ text: `(${v.ipa || ''}): `, italics: true, size: 22 }),
                new TextRun({ text: `${v.vietnameseDefinition || ''}`, size: 22 }),
              ],
              indent: { left: 360 },
              spacing: { after: 100 },
            })
          ),
          new Paragraph({ text: '', spacing: { after: 400 } }),

          // Writing Steps (if writing lesson)
          ...(lesson.type === 'writing' && lesson.writingSteps ? [
            // Writing Step 2: MCQ Grammar
            new Paragraph({
              text: 'STEP 2: GRAMMAR PRACTICE (MCQs)',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            ...lesson.writingSteps.step2.questions.map((q, i) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `Question ${i + 1}: `, bold: true, size: 24 }),
                  new TextRun({ text: q.question, size: 24 }),
                ],
                spacing: { before: 300, after: 150 },
              }),
              ...q.options.map((opt, optIdx) => 
                new Paragraph({
                  children: [
                    new TextRun({ text: `${String.fromCharCode(65 + optIdx)}. `, bold: true, size: 22 }),
                    new TextRun({ text: opt, size: 22 }),
                  ],
                  indent: { left: 720 },
                  spacing: { after: 80 },
                })
              )
            ]).flat(),

            // Writing Step 3: Error Identification
            new Paragraph({
              text: 'STEP 3: ERROR IDENTIFICATION',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            ...lesson.writingSteps.step3.paragraphs.map((p, pIdx) => [
              new Paragraph({
                children: [
                    new TextRun({ text: `Paragraph ${pIdx + 1}:`, bold: true, size: 24 }),
                ],
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: p.text, size: 22 }),
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 200, line: 360 },
              }),
              ...p.errors.map((err, eIdx) => 
                new Paragraph({
                  children: [
                    new TextRun({ text: `Error: "${err.original}"`, italics: true, color: "DC2626", size: 22 }),
                    new TextRun({ text: ` -> Correction: ___________________________________`, size: 22 }),
                  ],
                  indent: { left: 360 },
                  spacing: { after: 150 },
                })
              )
            ]).flat(),

            // Writing Step 4: Sentence Translation
            new Paragraph({
              text: 'STEP 4: SENTENCE TRANSLATION (VIETNAMESE - ENGLISH)',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            ...lesson.writingSteps.step4.questions.map((q, i) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `${i + 1}. ${q.vietnamese}`, bold: true, size: 24 }),
                ],
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                text: '__________________________________________________________________',
                indent: { left: 360 },
                spacing: { after: 200 },
              })
            ]).flat(),

            // Writing Step 5: Paragraph Writing
            new Paragraph({
              text: 'STEP 5: IELTS PARAGRAPH WRITING',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            ...lesson.writingSteps.step5.paragraphs.map((p, pIdx) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `Topic: ${p.topic}`, bold: true, size: 24 }),
                ],
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Write a complete paragraph merging these 3 points:", italics: true, size: 20 }),
                ],
              }),
              new Paragraph({ children: [new TextRun({ text: `• Topic Sentence: ${p.vietnamese.topicSentence}`, size: 20 })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `• Supporting Sentence: ${p.vietnamese.supportingSentence}`, size: 20 })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `• Example: ${p.vietnamese.example}`, size: 20 })], indent: { left: 360 } }),
              new Paragraph({
                text: '\n\n\n\n\n\n\n\n', // Blank space for writing
                spacing: { before: 400, after: 400 },
              })
            ]).flat(),
          ] : []),

          // Step 4: Phrase Dictation (Listening/Reading legacy)
          ...(lesson.type !== 'writing' && lesson.steps?.step2?.phrases ? [
            new Paragraph({
              text: 'PHRASE DICTATION',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            ...lesson.steps.step2.phrases.map((phrase, i) => 
              new Paragraph({
                children: [
                  new TextRun({ text: `${i + 1}. `, bold: true, size: 24 }),
                  new TextRun({ text: "__________________________________________________________________", size: 24 }),
                ],
                spacing: { before: 200, after: 100 },
                indent: { left: 360 },
              })
            )
          ] : []),

          // Step 5: Gap-fill Exercise
          ...(lesson.steps?.step3?.gapFillText ? [
            new Paragraph({
              text: 'GAP-FILL EXERCISE',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: lesson.steps.step3.gapFillText.replace(/\[(\d+|BLANK)\]/gi, ' __________________________ '),
                  size: 24,
                }),
              ],
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 400, line: 360 },
            })
          ] : []),

          // Questions
          new Paragraph({
            text: 'PRACTICE QUESTIONS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 600, after: 200 },
          }),
          ...(lesson.readingQuestions || lesson.steps?.step4?.questions || []).map((q, i) => {
            const questionParagraphs = [
              new Paragraph({
                children: [
                  new TextRun({ text: `${i + 1}. `, bold: true, size: 24 }),
                  new TextRun({ text: q.question || '', size: 24 }),
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
                      new TextRun({ text: opt || '', size: 22 }),
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
          // Script/Passage in Answer Key
          new Paragraph({
            text: (lesson.type === 'reading' || lesson.passage) ? 'READING PASSAGE' : 'LISTENING SCRIPT',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: lesson.passage || lesson.script || (lesson.type === 'writing' ? 'WRITING GUIDELINES' : ''),
                size: 22,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 400, line: 300 },
          }),

          // Writing Answers (if writing lesson)
          ...(lesson.type === 'writing' && lesson.writingSteps ? [
             // Step 2 Answers
             new Paragraph({
               text: 'STEP 2: MCQs ANSWERS',
               heading: HeadingLevel.HEADING_2,
               spacing: { before: 400, after: 200 },
             }),
             ...lesson.writingSteps.step2.questions.map((q, i) => [
               new Paragraph({
                 children: [
                   new TextRun({ text: `Question ${i + 1}: `, bold: true, size: 22 }),
                   new TextRun({ text: `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`, color: '2E7D32', bold: true, size: 22 }),
                 ],
                 indent: { left: 360 },
                 spacing: { after: 100 },
               }),
               new Paragraph({
                children: [
                  new TextRun({ text: 'Explanation: ', italics: true, bold: true, size: 18, color: '666666' }),
                  new TextRun({ text: q.explanation, italics: true, size: 18, color: '666666' }),
                ],
                indent: { left: 360 },
                spacing: { after: 200 },
              })
             ]).flat(),

             // Step 3 Answers
             new Paragraph({
               text: 'STEP 3: ERROR IDENTIFICATION ANSWERS',
               heading: HeadingLevel.HEADING_2,
               spacing: { before: 400, after: 200 },
             }),
             ...lesson.writingSteps.step3.paragraphs.map((p, pIdx) => 
               p.errors.map((err, eIdx) => 
                 new Paragraph({
                   children: [
                     new TextRun({ text: `P${pIdx + 1} - Error "${err.original}": `, bold: true, size: 22 }),
                     new TextRun({ text: err.correction, color: '2E7D32', bold: true, size: 22 }),
                     new TextRun({ text: ` (${err.explanation})`, italics: true, size: 18, color: '666666' }),
                   ],
                   indent: { left: 360 },
                   spacing: { after: 100 },
                 })
               )
             ).flat(),

             // Step 4 Answers
             new Paragraph({
               text: 'STEP 4: SENTENCE TRANSLATION ANSWERS',
               heading: HeadingLevel.HEADING_2,
               spacing: { before: 400, after: 200 },
             }),
             ...lesson.writingSteps.step4.questions.map((q, i) => [
               new Paragraph({
                 children: [
                   new TextRun({ text: `${i + 1}. `, bold: true, size: 22 }),
                   new TextRun({ text: q.english, color: '2E7D32', bold: true, size: 22 }),
                 ],
                 indent: { left: 360 },
                 spacing: { after: 100 },
               }),
               new Paragraph({
                 children: [
                   new TextRun({ text: `Explanation: ${q.explanation}`, italics: true, size: 18, color: '666666' }),
                 ],
                 indent: { left: 360 },
                 spacing: { after: 200 },
               })
             ]).flat(),

             // Step 5 Answers
             new Paragraph({
               text: 'STEP 5: IELTS PARAGRAPH MODEL ANSWERS',
               heading: HeadingLevel.HEADING_2,
               spacing: { before: 400, after: 200 },
             }),
             ...lesson.writingSteps.step5.paragraphs.map((p, i) => [
               new Paragraph({
                 children: [
                   new TextRun({ text: `Topic ${i + 1}: ${p.topic}`, bold: true, size: 22 }),
                 ],
                 spacing: { after: 100 },
               }),
               new Paragraph({
                 children: [
                    new TextRun({ text: `${p.english.topicSentence} ${p.english.supportingSentence} ${p.english.example}`, color: '2E7D32', bold: true, size: 22 }),
                 ],
                 alignment: AlignmentType.JUSTIFIED,
                 spacing: { after: 100 },
               }),
               new Paragraph({
                children: [
                  new TextRun({ text: `Explanation: ${p.explanation}`, italics: true, size: 18, color: '666666' }),
                ],
                spacing: { after: 300 },
              })
             ]).flat(),
          ] : []),
          // Step 4: Phrase Dictation Answers
          ...(lesson.steps?.step2?.phrases ? [
            new Paragraph({
              text: 'PHRASE DICTATION ANSWERS',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),
            ...lesson.steps.step2.phrases.map((phrase, i) => 
              new Paragraph({
                children: [
                  new TextRun({ text: `${i + 1}. `, bold: true, size: 22 }),
                  new TextRun({ text: phrase, size: 22, color: '2E7D32', bold: true }),
                ],
                indent: { left: 360 },
                spacing: { after: 100 },
              })
            )
          ] : []),

          // Step 5: Gap-fill Answers
          ...(lesson.steps?.step3?.blanks ? [
            new Paragraph({
              text: 'GAP-FILL ANSWERS',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: lesson.steps.step3.blanks.map((b, i) => `(${i+1}) ${b}`).join('   '), size: 22, color: '2E7D32', bold: true }),
              ],
              indent: { left: 360 },
              spacing: { after: 400 },
            })
          ] : []),

          new Paragraph({
            text: 'PRACTICE QUESTIONS ANSWERS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...(lesson.readingQuestions || lesson.steps?.step4?.questions || []).map((q, i) => {
            let answerText = String(q.answer ?? '');
            if (q.options && q.options.length > 0) {
              const idx = typeof q.answer === 'number' ? q.answer : parseInt(String(q.answer));
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
                  new TextRun({ text: q.explanation || '', italics: true, size: 20, color: '666666' }),
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
