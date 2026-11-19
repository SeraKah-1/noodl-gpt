import {useEffect, useRef, useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import type {Pack, Question, QuestionType} from '../shared/types';
import {validatePackInput, validateQuestion, type PackInput} from '../shared/validation';
import type {Locale} from './classic/Navigation';
import './BankEditor.css';

function blankQuestion(): Question {
  const options = [0, 1].map(() => ({id: crypto.randomUUID(), text: ''}));
  return {
    id: crypto.randomUUID(), type: 'MULTIPLE_CHOICE', text: '', explanation: '',
    difficulty: 'Medium', options, correctOptionId: options[0].id
  };
}

interface Props {
  pack?: Pack;
  locale: Locale;
  onClose: () => void;
  onSave: (content: PackInput) => Promise<void>;
}

export function BankEditor({pack, locale, onClose, onSave}: Props) {
  const id = locale === 'id';
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<PackInput>(() => pack ?? {
    title: '', description: '', folder: '', tags: [], questions: [blankQuestion()], artifacts: []
  });
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const question = draft.questions[index];
  const options = question.options ?? [];
  const label = id ? (pack ? 'Edit bank soal' : 'Buat bank soal') : (pack ? 'Edit bank' : 'Create question bank');
  useEffect(() => { dialog.current?.showModal(); }, []);

  function updateQuestion(patch: Partial<Question>) {
    setDraft(current => ({
      ...current, questions: current.questions.map((q, i) => i === index ? {...q, ...patch} : q)
    }));
  }

  function changeType(type: QuestionType) {
    if (type === 'MULTIPLE_CHOICE' && !options.length) {
      const blank = blankQuestion();
      updateQuestion({type, options: blank.options, correctOptionId: blank.correctOptionId});
    } else {
      updateQuestion({type, correctBoolean: question.correctBoolean ?? true, acceptedAnswers: question.acceptedAnswers ?? []});
    }
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      for (const [number, question] of draft.questions.entries()) {
        try { validateQuestion(question); }
        catch (error) {
          setIndex(number);
          throw new Error(`${id ? 'Soal' : 'Question'} ${number + 1} — ${(error as Error).message}`);
        }
      }
      await onSave(validatePackInput(draft));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialog} className="n-modal bank-editor" aria-labelledby="bank-editor-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <h2 id="bank-editor-title">{label}</h2>
      <label>{id ? 'Judul bank' : 'Bank title'}
        <input required maxLength={300} value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})}/>
      </label>
      <label>{id ? 'Deskripsi' : 'Description'}
        <textarea rows={2} maxLength={20000} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})}/>
      </label>
      <div className="bank-editor-controls">
        <label>{id ? 'Soal yang diedit' : 'Question to edit'}
          <select value={index} onChange={e => { setError(''); setIndex(Number(e.target.value)); }}>
            {draft.questions.map((q, i) => <option key={q.id} value={i}>{i + 1}. {q.text.slice(0, 55) || (id ? 'Soal baru' : 'New question')}</option>)}
          </select>
        </label>
        <button type="button" className="n-button" disabled={draft.questions.length >= 1000} onClick={() => {
          setIndex(draft.questions.length);
          setDraft({...draft, questions: [...draft.questions, blankQuestion()]});
        }}><Plus size={16}/>{id ? 'Tambah soal' : 'Add question'}</button>
        <button type="button" className="n-button" disabled={draft.questions.length === 1} onClick={() => {
          setIndex(Math.min(index, draft.questions.length - 2));
          setDraft({...draft, questions: draft.questions.filter((_, i) => i !== index)});
        }}><Trash2 size={16}/>{id ? 'Hapus soal ini' : 'Remove this question'}</button>
      </div>
      <div className="bank-editor-fields">
        <label>{id ? 'Tipe soal' : 'Question type'}
          <select value={question.type} onChange={e => changeType(e.target.value as QuestionType)}>
            <option value="MULTIPLE_CHOICE">{id ? 'Pilihan ganda' : 'Multiple choice'}</option>
            <option value="TRUE_FALSE">{id ? 'Benar atau salah' : 'True or false'}</option>
            <option value="FILL_BLANK">{id ? 'Isian' : 'Fill in the blank'}</option>
          </select>
        </label>
        <label>{id ? 'Kesulitan' : 'Difficulty'}
          <select value={question.difficulty} onChange={e => updateQuestion({difficulty: e.target.value as Question['difficulty']})}>
            <option value="Easy">{id ? 'Mudah' : 'Easy'}</option>
            <option value="Medium">{id ? 'Sedang' : 'Medium'}</option>
            <option value="Hard">{id ? 'Sulit' : 'Hard'}</option>
          </select>
        </label>
      </div>
      <label>{id ? 'Pertanyaan' : 'Question'}
        <textarea rows={3} maxLength={20000} value={question.text} onChange={e => updateQuestion({text: e.target.value})}/>
      </label>
      {question.type === 'MULTIPLE_CHOICE' && <>
        {options.map((option, i) => <div className="bank-editor-option" key={option.id}>
          <label>{id ? 'Opsi' : 'Option'} {i + 1}
            <input value={option.text} maxLength={20000} onChange={e => updateQuestion({
              options: options.map(o => o.id === option.id ? {...o, text: e.target.value} : o)
            })}/>
          </label>
          <button className="n-button" type="button" disabled={options.length <= 2}
            aria-label={(id ? 'Hapus opsi ' : 'Remove option ') + (i + 1)} onClick={() => {
              const remaining = options.filter(o => o.id !== option.id);
              updateQuestion({options: remaining, correctOptionId: question.correctOptionId === option.id ? remaining[0].id : question.correctOptionId});
            }}><Trash2 size={16}/></button>
        </div>)}
        <button type="button" className="n-button" disabled={options.length >= 12} onClick={() => updateQuestion({
          options: [...options, {id: crypto.randomUUID(), text: ''}]
        })}><Plus size={16}/>{id ? 'Tambah opsi' : 'Add option'}</button>
        <label>{id ? 'Jawaban benar' : 'Correct answer'}
          <select value={question.correctOptionId} onChange={e => updateQuestion({correctOptionId: e.target.value})}>
            {options.map((option, i) => <option value={option.id} key={option.id}>{i + 1}. {option.text.slice(0, 80)}</option>)}
          </select>
        </label>
      </>}
      {question.type === 'TRUE_FALSE' && <label>{id ? 'Jawaban benar' : 'Correct answer'}
        <select value={String(question.correctBoolean)} onChange={e => updateQuestion({correctBoolean: e.target.value === 'true'})}>
          <option value="true">{id ? 'Benar' : 'True'}</option>
          <option value="false">{id ? 'Salah' : 'False'}</option>
        </select>
      </label>}
      {question.type === 'FILL_BLANK' && <label>{id ? 'Jawaban diterima, satu per baris' : 'Accepted answers, one per line'}
        <textarea rows={3} value={(question.acceptedAnswers ?? []).join('\n')}
          onChange={e => updateQuestion({acceptedAnswers: e.target.value.split('\n')})}/>
      </label>}
      <label>{id ? 'Pembahasan' : 'Explanation'}
        <textarea rows={3} maxLength={20000} value={question.explanation} onChange={e => updateQuestion({explanation: e.target.value})}/>
      </label>
      {error && <p className="n-error" role="alert">{error}</p>}
      <div className="n-row">
        <button type="button" className="n-button" disabled={saving} onClick={onClose}>{id ? 'Batal' : 'Cancel'}</button>
        <button className="n-button primary" disabled={saving}>{saving ? (id ? 'Menyimpan…' : 'Saving…') : (id ? 'Simpan bank' : 'Save bank')}</button>
      </div>
    </form>
  </dialog>;
}
