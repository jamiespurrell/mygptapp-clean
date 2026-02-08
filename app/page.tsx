'use client';

import { SignIn, SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ItemStatus = 'active' | 'archived' | 'deleted';

type Task = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  urgency: number;
  score: number;
  createdAt: string;
  status: ItemStatus;
};

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  noteType: string;
  status: ItemStatus;
};

function inDateRange(value: string, from: string, to: string) {
  if (!value) return !from && !to;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (date < start) return false;
  }

  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }

  return true;
}

export default function HomePage() {
  const { user } = useUser();
  const userId = user?.id;
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetails, setTaskDetails] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskUrgency, setTaskUrgency] = useState('2');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTab, setTaskTab] = useState<ItemStatus>('active');
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(5);
  const [taskFromDate, setTaskFromDate] = useState('');
  const [taskToDate, setTaskToDate] = useState('');
  const [taskMenuOpenId, setTaskMenuOpenId] = useState<string | null>(null);
  const [taskDateDialogOpen, setTaskDateDialogOpen] = useState(false);
  const [taskDateDraftFrom, setTaskDateDraftFrom] = useState('');
  const [taskDateDraftTo, setTaskDateDraftTo] = useState('');

  const [noteTitle, setNoteTitle] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteType, setNoteType] = useState('Text note (no recording required)');
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesTab, setNotesTab] = useState<ItemStatus>('active');
  const [notesPage, setNotesPage] = useState(1);
  const [notesPageSize, setNotesPageSize] = useState(5);
  const [noteFromDate, setNoteFromDate] = useState('');
  const [noteToDate, setNoteToDate] = useState('');

  const [recordingStatus, setRecordingStatus] = useState('Ready to record.');
  const [audioUrl, setAudioUrl] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const noteStorageKey = useMemo(() => (userId ? `voice-note-items:${userId}` : ''), [userId]);

  const fetchTasks = useCallback(async () => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      setTasks([]);
      return;
    }

    try {
      const response = await fetch('/api/tasks', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data = (await response.json()) as {
        tasks: Array<{
          id: string;
          title: string;
          notes: string | null;
          dueDate: string | null;
          priority: number;
          status: 'ACTIVE' | 'ARCHIVED';
          createdAt: string;
        }>;
      };

      setTasks(
        data.tasks
          .map((task) => ({
            id: task.id,
            title: task.title,
            details: task.notes || '',
            dueDate: task.dueDate || '',
            urgency: Number(task.priority) || 2,
            score: computePriorityScore(task.dueDate || '', Number(task.priority) || 2),
            createdAt: task.createdAt,
            status: (task.status === 'ACTIVE' ? 'active' : 'archived') as ItemStatus,
          }))
          .sort((a, b) => b.score - a.score),
      );
    } catch (error) {
      console.error('Failed loading tasks', error);
    }
  }, [user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    if (!noteStorageKey) {
      setNotes([]);
      return;
    }

    const storedNotes = JSON.parse(localStorage.getItem(noteStorageKey) || '[]') as Note[];
    setNotes(storedNotes.map((note) => ({ ...note, status: note.status || 'active', noteType: note.noteType || 'Voice note' })));
  }, [noteStorageKey]);

  useEffect(() => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      setTasks([]);
      return;
    }

    fetchTasks();
  }, [fetchTasks, user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    if (!noteStorageKey) return;
    localStorage.setItem(noteStorageKey, JSON.stringify(notes));
  }, [notes, noteStorageKey]);

  useEffect(() => setNotesPage(1), [notesTab, notesPageSize, noteFromDate, noteToDate]);
  useEffect(() => setTaskPage(1), [taskTab, taskPageSize, taskFromDate, taskToDate]);
  useEffect(() => setTaskMenuOpenId(null), [taskTab, taskPage, taskFromDate, taskToDate]);

  function openTaskDateDialog() {
    setTaskDateDraftFrom(taskFromDate);
    setTaskDateDraftTo(taskToDate);
    setTaskDateDialogOpen(true);
  }

  function confirmTaskDateDialog() {
    setTaskFromDate(taskDateDraftFrom);
    setTaskToDate(taskDateDraftTo);
    setTaskDateDialogOpen(false);
  }

  function cancelTaskDateDialog() {
    setTaskDateDialogOpen(false);
  }

  function computePriorityScore(dueDate: string, urgency: number) {
    let score = urgency * 30;
    if (!dueDate) return score;

    const today = new Date();
    const due = new Date(dueDate);
    const days = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 0) score += 100;
    else if (days <= 1) score += 60;
    else if (days <= 3) score += 40;
    else if (days <= 7) score += 20;

    return score;
  }

  async function startRecording() {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        setRecordingStatus('Recording captured! Add a title or notes, then save.');
      };

      recorder.start();
      setIsRecording(true);
      setRecordingStatus('Recording now...');
    } catch {
      setRecordingStatus('Microphone access denied.');
    }
  }

  function stopRecording() {
    if (!recorderRef.current || !isRecording) return;
    recorderRef.current.stop();
    setIsRecording(false);
  }

  async function saveTask() {
    if (!taskTitle.trim()) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          details: taskDetails.trim(),
          dueDate: taskDue || null,
          urgency: Number(taskUrgency),
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');

      setTaskTitle('');
      setTaskDetails('');
      setTaskDue('');
      setTaskUrgency('2');
      await fetchTasks();
    } catch (error) {
      console.error('Failed saving task', error);
    }
  }

  function saveNote() {
    if (!noteTitle.trim() && !noteInput.trim()) return;

    setNotes((prev) => [
      {
        id: crypto.randomUUID(),
        title: noteTitle.trim() || 'Untitled Note',
        content: noteInput.trim(),
        createdAt: new Date().toISOString(),
        noteType,
        status: 'active',
      },
      ...prev,
    ]);

    setNoteTitle('');
    setNoteInput('');
    setAudioUrl('');
    setNoteType('Text note (no recording required)');
  }

  function createTaskFromNote(note: Note) {
    const noteContext = note.content.trim() || 'No note text';
    const source = `From ${note.noteType} captured ${new Date(note.createdAt).toLocaleString()}`;

    setTaskTitle(note.title.trim() || 'Follow-up task');
    setTaskDetails(`${noteContext}\n\n${source}`);
    setTaskTab('active');
    setTaskPage(1);
  }


  function addTaskToCalendar(task: Task) {
    const startDate = task.dueDate ? new Date(`${task.dueDate}T09:00:00`) : new Date(task.createdAt);
    if (Number.isNaN(startDate.getTime())) return;

    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);

    const toGoogleDate = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: task.title || 'Task',
      details: task.details || 'Task from Daily To-Do list',
      dates: `${toGoogleDate(startDate)}/${toGoogleDate(endDate)}`,
    });

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;
    window.open(googleCalendarUrl, '_blank', 'noopener,noreferrer');
  }

  async function updateTaskStatus(id: string, status: ItemStatus) {
    try {
      const response = await fetch(`/api/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed updating task status');
      await fetchTasks();
    } catch (error) {
      console.error('Failed updating task status', error);
    }
  }

  function updateNoteStatus(id: string, status: ItemStatus) {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, status } : note)));
  }

  const taskCounts = useMemo(
    () => ({
      active: tasks.filter((task) => task.status === 'active').length,
      archived: tasks.filter((task) => task.status === 'archived').length,
      deleted: tasks.filter((task) => task.status === 'deleted').length,
    }),
    [tasks],
  );

  const noteCounts = useMemo(
    () => ({
      active: notes.filter((note) => note.status === 'active').length,
      archived: notes.filter((note) => note.status === 'archived').length,
      deleted: notes.filter((note) => note.status === 'deleted').length,
    }),
    [notes],
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === taskTab &&
          inDateRange(task.dueDate || task.createdAt, taskFromDate, taskToDate),
      ),
    [tasks, taskTab, taskFromDate, taskToDate],
  );

  const filteredNotes = useMemo(
    () =>
      notes.filter(
        (note) =>
          note.status === notesTab &&
          inDateRange(note.createdAt, noteFromDate, noteToDate),
      ),
    [notes, notesTab, noteFromDate, noteToDate],
  );

  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / taskPageSize));
  const noteTotalPages = Math.max(1, Math.ceil(filteredNotes.length / notesPageSize));

  const pagedTasks = filteredTasks.slice((taskPage - 1) * taskPageSize, taskPage * taskPageSize);
  const pagedNotes = filteredNotes.slice((notesPage - 1) * notesPageSize, notesPage * notesPageSize);

  return (
    <main className="app">
      <SignedOut>
        <section className="panel auth-panel">
          <h2>Welcome back</h2>
          <p className="status">Sign in below to access your planner. New here? Use the sign-up link under the form.</p>
          <div className="inline-auth">
            <SignIn />
          </div>
        </section>
      </SignedOut>

      <SignedIn>
        <section className="layout">
          <article className="panel">
            <h2>Voice Notes</h2>
            <div className="row buttons-inline">
              <button className="btn btn-primary" onClick={startRecording}>Start Recording</button>
              <button className="btn btn-danger" onClick={stopRecording}>Stop Recording</button>
            </div>
            <p className="status">{recordingStatus}</p>
            <audio controls src={audioUrl} />

            <label htmlFor="noteTitle">Title</label>
            <input id="noteTitle" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Morning planning" />

            <label htmlFor="noteInput">Notes</label>
            <textarea id="noteInput" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Context or follow up" rows={4} />

            <label htmlFor="noteType">Note type</label>
            <select id="noteType" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              <option value="Voice note">Voice note</option>
              <option value="Text note (no recording required)">Text note (no recording required)</option>
            </select>

            <div className="row stack-mobile">
              <button className="btn btn-primary btn-wide" onClick={saveNote}>Save Voice Note</button>
              <button
                className="btn btn-muted btn-wide"
                onClick={() => {
                  setNoteTitle('');
                  setNoteInput('');
                  setAudioUrl('');
                  setRecordingStatus('Draft discarded.');
                }}
              >
                Discard
              </button>
            </div>

            <div className="tab-row">
              <button className={`tab-btn ${notesTab === 'active' ? 'active' : ''}`} onClick={() => setNotesTab('active')}>Voice Notes ({noteCounts.active})</button>
              <button className={`tab-btn ${notesTab === 'archived' ? 'active' : ''}`} onClick={() => setNotesTab('archived')}>Archived ({noteCounts.archived})</button>
              <button className={`tab-btn ${notesTab === 'deleted' ? 'active' : ''}`} onClick={() => setNotesTab('deleted')}>Deleted ({noteCounts.deleted})</button>
            </div>

            <div className="filter-row">
              <input type="date" value={noteFromDate} onChange={(e) => setNoteFromDate(e.target.value)} aria-label="Note from date" />
              <span>→</span>
              <input type="date" value={noteToDate} onChange={(e) => setNoteToDate(e.target.value)} aria-label="Note to date" />
              <label htmlFor="notesPageSize" className="show-label">Show</label>
              <select id="notesPageSize" value={notesPageSize} onChange={(e) => setNotesPageSize(Number(e.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            <div className="empty-box">
              {pagedNotes.length ? (
                pagedNotes.map((note) => (
                  <div key={note.id} className="saved-note">
                    <strong>{note.title}</strong>
                    <br />
                    <small>{note.content || 'No note text'} • {note.noteType}</small>
                    <div className="item-actions">
                      {notesTab === 'active' && <button className="mini-btn mini-primary" onClick={() => createTaskFromNote(note)}>Create Task</button>}
                      {notesTab !== 'active' && <button className="mini-btn" onClick={() => updateNoteStatus(note.id, 'active')}>Activate</button>}
                      {notesTab !== 'archived' && <button className="mini-btn" onClick={() => updateNoteStatus(note.id, 'archived')}>Archive</button>}
                      {notesTab !== 'deleted' && <button className="mini-btn mini-danger" onClick={() => updateNoteStatus(note.id, 'deleted')}>Delete</button>}
                    </div>
                  </div>
                ))
              ) : (
                'No voice notes yet. Start recording to capture one!'
              )}
            </div>

            <div className="pagination-row">
              <button className="mini-btn" disabled={notesPage === 1} onClick={() => setNotesPage((prev) => Math.max(1, prev - 1))}>Prev</button>
              <span>Page {Math.min(notesPage, noteTotalPages)} of {noteTotalPages}</span>
              <button className="mini-btn" disabled={notesPage >= noteTotalPages} onClick={() => setNotesPage((prev) => Math.min(noteTotalPages, prev + 1))}>Next</button>
            </div>
          </article>

          <article className="panel">
            <h2>Daily To-Do List</h2>

            <label htmlFor="taskTitle">Task</label>
            <input id="taskTitle" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Plan weekly meals" />

            <label htmlFor="taskDetails">Details (optional)</label>
            <textarea id="taskDetails" value={taskDetails} onChange={(e) => setTaskDetails(e.target.value)} placeholder="Add helpful notes" rows={4} />

            <label htmlFor="taskUrgency">Priority</label>
            <select id="taskUrgency" value={taskUrgency} onChange={(e) => setTaskUrgency(e.target.value)}>
              <option value="3">High</option>
              <option value="2">Medium</option>
              <option value="1">Low</option>
            </select>

            <label htmlFor="taskDue">Due date (optional)</label>
            <input id="taskDue" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />

            <button className="btn btn-primary btn-wide" onClick={saveTask}>Add Task</button>

            <div className="tab-row">
              <button className={`tab-btn ${taskTab === 'active' ? 'active' : ''}`} onClick={() => setTaskTab('active')}>Active Tasks ({taskCounts.active})</button>
              <button className={`tab-btn ${taskTab === 'archived' ? 'active' : ''}`} onClick={() => setTaskTab('archived')}>Archived Tasks ({taskCounts.archived})</button>
              <button className={`tab-btn ${taskTab === 'deleted' ? 'active' : ''}`} onClick={() => setTaskTab('deleted')}>Deleted Tasks ({taskCounts.deleted})</button>
            </div>

            <div className="filter-row task-filter-row">
              <button className="date-display" onClick={openTaskDateDialog} aria-label="Select task from date">
                {taskFromDate || 'yyyy-mm-dd'}
              </button>
              <span>→</span>
              <button className="date-display" onClick={openTaskDateDialog} aria-label="Select task to date">
                {taskToDate || 'yyyy-mm-dd'}
              </button>
              <button className="calendar-trigger" onClick={openTaskDateDialog} aria-label="Open task date range dialog">📅</button>
              <label htmlFor="taskPageSize" className="show-label">Show</label>
              <select id="taskPageSize" value={taskPageSize} onChange={(e) => setTaskPageSize(Number(e.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            {taskDateDialogOpen && (
              <div className="date-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Select task date range">
                <div className="date-dialog">
                  <h3>Select date range</h3>
                  <div className="date-dialog-inputs">
                    <div>
                      <label htmlFor="taskDateDraftFrom">From</label>
                      <input id="taskDateDraftFrom" type="date" value={taskDateDraftFrom} onChange={(e) => setTaskDateDraftFrom(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="taskDateDraftTo">To</label>
                      <input id="taskDateDraftTo" type="date" value={taskDateDraftTo} onChange={(e) => setTaskDateDraftTo(e.target.value)} />
                    </div>
                  </div>
                  <div className="date-dialog-actions">
                    <button className="mini-btn" onClick={cancelTaskDateDialog}>Cancel</button>
                    <button className="btn btn-primary" onClick={confirmTaskDateDialog}>Confirm</button>
                  </div>
                </div>
              </div>
            )}

            <ul className="task-list">
              {pagedTasks.length ? (
                pagedTasks.map((task) => {
                  const priority = task.score >= 120 ? 'High' : task.score >= 70 ? 'Medium' : 'Low';
                  return (
                    <li key={task.id} className="task-item">
                      <div>
                        <strong>{task.title}</strong>
                        <br />
                        <small>{task.details || 'No details'} • Due: {task.dueDate || 'No date'}</small>
                      </div>
                      <div className="right-stack">
                        <span className={`priority-pill priority-${priority.toLowerCase()}`}>{priority}</span>
                        <div className="task-menu-wrap">
                          <button
                            className="menu-trigger"
                            onClick={() => setTaskMenuOpenId((prev) => (prev === task.id ? null : task.id))}
                            aria-label="Open task actions"
                          >
                            •••
                          </button>
                          {taskMenuOpenId === task.id && (
                            <div className="task-dropdown">
                              {taskTab !== 'active' && (
                                <button className="task-dropdown-item" onClick={() => { updateTaskStatus(task.id, 'active'); setTaskMenuOpenId(null); }}>
                                  Activate
                                </button>
                              )}
                              {taskTab !== 'archived' && (
                                <button className="task-dropdown-item" onClick={() => { updateTaskStatus(task.id, 'archived'); setTaskMenuOpenId(null); }}>
                                  Archive
                                </button>
                              )}
                              <button className="task-dropdown-item" onClick={() => { addTaskToCalendar(task); setTaskMenuOpenId(null); }}>
                                Add to Calendar
                              </button>
                              {taskTab !== 'deleted' && (
                                <button className="task-dropdown-item task-dropdown-danger" onClick={() => { updateTaskStatus(task.id, 'deleted'); setTaskMenuOpenId(null); }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="empty-item">No {taskTab} tasks yet. Add your first to-do above!</li>
              )}
            </ul>

            {taskTab === 'deleted' && (
              <p className="status retention-note">Deleted tasks are permanently removed 30 days after the task was created.</p>
            )}

            <div className="pagination-row">
              <button className="mini-btn" disabled={taskPage === 1} onClick={() => setTaskPage((prev) => Math.max(1, prev - 1))}>Prev</button>
              <span>Page {Math.min(taskPage, taskTotalPages)} of {taskTotalPages}</span>
              <button className="mini-btn" disabled={taskPage >= taskTotalPages} onClick={() => setTaskPage((prev) => Math.min(taskTotalPages, prev + 1))}>Next</button>
            </div>
          </article>
        </section>
      </SignedIn>
    </main>
  );
}
