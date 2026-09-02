import type { ProgramCode } from '../../types/schedule';
import type { ScheduleOptionsResponse } from '../../types/schedule';
import { formatSemesterLabel, programSelectLabel } from '../../lib/programDisplay';
import './ProgramSetup.css';

interface Props {
  options: ScheduleOptionsResponse | null;
  optionsLoading: boolean;
  optionsError: string | null;
  onRetryOptions: () => void;
  draftProgram: ProgramCode | '';
  draftSemester: string;
  semesterOptions: string[];
  onProgramChange: (value: ProgramCode | '') => void;
  onSemesterChange: (value: string) => void;
  rememberChoice: boolean;
  onRememberChange: (value: boolean) => void;
  onConfirm: () => void;
  confirmLoading: boolean;
  confirmError: string | null;
  programError: string | null;
  semesterError: string | null;
}

export function ProgramSetup({
  options,
  optionsLoading,
  optionsError,
  onRetryOptions,
  draftProgram,
  draftSemester,
  semesterOptions,
  onProgramChange,
  onSemesterChange,
  rememberChoice,
  onRememberChange,
  onConfirm,
  confirmLoading,
  confirmError,
  programError,
  semesterError,
}: Props) {
  if (optionsLoading && !options) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <p className="setup-card__status">Ielādē programmas…</p>
        </div>
      </div>
    );
  }

  if (optionsError && !options) {
    return (
      <div className="setup-screen">
        <div className="setup-card setup-card--error">
          <p>Neizdevās ielādēt studiju programmas.</p>
          <p className="setup-card__detail">{optionsError}</p>
          <button type="button" className="setup-btn setup-btn--secondary" onClick={onRetryOptions}>
            Mēģināt vēlreiz
          </button>
        </div>
      </div>
    );
  }

  const programs = options?.programs ?? [];

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1 className="setup-card__title">LBTU Lekcijas</h1>
        <p className="setup-card__lead">Izvēlies studiju programmu</p>

        <div className="setup-field">
          <label className="setup-field__label" htmlFor="setup-program">
            Studiju programma
          </label>
          <select
            id="setup-program"
            className={`setup-select${programError ? ' setup-select--error' : ''}`}
            value={draftProgram}
            onChange={(e) =>
              onProgramChange(e.target.value as ProgramCode | '')
            }
            aria-invalid={Boolean(programError)}
            aria-describedby={programError ? 'setup-program-error' : undefined}
          >
            <option value="">Izvēlies programmu</option>
            {programs.map((p) => (
              <option key={p.code} value={p.code}>
                {programSelectLabel(p.code, p.name)}
              </option>
            ))}
          </select>
          {programError && (
            <p id="setup-program-error" className="setup-field__error" role="alert">
              {programError}
            </p>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-field__label" htmlFor="setup-semester">
            Semestris
          </label>
          <select
            id="setup-semester"
            className={`setup-select${semesterError ? ' setup-select--error' : ''}`}
            value={draftSemester}
            onChange={(e) => onSemesterChange(e.target.value)}
            disabled={!draftProgram || semesterOptions.length === 0}
            aria-invalid={Boolean(semesterError)}
            aria-describedby={semesterError ? 'setup-semester-error' : undefined}
          >
            <option value="">
              {draftProgram ? 'Izvēlies semestri' : 'Vispirms izvēlies programmu'}
            </option>
            {semesterOptions.map((sem) => (
              <option key={sem} value={sem}>
                {formatSemesterLabel(sem)}
              </option>
            ))}
          </select>
          {semesterError && (
            <p id="setup-semester-error" className="setup-field__error" role="alert">
              {semesterError}
            </p>
          )}
        </div>

        <label className="setup-remember">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => onRememberChange(e.target.checked)}
          />
          <span>Atcerēties manu izvēli</span>
        </label>

        {confirmError && (
          <div className="setup-card__alert" role="alert">
            <p>Neizdevās ielādēt lekcijas.</p>
            <p className="setup-card__detail">{confirmError}</p>
          </div>
        )}

        <button
          type="button"
          className="setup-btn setup-btn--primary"
          onClick={onConfirm}
          disabled={confirmLoading}
        >
          {confirmLoading ? 'Ielādē lekcijas…' : 'Parādīt lekcijas'}
        </button>
      </div>
    </div>
  );
}
