import type { CalendarView } from '../../hooks/useCalendarNavigation';
import type { ThemePreference } from '../../hooks/useFilters';
import './Header.css';

interface Props {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  updatedAt: string | null;
  stale: boolean;
  onRefresh?: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  showViews?: boolean;
  showRefresh?: boolean;
}

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'today', label: 'Šodien' },
  { id: 'week', label: 'Nedēļa' },
  { id: 'agenda', label: 'Saraksts' },
  { id: 'month', label: 'Mēnesis' },
];

export function Header({
  view,
  onViewChange,
  updatedAt,
  stale,
  onRefresh,
  theme,
  onThemeChange,
  showViews = true,
  showRefresh = true,
}: Props) {
  return (
    <header className="app-header">
      <div className="app-header__top">
        <div>
          <p className="app-brand">LBTU Lekcijas</p>
          <p className="app-subtitle">Maģistra programmu grafiks</p>
        </div>
        <div className="app-header__actions">
          <label className="theme-select">
            <span className="sr-only">Motīvs</span>
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value as ThemePreference)}
              aria-label="Krāsu motīvs"
            >
              <option value="system">Sistēma</option>
              <option value="light">Gaišs</option>
              <option value="dark">Tumšs</option>
            </select>
          </label>
          {showRefresh && onRefresh && (
            <button
              type="button"
              className="refresh-btn"
              onClick={onRefresh}
              aria-label="Atjaunināt lekciju sarakstu"
            >
              <span className="refresh-btn__icon" aria-hidden>
                ↻
              </span>
              <span className="refresh-btn__label">Atjaunināt lekcijas</span>
            </button>
          )}
        </div>
      </div>

      {showViews && (
        <nav className="view-tabs" aria-label="Skati">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={view === v.id ? 'view-tab is-active' : 'view-tab'}
              onClick={() => onViewChange(v.id)}
              aria-current={view === v.id ? 'page' : undefined}
            >
              {v.label}
            </button>
          ))}
        </nav>
      )}

      {updatedAt && (
        <p className={`updated-line ${stale ? 'is-stale' : ''}`}>
          Atjaunināts: {updatedAt}
          {stale ? ' · rāda pēdējos veiksmīgos datus' : ''}
        </p>
      )}
    </header>
  );
}
