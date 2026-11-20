export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK';
export type QuizMode = 'BATCH' | 'STANDARD' | 'SURVIVAL' | 'TIME_RUSH';
export interface Option { id: string; text: string }
export interface Question {
 id: string; type: QuestionType; text: string; options?: Option[]; correctOptionId?: string;
 correctBoolean?: boolean; acceptedAnswers?: string[]; explanation: string; hint?: string;
 keyPoint?: string; difficulty: 'Easy'|'Medium'|'Hard'; conceptName?: string;
 conceptPriority?: 'HIGH'|'MODERATE'|'FILLER';
}
export interface Artifact { id: string; kind: 'insight'|'material'|'visualization'|'comic'|'concept_map'|'simulation'; title: string; content: string; explanation?: string; interactionGuide?: string }
export interface Pack { id: string; ownerId: string; title: string; description: string; folder: string; tags: string[]; questions: Question[]; artifacts: Artifact[]; revision: number; createdAt: string; updatedAt: string; deletedAt?: string }
export interface StudyOptions { mode: QuizMode; batchSize?: number; shuffle: boolean; retention: boolean; mixed: boolean }
export interface Occurrence { id: string; sourcePackId: string; sourceQuestionId: string; question: Question }
export interface Answer { occurrenceId: string; value: string|boolean; isCorrect: boolean; answeredAt: string }
export interface Attempt { diagnostic?:{attemptId:string;occurrenceId:string}; id: string; ownerId: string; packId: string; packRevision: number; title: string; options: StudyOptions; items: Occurrence[]; draft?: import('./batch').BatchDraft; answers: Answer[]; currentIndex: number; lives: number; streak: number; deadline: number|null; status: 'active'|'completed'; createdAt: string; updatedAt: string; completedAt?: string; revision: number }
export interface ReviewEvent { id: string; cardId: string; packId: string; questionId: string; question: Question; rating: 0|1|2|3; reviewedAt: string }
export interface ReviewCard { id: string; packId: string; questionId: string; question: Question; easiness: number; interval: number; repetition: number; nextReview: string; updatedAt: string }
export interface User { id: string; name: string; email?: string }
export interface Publication { id: string; title: string; description: string; questionCount: number; publishedAt: string; pack?: Pick<Pack,'title'|'description'|'tags'|'questions'|'artifacts'> }
export interface Snapshot { preferences?: import('./preferences').WorkspacePreferences; packs: Pack[]; attempts: Attempt[]; reviews: ReviewEvent[]; cursor: number }
export interface Operation { id: string; kind: 'pack.put'|'pack.delete'|'attempt.put'|'review.add'; entityId: string; expectedRevision?: number; payload: unknown; createdAt: string }
export interface MutationResult { operationId: string; ok: boolean; record?: Pack|Attempt|ReviewEvent; error?: string; code?: 'CONFLICT'|'INVALID'|'NOT_FOUND'|'UNAUTHORIZED'; current?: Pack|Attempt }
export interface Progress { total: number; correct: number; score: number; topics: {name:string;correct:number;total:number}[] }
