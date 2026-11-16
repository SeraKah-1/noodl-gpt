import type { Artifact, Attempt, Pack, Question, ReviewEvent, StudyOptions } from './types';

export class DomainError extends Error {
  constructor(message: string, public code: 'INVALID' | 'CONFLICT' = 'INVALID') { super(message); this.name = 'DomainError'; }
}
export type PackInput = Pick<Pack, 'title'|'description'|'folder'|'tags'|'questions'|'artifacts'>;
const record = (v: unknown, label: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new DomainError(`${label} must be an object`);
  return v as Record<string, unknown>;
};
const string = (v: unknown, label: string, max = 20000, optional = false): string => {
  if (optional && v === undefined) return '';
  if (typeof v !== 'string' || (!optional && !v.trim()) || v.length > max) throw new DomainError(`${label} must be ${optional ? 'a' : 'a nonempty'} string (max ${max})`);
  return v;
};
const id = (v: unknown, label: string) => string(v, label, 200);
const unique = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) throw new DomainError(`${label} must be unique`); };
const iso = (v: unknown, label: string) => { const s = string(v, label, 60); if (!Number.isFinite(Date.parse(s))) throw new DomainError(`${label} must be an ISO date`); return new Date(s).toISOString(); };
const integer = (v: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw new DomainError(`${label} must be an integer between ${min} and ${max}`); return v; };

export function validateQuestion(input: unknown): Question {
  const q = record(input, 'question');
  if (!['MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK'].includes(String(q.type))) throw new DomainError('Unknown question type');
  if (!['Easy','Medium','Hard'].includes(String(q.difficulty))) throw new DomainError('Invalid difficulty');
  const result: Question = { id: id(q.id, 'question.id'), type: q.type as Question['type'], text: string(q.text, 'question.text'), explanation: string(q.explanation, 'question.explanation'), difficulty: q.difficulty as Question['difficulty'] };
  for (const key of ['hint','keyPoint','conceptName'] as const) if (q[key] !== undefined) result[key] = string(q[key], key, 20000, true);
  if (q.conceptPriority !== undefined) {
    if (!['HIGH','MODERATE','FILLER'].includes(String(q.conceptPriority))) throw new DomainError('Invalid conceptPriority');
    result.conceptPriority = q.conceptPriority as Question['conceptPriority'];
  }
  if (result.type === 'MULTIPLE_CHOICE') {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 12) throw new DomainError('Multiple choice requires 2–12 options');
    result.options = q.options.map((v) => { const o=record(v,'option'); return {id:id(o.id,'option.id'),text:string(o.text,'option.text')}; });
    unique(result.options.map(o=>o.id),'Option IDs');
    result.correctOptionId = id(q.correctOptionId, 'correctOptionId');
    if (!result.options.some(o=>o.id===result.correctOptionId)) throw new DomainError('Correct option does not exist');
  } else if (result.type === 'TRUE_FALSE') {
    if (typeof q.correctBoolean !== 'boolean') throw new DomainError('True/false requires correctBoolean');
    result.correctBoolean=q.correctBoolean;
  } else {
    if (!Array.isArray(q.acceptedAnswers) || q.acceptedAnswers.length === 0 || q.acceptedAnswers.length > 30) throw new DomainError('Fill blank requires 1–30 accepted answers');
    result.acceptedAnswers=q.acceptedAnswers.map(v=>string(v,'acceptedAnswer',2000));
  }
  return result;
}

