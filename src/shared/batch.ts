import type {Attempt, Occurrence, Question} from './types';

export type BatchDraft = Record<string, string | boolean>;
export const maxBatchSize = 100;
export function validBatchAnswer(question: Question, value: unknown) {
  if (question.type === 'TRUE_FALSE') return typeof value === 'boolean';
  if (typeof value !== 'string') return false;
  if (question.type === 'MULTIPLE_CHOICE') return question.options?.some(option => option.id === value);
  return value.trim().length > 0 && value.length <= 2000;
}
export function readBatchDraft(items: Occurrence[], input: unknown): BatchDraft {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid batch draft');
  const byId = new Map(items.map(item => [item.id, item.question]));
  const entries = Object.entries(input);
  for (const [id, value] of entries) {
    const question = byId.get(id);
    if (!question || !validBatchAnswer(question, value)) throw new Error('Invalid batch answer');
  }
  return Object.fromEntries(entries);
}
export function batchView(attempt: Attempt) {
  return {
    attemptId: attempt.id, title: attempt.title, revision: attempt.revision, status: attempt.status,
    questions: attempt.items.map(({id, question}, i) => ({
      number: i + 1, type: question.type, text: question.text,
      options: question.options?.map((option, j) => ({letter: String.fromCharCode(65+j), ...option})),
      draft: attempt.draft?.[id]
    }))
  };
}
