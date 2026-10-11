import { computeWordCount, computeExcerpt, computeReadingTime, pickTitle } from './utils.js';

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}

export class LessonParseError extends Error {}

function extractTextContent(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagText(value, tagName) {
  const match = value.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  if (!match) return '';
  return extractTextContent(match[1]);
}

export function parseLessonHtml(rawHtml, fallbackTitle) {
  if (!rawHtml || !rawHtml.trim()) {
    throw new LessonParseError('That file is empty — there is nothing to import.');
  }

  let doc = null;
  if (typeof DOMParser !== 'undefined') {
    doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    if (!doc.body && !doc.head) {
      throw new LessonParseError("That file doesn't look like valid HTML.");
    }
  }

  const titleCandidates = doc
    ? [
        doc.querySelector('title')?.textContent,
        doc.querySelector('h1')?.textContent,
        doc.querySelector('h2')?.textContent,
      ]
    : [
        extractTagText(rawHtml, 'title'),
        extractTagText(rawHtml, 'h1'),
        extractTagText(rawHtml, 'h2'),
      ];
  const title = pickTitle(titleCandidates, fallbackTitle);

  const bodyText = doc ? (doc.body ? doc.body.textContent : '') : extractTextContent(rawHtml);
  const excerpt = computeExcerpt(bodyText);
  const wordCount = computeWordCount(bodyText);
  const readingTimeMin = computeReadingTime(wordCount);
  const hasCode = doc ? !!doc.querySelector('pre, code') : /<(pre|code)\b/i.test(rawHtml);
  const hasQuiz = /\bquiz\b/i.test(bodyText);

  // Preserve the uploaded lesson exactly as provided so custom layouts,
  // CSS, and animation logic render the same way as the original file.
  const html = rawHtml;

  return { title, excerpt, wordCount, readingTimeMin, hasCode, hasQuiz, html };
}
