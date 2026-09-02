import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProgramCode } from '../types/schedule';
import type { ScheduleOptionsResponse } from '../types/schedule';

const PROGRAM_KEY = 'lbtu-program';
const SEMESTER_KEY = 'lbtu-semester';
const REMEMBER_KEY = 'lbtu-remember-choice';

function readRememberedProgram(): ProgramCode | '' {
  if (localStorage.getItem(REMEMBER_KEY) !== '1') return '';
  const v = localStorage.getItem(PROGRAM_KEY);
  if (v === 'G0108' || v === 'G0405') return v;
  return '';
}

function readRememberedSemester(): string {
  if (localStorage.getItem(REMEMBER_KEY) !== '1') return '';
  return localStorage.getItem(SEMESTER_KEY) ?? '';
}

export interface ActiveStudySelection {
  program: ProgramCode;
  semester: string;
}

interface UseStudySelectionArgs {
  options: ScheduleOptionsResponse | null;
}

export function useStudySelection({ options }: UseStudySelectionArgs) {
  const [showSetup, setShowSetup] = useState(true);
  const [activeSelection, setActiveSelection] =
    useState<ActiveStudySelection | null>(null);
  const [draftProgram, setDraftProgram] = useState<ProgramCode | ''>(() =>
    readRememberedProgram(),
  );
  const [draftSemester, setDraftSemester] = useState<string>(() =>
    readRememberedSemester(),
  );
  const [rememberChoice, setRememberChoice] = useState(
    () => localStorage.getItem(REMEMBER_KEY) === '1',
  );
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [semesterError, setSemesterError] = useState<string | null>(null);

  const semesterOptions = useMemo(() => {
    if (!options || !draftProgram) return [] as string[];
    const prog = options.programs.find((p) => p.code === draftProgram);
    return prog?.semesters ?? [];
  }, [options, draftProgram]);

  useEffect(() => {
    if (!options || options.programs.length === 0) return;

    if (
      draftSemester &&
      draftProgram &&
      !semesterOptions.includes(draftSemester)
    ) {
      setDraftSemester('');
    }
  }, [options, draftProgram, draftSemester, semesterOptions]);

  const setDraftProgramSafe = useCallback((next: ProgramCode | '') => {
    setDraftProgram(next);
    setProgramError(null);
    setConfirmError(null);
    setDraftSemester('');
  }, []);

  const setDraftSemesterSafe = useCallback((next: string) => {
    setDraftSemester(next);
    setSemesterError(null);
    setConfirmError(null);
  }, []);

  const persistDraftIfRemembered = useCallback(
    (program: ProgramCode, semester: string) => {
      if (rememberChoice) {
        localStorage.setItem(REMEMBER_KEY, '1');
        localStorage.setItem(PROGRAM_KEY, program);
        localStorage.setItem(SEMESTER_KEY, semester);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(PROGRAM_KEY);
        localStorage.removeItem(SEMESTER_KEY);
      }
    },
    [rememberChoice],
  );

  const openSetup = useCallback(() => {
    if (activeSelection) {
      setDraftProgram(activeSelection.program);
      setDraftSemester(activeSelection.semester);
    }
    setProgramError(null);
    setSemesterError(null);
    setConfirmError(null);
    setShowSetup(true);
  }, [activeSelection]);

  const confirmSelection = useCallback((): ActiveStudySelection | null => {
    let valid = true;
    if (!draftProgram) {
      setProgramError('Izvēlies studiju programmu.');
      valid = false;
    }
    if (!draftSemester) {
      setSemesterError('Izvēlies semestri.');
      valid = false;
    }
    if (!valid || !draftProgram) return null;

    const selection: ActiveStudySelection = {
      program: draftProgram,
      semester: draftSemester,
    };
    persistDraftIfRemembered(selection.program, selection.semester);
    return selection;
  }, [draftProgram, draftSemester, persistDraftIfRemembered]);

  const commitSelection = useCallback((selection: ActiveStudySelection) => {
    setActiveSelection(selection);
    setShowSetup(false);
    setConfirmError(null);
    setConfirmLoading(false);
  }, []);

  const failConfirm = useCallback((message: string) => {
    setConfirmError(message);
    setConfirmLoading(false);
  }, []);

  const startConfirm = useCallback(() => {
    setConfirmLoading(true);
    setConfirmError(null);
    setProgramError(null);
    setSemesterError(null);
  }, []);

  return {
    showSetup,
    activeSelection,
    draftProgram,
    draftSemester,
    semesterOptions,
    rememberChoice,
    setRememberChoice,
    setDraftProgram: setDraftProgramSafe,
    setDraftSemester: setDraftSemesterSafe,
    confirmLoading,
    confirmError,
    programError,
    semesterError,
    openSetup,
    confirmSelection,
    commitSelection,
    failConfirm,
    startConfirm,
  };
}
