import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../config/api';
import { Button } from '../ui/Button';
import styles from './BlockCallerForm.module.css';

// Same values as the backend (validateCallBlock / caller_blocks).
const REASONS = [
  { value: 'prank', label: 'Prank call' },
  { value: 'abusive', label: 'Abusive or threatening' },
  { value: 'repeated_misuse', label: 'Repeated misuse' },
  { value: 'other', label: 'Other' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

const MAX_NOTE_LENGTH = 500;

/**
 * Offered after a call this staff member answered. Staff never see who
 * called: the block names the call, and the backend finds the caller from it
 * (POST /calls/:id/block). Closed by default — most calls are genuine.
 */
export function BlockCallerForm({ callId }: { callId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (result) {
    return (
      <p className={styles.result} role="status">
        {result}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className={styles.open} onClick={() => setOpen(true)}>
        Block this caller
      </Button>
    );
  }

  const noteRequired = reason === 'other';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    if (noteRequired && !note.trim()) {
      setError('Describe what happened.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/calls/${callId}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason, note: note.trim() || null }),
      });
      setResult('Caller blocked. They can no longer call Haven responders until an administrator lifts it.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'caller_already_blocked') {
        setResult('This caller is already blocked.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Why are you blocking this caller?</legend>
        {REASONS.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name={`block-reason-${callId}`}
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <label className={styles.noteLabel} htmlFor={`block-note-${callId}`}>
        {noteRequired ? 'What happened?' : 'Anything else? (optional)'}
      </label>
      <textarea
        id={`block-note-${callId}`}
        className={styles.note}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        required={noteRequired}
      />
      <p className={styles.hint}>
        The caller is blocked from calling any Haven responder. An administrator reviews every block. Don’t include
        personal details.
      </p>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="dark" size="sm" disabled={submitting}>
          {submitting ? 'Blocking…' : 'Block caller'}
        </Button>
      </div>
    </form>
  );
}
