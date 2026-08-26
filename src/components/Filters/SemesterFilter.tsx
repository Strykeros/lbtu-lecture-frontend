import './Filters.css';

interface Props {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export function SemesterFilter({ value, options, onChange }: Props) {
  if (options.length <= 1) return null;

  return (
    <div className="filter-group">
      <p className="filter-label">Semestris</p>
      <div className="filter-row" role="group" aria-label="Semestris">
        <button
          type="button"
          className={value === 'all' ? 'filter-chip is-active' : 'filter-chip'}
          onClick={() => onChange('all')}
        >
          Visi semestri
        </button>
        {options.map((sem) => (
          <button
            key={sem}
            type="button"
            className={value === sem ? 'filter-chip is-active' : 'filter-chip'}
            onClick={() => onChange(sem)}
          >
            {sem}. semestris
          </button>
        ))}
      </div>
    </div>
  );
}
