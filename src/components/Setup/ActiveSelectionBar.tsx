import type { ProgramCode } from '../../types/schedule';
import { formatSemesterLabel, programShortLabel } from '../../lib/programDisplay';
import './ActiveSelectionBar.css';

interface Props {
  program: ProgramCode;
  programName?: string;
  semester: string;
  onChangeSelection: () => void;
}

export function ActiveSelectionBar({
  program,
  programName,
  semester,
  onChangeSelection,
}: Props) {
  return (
    <div className="active-selection">
      <div className="active-selection__text">
        <p className="active-selection__program">
          {programShortLabel(program, programName)}
        </p>
        <p className="active-selection__semester">
          {formatSemesterLabel(semester)}
        </p>
      </div>
      <button
        type="button"
        className="active-selection__change"
        onClick={onChangeSelection}
      >
        Mainīt izvēli
      </button>
    </div>
  );
}
