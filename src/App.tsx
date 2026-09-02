import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActiveSelectionBar } from './components/Setup/ActiveSelectionBar';
import { ProgramSetup } from './components/Setup/ProgramSetup';
import { Header } from './components/Layout/Header';
import { NavControls } from './components/Layout/NavControls';
import { DirectionFilter } from './components/Filters/DirectionFilter';
import { DayAgenda } from './components/Calendar/DayAgenda';
import { WeekCalendar } from './components/Calendar/WeekCalendar';
import { AgendaList } from './components/Calendar/AgendaList';
import { MonthView } from './components/Calendar/MonthView';
import { LectureDetailsSheet } from './components/LectureDetails/LectureDetailsSheet';
import { useCalendarNavigation } from './hooks/useCalendarNavigation';
import { useFilters } from './hooks/useFilters';
import { useSchedule } from './hooks/useSchedule';
import { useScheduleOptions } from './hooks/useScheduleOptions';
import { useStudySelection } from './hooks/useStudySelection';
import { addDaysIso, formatMonthYear, formatUpdatedAt } from './lib/dates';
import { visibleScheduleRange } from './lib/scheduleRange';
import { fetchSchedule, type ScheduleQuery } from './services/scheduleApi';
import type { LectureEvent, StudyDirection } from './types/schedule';
import './App.css';