export function validateArtifact(input: unknown): Artifact {
  const a = record(input,'artifact');
  if (!['insight','material','visualization'].includes(String(a.kind))) throw new DomainError('Invalid artifact kind');
  const result: Artifact = {id:id(a.id,'artifact.id'),kind:a.kind as Artifact['kind'],title:string(a.title,'artifact.title',300),content:string(a.content,'artifact.content',500000)};
  if (a.explanation!==undefined) result.explanation=string(a.explanation,'artifact.explanation',20000,true);
  if (a.interactionGuide!==undefined) result.interactionGuide=string(a.interactionGuide,'interactionGuide',20000,true);
  return result;
}
export function validatePackInput(input: unknown): PackInput {
  const p=record(input,'pack');
  if (!Array.isArray(p.questions) || p.questions.length<1 || p.questions.length>1000) throw new DomainError('Pack requires 1–1000 questions');
  const questions=p.questions.map(validateQuestion); unique(questions.map(q=>q.id),'Question IDs');
  const artifacts=p.artifacts===undefined?[]:(Array.isArray(p.artifacts)?p.artifacts.map(validateArtifact):(()=>{throw new DomainError('artifacts must be an array')})());
  if (artifacts.length>100) throw new DomainError('Too many artifacts'); unique(artifacts.map(a=>a.id),'Artifact IDs');
  const tags=p.tags===undefined?[]:(Array.isArray(p.tags)?p.tags.map(v=>string(v,'tag',100)):(()=>{throw new DomainError('tags must be an array')})());
  if (tags.length>50) throw new DomainError('Too many tags');
  return {title:string(p.title,'title',300),description:string(p.description,'description',20000,true),folder:string(p.folder,'folder',300,true),tags,questions,artifacts};
}
export function validateStudyOptions(input: unknown): StudyOptions {
  const o=record(input,'options');
  if (!['STANDARD','SURVIVAL','TIME_RUSH'].includes(String(o.mode))) throw new DomainError('Invalid quiz mode');
  for (const k of ['shuffle','retention','mixed']) if (typeof o[k]!=='boolean') throw new DomainError(`${k} must be boolean`);
  return {mode:o.mode as StudyOptions['mode'],shuffle:o.shuffle as boolean,retention:o.retention as boolean,mixed:o.mixed as boolean};
}
export function validateAttempt(input: unknown): Attempt {
  const a=record(input,'attempt');
  if (!Array.isArray(a.items)||a.items.length<1||a.items.length>2000) throw new DomainError('Attempt requires 1–2000 occurrences');
  const items=a.items.map(v=>{const x=record(v,'occurrence');return {id:id(x.id,'occurrence.id'),sourcePackId:id(x.sourcePackId,'sourcePackId'),sourceQuestionId:id(x.sourceQuestionId,'sourceQuestionId'),question:validateQuestion(x.question)};});
  unique(items.map(i=>i.id),'Occurrence IDs');
  if (!Array.isArray(a.answers)||a.answers.length>items.length) throw new DomainError('Invalid answers');
  const answers=a.answers.map(v=>{const x=record(v,'answer'); if(typeof x.value!=='string'&&typeof x.value!=='boolean') throw new DomainError('Invalid answer value'); if(typeof x.isCorrect!=='boolean') throw new DomainError('Invalid answer score'); return {occurrenceId:id(x.occurrenceId,'answer.occurrenceId'),value:x.value as string|boolean,isCorrect:x.isCorrect,answeredAt:iso(x.answeredAt,'answeredAt')};});
  unique(answers.map(x=>x.occurrenceId),'Answer occurrence IDs');
  if(answers.some(x=>!items.some(i=>i.id===x.occurrenceId))) throw new DomainError('Answer references unknown occurrence');
  if(a.status!=='active'&&a.status!=='completed') throw new DomainError('Invalid attempt status');
  if(a.deadline!==null && (typeof a.deadline!=='number'||!Number.isFinite(a.deadline))) throw new DomainError('Invalid deadline');
  return {id:id(a.id,'attempt.id'),ownerId:id(a.ownerId,'ownerId'),packId:id(a.packId,'packId'),packRevision:integer(a.packRevision,'packRevision'),title:string(a.title,'title',300),options:validateStudyOptions(a.options),items,answers,currentIndex:integer(a.currentIndex,'currentIndex',0,items.length-1),lives:integer(a.lives,'lives',0,3),streak:integer(a.streak,'streak'),deadline:a.deadline as number|null,status:a.status,createdAt:iso(a.createdAt,'createdAt'),updatedAt:iso(a.updatedAt,'updatedAt'),...(a.completedAt===undefined?{}:{completedAt:iso(a.completedAt,'completedAt')}),revision:integer(a.revision,'revision')};
}
export function validateReviewEvent(input: unknown): ReviewEvent {
  const e=record(input,'review');
  return {id:id(e.id,'review.id'),cardId:id(e.cardId,'cardId'),packId:id(e.packId,'packId'),questionId:id(e.questionId,'questionId'),question:validateQuestion(e.question),rating:integer(e.rating,'rating',0,3) as ReviewEvent['rating'],reviewedAt:iso(e.reviewedAt,'reviewedAt')};
}
