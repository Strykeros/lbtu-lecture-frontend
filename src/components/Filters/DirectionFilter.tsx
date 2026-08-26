import type { StudyDirection } from '../../types/schedule';
import './Filters.css';

interface Props {
  value: string;
  options: StudyDirection[];
  onChange: (value: string) => void;
}

export function DirectionFilter({ value, options, onChange }: Props) {
  if (options.length === 0) return null;

  return (
    <div className="filter-group">
      <p className="filter-label">Novirziens</p>
      <div className="filter-row" role="group" aria-label="Novirziens">
        <button
          type="button"
          className={value === 'all' ? 'filter-chip is-active' : 'filter-chip'}
          onClick={() => onChange('all')}
        >
          Visi novirzieni
        </button>
        {options.map((dir) => (
          <button
            key={`${dir.programCode}:${dir.semester}:${dir.code}`}
            type="button"
            className={value === dir.code ? 'filter-chip is-active' : 'filter-chip'}
            onClick={() => onChange(dir.code)}
            title={`${dir.code} - ${dir.name}`}
          >
            {dir.code} - {dir.name}
          </button>
        ))}
      </div>
    </div>
  );
}