export default function App() {
  const { direction, setDirection, theme, setTheme } = useFilters();
  const {
    selectedDate,
    setSelectedDate,
    view,
    setView,
    goToday,
    goPrev,
    goNext,
    weekStart,
  } = useCalendarNavigation();
  const [selectedEvent, setSelectedEvent] = useState<LectureEvent | null>(null);

  const {
    options,
    status: optionsStatus,
    error: optionsError,
    reload: reloadOptions,
  } = useScheduleOptions();

  const {
    showSetup,
    activeSelection,
    draftProgram,
    draftSemester,
    semesterOptions,
    rememberChoice,
    setRememberChoice,
    setDraftProgram,
    setDraftSemester,
    confirmLoading,
    confirmError,
    programError,
    semesterError,
    openSetup,
    confirmSelection,
    commitSelection,
    failConfirm,
    startConfirm,
  } = useStudySelection({ options });

  const range = useMemo(
    () => visibleScheduleRange(view, selectedDate),
    [view, selectedDate],
  );

  const scheduleQuery = useMemo((): ScheduleQuery | null => {
    if (!activeSelection || showSetup) return null;
    const q: ScheduleQuery = {
      from: range.from,
      to: range.to,
      program: activeSelection.program,
      semester: activeSelection.semester,
    };
    if (direction !== 'all') q.direction = direction;
    return q;
  }, [activeSelection, showSetup, range.from, range.to, direction]);

  const scheduleQueryKey = useMemo(
    () => (scheduleQuery ? JSON.stringify(scheduleQuery) : null),
    [scheduleQuery],
  );

  const stableQuery = useMemo(
    () => scheduleQuery,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleQueryKey],
  );

  const scheduleEnabled = Boolean(activeSelection && !showSetup);

  const { data, status, error, stale, refreshing, reload } = useSchedule(
    stableQuery,
    { view, enabled: scheduleEnabled },
  );

  const availableDirections = useMemo(() => {
    if (!data?.directions || !activeSelection) return [] as StudyDirection[];
    return data.directions
      .filter(
        (d) =>
          d.programCode === activeSelection.program &&
          d.semester === activeSelection.semester,
      )
      .sort((a, b) => a.code.localeCompare(b.code, 'lv'));
  }, [data?.directions, activeSelection]);

  useEffect(() => {
    if (direction === 'all') return;
    if (!availableDirections.some((d) => d.code === direction)) {
      setDirection('all');
    }
  }, [availableDirections, direction, setDirection]);

  const activeProgramName = useMemo(() => {
    if (!activeSelection || !options) return undefined;
    return options.programs.find((p) => p.code === activeSelection.program)?.name;
  }, [activeSelection, options]);

  const events = data?.events ?? [];

  const handleConfirmSetup = useCallback(async () => {
    const selection = confirmSelection();
    if (!selection) return;

    startConfirm();
    const initialRange = visibleScheduleRange('today', selectedDate);
    const query: ScheduleQuery = {
      from: initialRange.from,
      to: initialRange.to,
      program: selection.program,
      semester: selection.semester,
    };

    try {
      await fetchSchedule(query);
      setDirection('all');
      commitSelection(selection);
    } catch (err) {
      failConfirm(
        err instanceof Error ? err.message : 'Grafiku neizdevās ielādēt.',
      );
    }
  }, [
    commitSelection,
    confirmSelection,
    failConfirm,
    selectedDate,
    setDirection,
    startConfirm,
  ]);

  const handleChangeSelectionConfirm = useCallback(async () => {
    const selection = confirmSelection();
    if (!selection) return;

    const programChanged =
      activeSelection?.program !== selection.program ||
      activeSelection?.semester !== selection.semester;

    startConfirm();
    const initialRange = visibleScheduleRange(view, selectedDate);
    const query: ScheduleQuery = {
      from: initialRange.from,
      to: initialRange.to,
      program: selection.program,
      semester: selection.semester,
    };

    try {
      await fetchSchedule(query);
      if (programChanged) {
        setDirection('all');
      }
      commitSelection(selection);
    } catch (err) {
      failConfirm(
        err instanceof Error ? err.message : 'Grafiku neizdevās ielādēt.',
      );
    }
  }, [
    activeSelection,
    commitSelection,
    confirmSelection,
    failConfirm,
    selectedDate,
    setDirection,
    startConfirm,
    view,
  ]);

  const handleRefresh = useCallback(() => {
    reload(true);
  }, [reload]);

  if (showSetup) {
    return (
      <div className="app-shell">
        <Header
          view={view}
          onViewChange={setView}
          updatedAt={null}
          stale={false}
          theme={theme}
          onThemeChange={setTheme}
          showViews={false}
          showRefresh={false}
        />
        <main className="app-main">
          <ProgramSetup
            options={options}
            optionsLoading={optionsStatus === 'loading'}
            optionsError={optionsError}
            onRetryOptions={() => reloadOptions(true)}
            draftProgram={draftProgram}
            draftSemester={draftSemester}
            semesterOptions={semesterOptions}
            onProgramChange={setDraftProgram}
            onSemesterChange={setDraftSemester}
            rememberChoice={rememberChoice}
            onRememberChange={setRememberChoice}
            onConfirm={
              activeSelection ? handleChangeSelectionConfirm : handleConfirmSetup
            }
            confirmLoading={confirmLoading}
            confirmError={confirmError}
            programError={programError}
            semesterError={semesterError}
          />
        </main>
      </div>
    );
  }

  const bootLoading = status === 'loading' && !data;
  const bootError = status === 'error' && !data;

  if (bootLoading) {
    return (
      <div className="app-shell">
        <Header
          view={view}
          onViewChange={setView}
          updatedAt={null}
          stale={false}
          onRefresh={handleRefresh}
          theme={theme}
          onThemeChange={setTheme}
        />
        <main className="app-main">
          <div className="state-card">Ielādē grafiku…</div>
        </main>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="app-shell">
        <Header
          view={view}
          onViewChange={setView}
          updatedAt={null}
          stale={false}
          onRefresh={handleRefresh}
          theme={theme}
          onThemeChange={setTheme}
        />
        <main className="app-main">
          <div className="state-card state-card--error">
            <p>Neizdevās ielādēt lekcijas.</p>
            <p className="state-card__detail">{error}</p>
            <button type="button" className="retry-btn" onClick={handleRefresh}>
              Mēģināt vēlreiz
            </button>
            <button type="button" className="retry-btn retry-btn--ghost" onClick={openSetup}>
              Mainīt izvēli
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header
        view={view}
        onViewChange={setView}
        updatedAt={data?.updatedAt ? formatUpdatedAt(data.updatedAt) : null}
        stale={stale || Boolean(error)}
        onRefresh={handleRefresh}
        theme={theme}
        onThemeChange={setTheme}
      />

      <main className="app-main">
        {(stale || error) && data && (
          <div className="banner" role="status">
            Neizdevās atjaunot grafiku. Tiek rādīti pēdējie veiksmīgi ielādētie dati.
            <button type="button" onClick={handleRefresh}>
              Mēģināt vēlreiz
            </button>
          </div>
        )}

        {activeSelection && (
          <ActiveSelectionBar
            program={activeSelection.program}
            programName={activeProgramName}
            semester={activeSelection.semester}
            onChangeSelection={openSetup}
          />
        )}

        {availableDirections.length > 0 && (
          <div className="filters-block">
            <DirectionFilter
              value={direction}
              options={availableDirections}
              onChange={setDirection}
            />
          </div>
        )}

        <NavControls
          onPrev={goPrev}
          onToday={goToday}
          onNext={goNext}
          label={view === 'month' ? formatMonthYear(selectedDate) : 'Šodien'}
        />

        {view === 'today' && (
          <>
            <div className="mobile-pane">
              <DayAgenda
                selectedDate={selectedDate}
                weekStart={weekStart}
                events={events}
                onSelectDate={setSelectedDate}
                onSelectEvent={setSelectedEvent}
                showNextUp
                onSwipeDay={(dir) => setSelectedDate(addDaysIso(selectedDate, dir))}
              />
            </div>
            <div className="desktop-pane">
              <WeekCalendar
                weekStart={weekStart}
                events={events}
                onSelect={setSelectedEvent}
              />
              <div className="desktop-day">
                <DayAgenda
                  selectedDate={selectedDate}
                  weekStart={weekStart}
                  events={events}
                  onSelectDate={setSelectedDate}
                  onSelectEvent={setSelectedEvent}
                  showNextUp
                />
              </div>
            </div>
          </>
        )}

        {view === 'week' && (
          <>
            <div className="mobile-pane">
              <DayAgenda
                selectedDate={selectedDate}
                weekStart={weekStart}
                events={events}
                onSelectDate={setSelectedDate}
                onSelectEvent={setSelectedEvent}
                onSwipeDay={(dir) => setSelectedDate(addDaysIso(selectedDate, dir))}
              />
            </div>
            <div className="desktop-only">
              <WeekCalendar
                weekStart={weekStart}
                events={events}
                onSelect={setSelectedEvent}
              />
            </div>
          </>
        )}

        {view === 'agenda' && (
          <AgendaList
            fromDate={selectedDate}
            events={events}
            onSelect={setSelectedEvent}
          />
        )}

        {view === 'month' && (
          <MonthView
            selectedDate={selectedDate}
            events={events}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setView('today');
            }}
          />
        )}
      </main>

      <LectureDetailsSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      {refreshing && (
        <div className="loading-fab" role="status" aria-live="polite">
          <span className="loading-fab__spinner" aria-hidden />
          <span className="loading-fab__text">Atjaunina lekciju sarakstu…</span>
        </div>
      )}
    </div>
  );
}
