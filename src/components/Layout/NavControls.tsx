import './NavControls.css';

interface Props {
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  label?: string;
}

export function NavControls({ onPrev, onToday, onNext, label }: Props) {
  return (
    <div className="nav-controls">
      <button type="button" className="nav-btn" onClick={onPrev} aria-label="Iepriekšējais">
        ‹
      </button>
      <button type="button" className="nav-btn nav-btn--today" onClick={onToday}>
        {label ?? 'Šodien'}
      </button>
      <button type="button" className="nav-btn" onClick={onNext} aria-label="Nākamais">
        ›
      </button>
    </div>
  );
}
