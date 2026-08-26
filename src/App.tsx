import { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Layout/Header';
import { NavControls } from './components/Layout/NavControls';
import { ProgramFilter } from './components/Filters/ProgramFilter';
import { SemesterFilter } from './components/Filters/SemesterFilter';
import { DirectionFilter } from './components/Filters/DirectionFilter';
import { DayAgenda } from './components/Calendar/DayAgenda';
import { WeekCalendar } from './components/Calendar/WeekCalendar';
import { AgendaList } from './components/Calendar/AgendaList';
import { MonthView } from './components/Calendar/MonthView';
import { LectureDetailsSheet } from './components/LectureDetails/LectureDetailsSheet';
import { useCalendarNavigation } from './hooks/useCalendarNavigation';
import { useFilters } from './hooks/useFilters';
import { useSchedule } from './hooks/useSchedule';
import { useScheduleMeta } from './hooks/useScheduleMeta';
import { addDaysIso, formatMonthYear, formatUpdatedAt } from './lib/dates';
import { visibleScheduleRange } from './lib/scheduleRange';
import type { ScheduleQuery } from './services/scheduleApi';
import type { LectureEvent, StudyDirection } from './types/schedule';
import './App.css';

export default function App() {
  const {
    program,
    setProgram,
    semester,
    setSemester,
    direction,
    setDirection,
    theme,
    setTheme,
  } = useFilters();
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
    meta,
    status: metaStatus,
    error: metaError,
    reload: reloadMeta,
  } = useScheduleMeta();

  const range = useMemo(
    () => visibleScheduleRange(view, selectedDate),
    [view, selectedDate],
  );

  const scheduleQuery = useMemo((): ScheduleQuery => {
    const q: ScheduleQuery = {
      from: range.from,
      to: range.to,
    };
    if (program !== 'all') q.program = program;
    if (semester !== 'all') q.semester = semester;
    if (direction !== 'all') q.direction = direction;
    return q;
  }, [range.from, range.to, program, semester, direction]);

  // Stabilize query object identity for the hook dependency when values unchanged
  const scheduleQueryKey = useMemo(
    () =>
      JSON.stringify({
        from: scheduleQuery.from,
        to: scheduleQuery.to,
        program: scheduleQuery.program ?? 'all',
        semester: scheduleQuery.semester ?? 'all',
        direction: scheduleQuery.direction ?? 'all',
      }),
    [scheduleQuery],
  );

  const stableQuery = useMemo(
    () => scheduleQuery,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleQueryKey],
  );

  const { data, status, error, stale, reload } = useSchedule(stableQuery, {
    view,
  });

  const availableDirections = useMemo(() => {
    if (program === 'all' || !meta) return [] as StudyDirection[];
    const prog = meta.programs.find((p) => p.code === program);
    if (!prog) return [];

    const dirs: StudyDirection[] = [];
    for (const sem of prog.semesters) {
      if (semester !== 'all' && sem.semester !== semester) continue;
      for (const d of sem.directions) {
        dirs.push({
          code: d.code,
          name: d.name,
          programCode: program,
          semester: sem.semester,
          sourceUrl: '',
        });
      }
    }

    const map = new Map<string, StudyDirection>();
    for (const d of dirs) {
      if (!map.has(d.code)) map.set(d.code, d);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, 'lv'));
  }, [meta, program, semester]);

  useEffect(() => {
    if (direction === 'all') return;
    if (program === 'all' || !availableDirections.some((d) => d.code === direction)) {
      setDirection('all');
    }
  }, [availableDirections, direction, program, setDirection]);

  const semesterOptions = useMemo(() => {
    if (!meta) return [] as string[];
    const set = new Set<string>();
    for (const prog of meta.programs) {
      if (program !== 'all' && prog.code !== program) continue;
      for (const sem of prog.semesters) {
        set.add(sem.semester);
      }
    }
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [meta, program]);

  const events = data?.events ?? [];

  const handleProgramChange = (next: typeof program) => {
    setProgram(next);
    if (next === 'all') {
      setDirection('all');
    }
  };

  const handleRefresh = () => {
    reloadMeta(true);
    reload(true);
  };

  const bootLoading =
    (metaStatus === 'loading' && !meta) || (status === 'loading' && !data);
  const bootError =
    (metaStatus === 'error' && !meta) || (status === 'error' && !data);

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
            <p>Grafiku neizdevās ielādēt.</p>
            <p className="state-card__detail">{error ?? metaError}</p>
            <button type="button" className="retry-btn" onClick={handleRefresh}>
              Mēģināt vēlreiz
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isRefreshing =
    status === 'loading' || metaStatus === 'loading';

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
            Neizdevās atjaunināt grafiku. Tiek rādīti pēdējie veiksmīgi ielādētie dati.
            <button type="button" onClick={handleRefresh}>
              Mēģināt vēlreiz
            </button>
          </div>
        )}

        <div className="filters-block">
          <ProgramFilter program={program} onChange={handleProgramChange} />
          <SemesterFilter
            value={semester}
            options={semesterOptions}
            onChange={setSemester}
          />
          <DirectionFilter
            value={direction}
            options={availableDirections}
            onChange={setDirection}
          />
        </div>

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

      {isRefreshing && (
        <div className="loading-fab" role="status" aria-live="polite">
          <span className="loading-fab__spinner" aria-hidden />
          <span className="loading-fab__text">Atjaunina lekciju sarakstu…</span>
        </div>
      )}
    </div>
  );
}
