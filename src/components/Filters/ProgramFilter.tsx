import type { ProgramFilter as ProgramFilterValue } from '../../hooks/useFilters';
import './Filters.css';

interface Props {
  program: ProgramFilterValue;
  onChange: (value: ProgramFilterValue) => void;
}

export function ProgramFilter({ program, onChange }: Props) {
  return (
    <div className="filter-group">
      <p className="filter-label">Programma</p>
      <div className="filter-row" role="group" aria-label="Studiju programma">
        <button
          type="button"
          className={program === 'all' ? 'filter-chip is-active' : 'filter-chip'}
          onClick={() => onChange('all')}
        >
          Visas
        </button>
        <button
          type="button"
          className={
            program === 'G0108'
              ? 'filter-chip is-active program-g0108'
              : 'filter-chip program-g0108'
          }
          onClick={() => onChange('G0108')}
        >
          <span className="filter-abbr" aria-hidden>
            Eko
          </span>
          Ekonomika
        </button>
        <button
          type="button"
          className={
            program === 'G0405'
              ? 'filter-chip is-active program-g0405'
              : 'filter-chip program-g0405'
          }
          onClick={() => onChange('G0405')}
        >
          <span className="filter-abbr" aria-hidden>
            LInž
          </span>
          Lauksaimn. inž.
        </button>
      </div>
    </div>
  );
}
