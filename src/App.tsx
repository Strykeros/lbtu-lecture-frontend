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
import { addDaysIso, formatMonthYear, formatUpdatedAt } from './lib/dates';
import type { LectureEvent, StudyDirection } from './types/schedule';
import './App.css';

function contentKey(e: LectureEvent): string {
  return [
    e.programCode,
    e.semester,
    e.courseCode ?? e.courseName,
    e.date,
    e.startTime,
    e.endTime,
    e.lecturer ?? '',
    e.locationRaw ?? '',
  ].join('|');
}

export default function App() {
  const { data, status, error, stale, reload } = useSchedule();
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

  const availableDirections = useMemo(() => {
    // Prefer: hide novirzieni until a specific program is selected
    if (program === 'all') return [] as StudyDirection[];
    let dirs = (data?.directions ?? []).filter((d) => d.programCode === program);
    if (semester !== 'all') {
      dirs = dirs.filter((d) => d.semester === semester);
    }
    // Unique by code for the chip list (same code can appear in multiple semesters)
    const map = new Map<string, StudyDirection>();
    for (const d of dirs) {
      if (!map.has(d.code)) map.set(d.code, d);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, 'lv'));
  }, [data?.directions, program, semester]);

  // Reset direction only when it becomes invalid — never touch calendar date
  useEffect(() => {
    if (direction === 'all') return;
    if (program === 'all' || !availableDirections.some((d) => d.code === direction)) {
      setDirection('all');
    }
  }, [availableDirections, direction, program, setDirection]);

  const filteredEvents = useMemo(() => {
    let events = data?.events ?? [];
    if (program !== 'all') {
      events = events.filter((e) => e.programCode === program);
    }
    if (semester !== 'all') {
      events = events.filter((e) => e.semester === semester);
    }
    if (direction !== 'all') {
      // Strict: only this novirziens' schedule page
      events = events.filter((e) => e.directionCode === direction);
    } else {
      // Visi novirzieni: one card per real lecture (dedupe across sources)
      const map = new Map<string, LectureEvent>();
      for (const e of events) {
        const key = contentKey(e);
        if (!map.has(key)) map.set(key, e);
      }
      events = [...map.values()];
    }
    return events;
  }, [data?.events, program, semester, direction]);

  const semesterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.events ?? []) {
      if (program !== 'all' && e.programCode !== program) continue;
      set.add(e.semester);
    }
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [data?.events, program]);

  const handleProgramChange = (next: typeof program) => {
    setProgram(next);
    if (next === 'all') {
      setDirection('all');
    }
  };

  if (status === 'loading' && !data) {
    return (
      <div className="app-shell">
        <Header
          view={view}
          onViewChange={setView}
          updatedAt={null}
          stale={false}
          onRefresh={() => reload(true)}
          theme={theme}
          onThemeChange={setTheme}
        />
        <main className="app-main">
          <div className="state-card">Ielādē grafiku…</div>
        </main>
      </div>
    );
  }

  if (status === 'error' && !data) {
    return (
      <div className="app-shell">
        <Header
          view={view}
          onViewChange={setView}
          updatedAt={null}
          stale={false}
          onRefresh={() => reload(true)}
          theme={theme}
          onThemeChange={setTheme}
        />
        <main className="app-main">
          <div className="state-card state-card--error">
            <p>Grafiku neizdevās ielādēt.</p>
            <p className="state-card__detail">{error}</p>
            <button type="button" className="retry-btn" onClick={() => reload(true)}>
              Mēģināt vēlreiz
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
        onRefresh={() => reload(true)}
        theme={theme}
        onThemeChange={setTheme}
      />

      <main className="app-main">
        {(stale || error) && data && (
          <div className="banner" role="status">
            Neizdevās atjaunināt grafiku. Tiek rādīti pēdējie veiksmīgi ielādētie dati.
            <button type="button" onClick={() => reload(true)}>
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
                events={filteredEvents}
                onSelectDate={setSelectedDate}
                onSelectEvent={setSelectedEvent}
                showNextUp
                onSwipeDay={(dir) => setSelectedDate(addDaysIso(selectedDate, dir))}
              />
            </div>
            <div className="desktop-pane">
              <WeekCalendar
                weekStart={weekStart}
                events={filteredEvents}
                onSelect={setSelectedEvent}
              />
              <div className="desktop-day">
                <DayAgenda
                  selectedDate={selectedDate}
                  weekStart={weekStart}
                  events={filteredEvents}
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
                events={filteredEvents}
                onSelectDate={setSelectedDate}
                onSelectEvent={setSelectedEvent}
                onSwipeDay={(dir) => setSelectedDate(addDaysIso(selectedDate, dir))}
              />
            </div>
            <div className="desktop-only">
              <WeekCalendar
                weekStart={weekStart}
                events={filteredEvents}
                onSelect={setSelectedEvent}
              />
            </div>
          </>
        )}

        {view === 'agenda' && (
          <AgendaList
            fromDate={selectedDate}
            events={filteredEvents}
            onSelect={setSelectedEvent}
          />
        )}

        {view === 'month' && (
          <MonthView
            selectedDate={selectedDate}
            events={filteredEvents}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setView('today');
            }}
          />
        )}
      </main>

      <LectureDetailsSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
