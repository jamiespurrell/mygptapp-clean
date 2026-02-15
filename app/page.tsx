'use client';

import { SignIn, SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ItemStatus = 'active' | 'archived' | 'deleted';
type NoteTab = 'active' | 'created' | 'archived' | 'deleted';

type Task = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  urgency: number;
  score: number;
  createdAt: string;
  status: ItemStatus;
  sourceVoiceNoteId: string | null;
  sourceVoiceNote: {
    id: string;
    type: 'TEXT' | 'AUDIO';
    audioUrl: string | null;
  } | null;
  deletedAt: string | null;
};

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  noteType: string;
  type: 'TEXT' | 'AUDIO';
  audioUrl: string | null;
  audioMimeType: string | null;
  durationMs: number | null;
  status: ItemStatus;
  taskCreatedAt: string | null;
  linkedTaskId?: string | null;
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
  const [taskErrorMessage, setTaskErrorMessage] = useState('');
  const [noteActionMessage, setNoteActionMessage] = useState('');
  const [pendingTaskSourceNoteId, setPendingTaskSourceNoteId] = useState<string | null>(null);
  const [isTaskCreateModalOpen, setIsTaskCreateModalOpen] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteType, setNoteType] = useState<'TEXT' | 'AUDIO'>('TEXT');
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesTab, setNotesTab] = useState<NoteTab>('active');
  const [notesPage, setNotesPage] = useState(1);
  const [notesPageSize, setNotesPageSize] = useState(5);
  const [noteFromDate, setNoteFromDate] = useState('');
  const [noteToDate, setNoteToDate] = useState('');
  const [noteMenuOpenId, setNoteMenuOpenId] = useState<string | null>(null);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDetails, setEditTaskDetails] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskUrgency, setEditTaskUrgency] = useState('2');
  const [taskEditMessage, setTaskEditMessage] = useState('');

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');
  const [noteEditMessage, setNoteEditMessage] = useState('');

  const [recordingStatus, setRecordingStatus] = useState('Ready to record.');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);


  const fetchTasks = useCallback(async () => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      setTasks([]);
      setTaskErrorMessage('');
      return;
    }

    try {
      setTaskErrorMessage('');
      const response = await fetch('/api/tasks', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data = (await response.json()) as {
        tasks: Array<{
          id: string;
          title: string;
          notes: string | null;
          dueDate: string | null;
          priority: number;
          status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
          sourceVoiceNoteId: string | null;
          sourceVoiceNote: {
            id: string;
            type: 'TEXT' | 'AUDIO';
            audioUrl: string | null;
          } | null;
          deletedAt: string | null;
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
            status: (task.status === 'DELETED' ? 'deleted' : task.status === 'ARCHIVED' ? 'archived' : 'active') as ItemStatus,
            sourceVoiceNoteId: task.sourceVoiceNoteId,
            sourceVoiceNote: task.sourceVoiceNote,
            deletedAt: task.deletedAt,
          }))
          .sort((a, b) => b.score - a.score),
      );
    } catch (error) {
      console.error('Failed loading tasks', error);
      setTaskErrorMessage('Failed to load tasks');
    }
  }, [user?.primaryEmailAddress?.emailAddress]);

  const fetchNotes = useCallback(async () => {
    if (!user?.id) {
      setNotes([]);
      return;
    }

    try {
      const response = await fetch('/api/voice-notes', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch voice notes');

      const data = (await response.json()) as {
        notes: Array<{
          id: string;
          title: string | null;
          content: string | null;
          createdAt: string;
          noteType: string;
          type: 'TEXT' | 'AUDIO';
          audioUrl: string | null;
          audioMimeType: string | null;
          durationMs: number | null;
          status: ItemStatus;
          taskCreatedAt: string | null;
        }>
      };

      setNotes(data.notes.map((note) => ({ ...note, title: note.title || 'Untitled Note', content: note.content || '', taskCreatedAt: note.taskCreatedAt, linkedTaskId: null })));
    } catch (error) {
      console.error('Failed loading voice notes', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      setTasks([]);
      return;
    }

    fetchTasks();
  }, [fetchTasks, user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (!tasks.length) return;

    setNotes((prev) => {
      let changed = false;
      const next = prev.map((note) => {
        const matchingTask = tasks.find((task) => task.sourceVoiceNoteId === note.id);
        const linkedTaskId = matchingTask?.id || null;
        if ((note.linkedTaskId || null) === linkedTaskId) {
          return note;
        }

        changed = true;
        return { ...note, linkedTaskId };
      });

      return changed ? next : prev;
    });
  }, [tasks]);

  useEffect(() => setNotesPage(1), [notesTab, notesPageSize, noteFromDate, noteToDate]);
  useEffect(() => setTaskPage(1), [taskTab, taskPageSize, taskFromDate, taskToDate]);
  useEffect(() => setTaskMenuOpenId(null), [taskTab, taskPage, taskFromDate, taskToDate]);
  useEffect(() => setNoteMenuOpenId(null), [notesTab, notesPage, noteFromDate, noteToDate]);

  useEffect(() => {
    if (!isTaskCreateModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTaskCreateModal();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isTaskCreateModalOpen]);

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
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
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

    const isVoiceNoteTaskCreateFlow = Boolean(pendingTaskSourceNoteId && isTaskCreateModalOpen);

    try {
      setTaskErrorMessage('');
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          notes: taskDetails.trim(),
          dueDate: taskDue || null,
          priority: Number(taskUrgency),
          sourceVoiceNoteId: pendingTaskSourceNoteId,
        }),
      });

      const payload = (await response.json()) as { task?: { id: string }; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to create task');

      if (pendingTaskSourceNoteId) {
        setNotes((prev) =>
          prev.map((item) =>
            item.id === pendingTaskSourceNoteId ? { ...item, linkedTaskId: payload.task?.id || 'created-task' } : item,
          ),
        );
      }

      setPendingTaskSourceNoteId(null);
      setTaskTitle('');
      setTaskDetails('');
      setTaskDue('');
      setTaskUrgency('2');
      setIsTaskCreateModalOpen(false);
      setNoteActionMessage('');
      setTaskTab('active');
      setTaskPage(1);

      if (isVoiceNoteTaskCreateFlow) {
        setIsComposerExpanded(false);
        setIsTaskPanelOpen(false);
        setTaskFromDate('');
        setTaskToDate('');
      }

      await fetchTasks();
    } catch (error) {
      console.error('Failed saving task', error);
      setTaskErrorMessage('Failed to add task');
    }
  }

  async function saveNote() {
    if (!noteTitle.trim() && !noteInput.trim() && !audioBlob) return;

    try {
      const formData = new FormData();
      formData.append('title', noteTitle.trim());
      formData.append('content', noteInput.trim());
      formData.append('type', noteType);

      if (audioBlob) {
        formData.append('audio', audioBlob, `voice-note-${Date.now()}.webm`);
      }

      const response = await fetch('/api/voice-notes', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json()) as { note?: Note; error?: string };
      if (!response.ok || !payload.note) {
        throw new Error(payload.error || 'Failed to save note');
      }

      const savedNote = payload.note as Note;
      setNotes((prev) => [{ ...savedNote, linkedTaskId: null }, ...prev]);
      setNoteTitle('');
      setNoteInput('');
      setAudioUrl('');
      setAudioBlob(null);
      setNoteType('TEXT');
      setRecordingStatus('Voice note saved.');
    } catch (error) {
      console.error('Failed saving voice note', error);
      setRecordingStatus('Failed to save voice note.');
    }
  }

  async function createTaskFromNote(note: Note) {
    if (note.linkedTaskId || note.taskCreatedAt) return;

    try {
      const response = await fetch(`/api/voice-notes/${note.id}/task-created`, {
        method: 'PATCH',
      });
      const payload = (await response.json()) as { note?: { taskCreatedAt: string }; error?: string };
      if (!response.ok || !payload.note?.taskCreatedAt) {
        throw new Error(payload.error || 'Failed to mark voice note as created');
      }

      const noteContext = note.content.trim() || 'No note text';
      const source = `From ${note.noteType} captured ${new Date(note.createdAt).toLocaleString()}`;

      setTaskTitle(note.title.trim() || 'Follow-up task');
      setTaskDetails(`${noteContext}

${source}`);
      setTaskDue('');
      setTaskUrgency('2');
      setPendingTaskSourceNoteId(note.id);
      setNotes((prev) =>
        prev.map((item) =>
          item.id === note.id
            ? { ...item, linkedTaskId: 'copied-to-form', taskCreatedAt: payload.note?.taskCreatedAt || item.taskCreatedAt }
            : item,
        ),
      );
      setTaskTab('active');
      setTaskPage(1);
      setTaskErrorMessage('');
      setIsTaskCreateModalOpen(true);
      setNoteActionMessage('Task draft copied from voice note. Confirm with Add Task to save.');
    } catch (error) {
      console.error('Failed preparing task from voice note', error);
    }
  }

  function closeTaskCreateModal() {
    setIsTaskCreateModalOpen(false);
    setPendingTaskSourceNoteId(null);
    setTaskTitle('');
    setTaskDetails('');
    setTaskDue('');
    setTaskUrgency('2');
    setNoteActionMessage('');
  }


  function openTaskEditModal(task: Task) {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskDetails(task.details);
    setEditTaskDueDate(task.dueDate || '');
    setEditTaskUrgency(String(task.urgency || 2));
    setTaskEditMessage('');
  }

  function closeTaskEditModal() {
    setEditingTask(null);
    setTaskEditMessage('');
  }

  async function saveTaskEdit() {
    if (!editingTask || !editTaskTitle.trim()) return;

    try {
      setTaskEditMessage('');
      const response = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTaskTitle.trim(),
          notes: editTaskDetails,
          dueDate: editTaskDueDate || null,
          priority: Number(editTaskUrgency),
        }),
      });

      const payload = (await response.json()) as {
        task?: {
          id: string;
          title: string;
          notes: string | null;
          dueDate: string | null;
          priority: number;
        };
        error?: string;
      };

      if (!response.ok || !payload.task) {
        throw new Error(payload.error || 'Failed to save task');
      }

      setTasks((prev) =>
        prev
          .map((task) =>
            task.id === editingTask.id
              ? {
                  ...task,
                  title: payload.task?.title || task.title,
                  details: payload.task?.notes || '',
                  dueDate: payload.task?.dueDate || '',
                  urgency: Number(payload.task?.priority) || task.urgency,
                  score: computePriorityScore(payload.task?.dueDate || '', Number(payload.task?.priority) || task.urgency),
                }
              : task,
          )
          .sort((a, b) => b.score - a.score),
      );

      closeTaskEditModal();
    } catch (error) {
      console.error('Failed updating task', error);
      setTaskEditMessage('Unable to save task changes.');
    }
  }

  function openNoteEditModal(note: Note) {
    setEditingNote(note);
    setEditNoteTitle(note.title);
    setEditNoteContent(note.content || '');
    setNoteEditMessage('');
  }

  function closeNoteEditModal() {
    setEditingNote(null);
    setNoteEditMessage('');
  }

  async function saveNoteEdit() {
    if (!editingNote) return;

    try {
      setNoteEditMessage('');
      const response = await fetch(`/api/voice-notes/${editingNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editNoteTitle,
          content: editNoteContent,
        }),
      });

      const payload = (await response.json()) as {
        note?: {
          id: string;
          title: string | null;
          content: string | null;
          noteType: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.note) {
        throw new Error(payload.error || 'Failed to save note');
      }

      setNotes((prev) =>
        prev.map((note) =>
          note.id === editingNote.id
            ? {
                ...note,
                title: payload.note?.title || 'Untitled Note',
                content: payload.note?.content || '',
                noteType: payload.note?.noteType || note.noteType,
              }
            : note,
        ),
      );

      closeNoteEditModal();
    } catch (error) {
      console.error('Failed updating voice note', error);
      setNoteEditMessage('Unable to save note changes.');
    }
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

      const payload = (await response.json()) as {
        task?: { status: 'ACTIVE' | 'ARCHIVED' | 'DELETED'; deletedAt: string | null };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed updating task status');
      }

      const nextStatus = payload.task?.status === 'DELETED'
        ? 'deleted'
        : payload.task?.status === 'ARCHIVED'
          ? 'archived'
          : payload.task?.status === 'ACTIVE'
            ? 'active'
            : status;

      setTasks((prev) =>
        prev.map((task) =>
          task.id === id
            ? { ...task, status: nextStatus, deletedAt: payload.task?.deletedAt ?? (nextStatus === 'deleted' ? new Date().toISOString() : null) }
            : task,
        ),
      );
    } catch (error) {
      console.error('Failed updating task status', error);
    }
  }

  async function updateNoteStatus(id: string, status: ItemStatus) {
    try {
      const response = await fetch(`/api/voice-notes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as { note?: { status: ItemStatus }; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed updating voice note status');

      await fetchNotes();
    } catch (error) {
      console.error('Failed updating voice note status', error);
    }
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
      active: notes.filter((note) => note.status === 'active' && !note.taskCreatedAt).length,
      created: notes.filter((note) => note.status === 'active' && Boolean(note.taskCreatedAt)).length,
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
      notes.filter((note) => {
        const matchesTab = notesTab === 'created'
          ? note.status === 'active' && Boolean(note.taskCreatedAt)
          : notesTab === 'active'
            ? note.status === 'active' && !note.taskCreatedAt
            : note.status === notesTab;

        return matchesTab && inDateRange(note.createdAt, noteFromDate, noteToDate);
      }),
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
        <section>
          {!isComposerExpanded && (
            <button
              className="composer-collapsed"
              onClick={() => {
                setIsComposerExpanded(true);
                setIsTaskPanelOpen(false);
              }}
            >
              <span>Take a note...</span>
            </button>
          )}

          {isComposerExpanded && (
            <div className="composer-header">
              <button
                className="mini-btn"
                onClick={() => {
                  setIsComposerExpanded(false);
                  setIsTaskPanelOpen(false);
                }}
              >
                Close
              </button>
            </div>
          )}

          <div className={`layout ${isComposerExpanded && !isTaskPanelOpen ? 'layout-single' : ''}`}>
          {isComposerExpanded && (
            <article className="panel">
            <h2>Voice Notes</h2>
            <div className="row buttons-inline">
              <button className="btn btn-primary" onClick={startRecording}>Start Recording</button>
              <button className="btn btn-danger" onClick={stopRecording}>Stop Recording</button>
            </div>
            <p className="status">{recordingStatus}</p>
            {audioUrl ? <audio controls src={audioUrl} /> : null}

            <label htmlFor="noteTitle">Title</label>
            <input id="noteTitle" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Morning planning" />

            <label htmlFor="noteInput">Notes</label>
            <textarea id="noteInput" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Context or follow up" rows={4} />

            <label htmlFor="noteType">Note type</label>
            <select id="noteType" value={noteType} onChange={(e) => setNoteType(e.target.value as 'TEXT' | 'AUDIO')}>
              <option value="AUDIO">Voice note</option>
              <option value="TEXT">Text note (no recording required)</option>
            </select>

            <div className="row stack-mobile">
              <button className="btn btn-primary btn-wide" onClick={saveNote}>Save Voice Note</button>
              <button
                className="btn btn-muted btn-wide"
                onClick={() => {
                  setNoteTitle('');
                  setNoteInput('');
                  setAudioUrl('');
                  setAudioBlob(null);
                  setNoteType('TEXT');
                  setRecordingStatus('Draft discarded.');
                }}
              >
                Discard
              </button>
            </div>

            <div className="tab-row">
              <button className={`tab-btn ${notesTab === 'active' ? 'active' : ''}`} onClick={() => setNotesTab('active')}>Voice Notes ({noteCounts.active})</button>
              <button className={`tab-btn ${notesTab === 'created' ? 'active' : ''}`} onClick={() => setNotesTab('created')}>Created ({noteCounts.created})</button>
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
                    {note.type === 'AUDIO' ? (
                      note.audioUrl ? <audio controls src={note.audioUrl} /> : <small className="status">Audio unavailable</small>
                    ) : null}
                    <div className="item-actions note-actions">
                      {(notesTab === 'active' || notesTab === 'created') && (
                        <button
                          className="mini-btn mini-primary"
                          onClick={() => createTaskFromNote(note)}
                          disabled={Boolean(note.linkedTaskId || note.taskCreatedAt)}
                        >
                          {note.linkedTaskId || note.taskCreatedAt ? 'Copied to Form' : 'Create Task'}
                        </button>
                      )}
                      <div className="task-menu-wrap">
                        <button
                          className="menu-trigger"
                          onClick={() => setNoteMenuOpenId((prev) => (prev === note.id ? null : note.id))}
                          aria-label="Open voice note actions"
                        >
                          •••
                        </button>
                        {noteMenuOpenId === note.id && (
                          <div className="task-dropdown">
                            <button className="task-dropdown-item" onClick={() => { openNoteEditModal(note); setNoteMenuOpenId(null); }}>
                              Edit
                            </button>
                            {notesTab !== 'active' && <button className="task-dropdown-item" onClick={() => { updateNoteStatus(note.id, 'active'); setNoteMenuOpenId(null); }}>Activate</button>}
                            {notesTab !== 'archived' && <button className="task-dropdown-item" onClick={() => { updateNoteStatus(note.id, 'archived'); setNoteMenuOpenId(null); }}>Archive</button>}
                            {notesTab !== 'deleted' && <button className="task-dropdown-item task-dropdown-danger" onClick={() => { updateNoteStatus(note.id, 'deleted'); setNoteMenuOpenId(null); }}>Delete</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                'No voice notes yet. Start recording to capture one!'
              )}
            </div>

            {noteActionMessage && <p className="status">{noteActionMessage}</p>}

            <div className="pagination-row">
              <button className="mini-btn" disabled={notesPage === 1} onClick={() => setNotesPage((prev) => Math.max(1, prev - 1))}>Prev</button>
              <span>Page {Math.min(notesPage, noteTotalPages)} of {noteTotalPages}</span>
              <button className="mini-btn" disabled={notesPage >= noteTotalPages} onClick={() => setNotesPage((prev) => Math.min(noteTotalPages, prev + 1))}>Next</button>
            </div>
          </article>
          )}

          {(!isComposerExpanded || isTaskPanelOpen) && (
          <article className="task-section">
            {isComposerExpanded && (
              <div className="task-panel-header">
                <h2>Daily To-Do List</h2>
                <button className="mini-btn" onClick={() => setIsTaskPanelOpen(false)}>Close</button>
              </div>
            )}
            {!isComposerExpanded && <h2>Daily To-Do List</h2>}

            {isComposerExpanded && isTaskPanelOpen && (
              <>
                <label htmlFor="taskTitleInline">Task</label>
                <input id="taskTitleInline" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Plan weekly meals" />

                <label htmlFor="taskDetailsInline">Details (optional)</label>
                <textarea id="taskDetailsInline" value={taskDetails} onChange={(e) => setTaskDetails(e.target.value)} placeholder="Add helpful notes" rows={4} />

                <label htmlFor="taskUrgencyInline">Priority</label>
                <select id="taskUrgencyInline" value={taskUrgency} onChange={(e) => setTaskUrgency(e.target.value)}>
                  <option value="3">High</option>
                  <option value="2">Medium</option>
                  <option value="1">Low</option>
                </select>

                <label htmlFor="taskDueInline">Due date (optional)</label>
                <input id="taskDueInline" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />

                <button className="btn btn-primary btn-wide" onClick={saveTask}>Add Task</button>
              </>
            )}

            <div className="tab-filter-row">
              <div className="tab-row task-tab-row">
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

            <div className="task-grid-wrap">
              {taskErrorMessage && <p className="empty-item">{taskErrorMessage}</p>}
              {pagedTasks.length ? (
                <div className="task-grid">
                  {pagedTasks.map((task) => {
                    const priority = task.urgency === 3 ? 'High' : task.urgency === 2 ? 'Medium' : 'Low';
                    return (
                    <article key={task.id} className="task-card">
                      <div className="task-card-header">
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
                              <button className="task-dropdown-item" onClick={() => { openTaskEditModal(task); setTaskMenuOpenId(null); }}>
                                Edit
                              </button>
                              {taskTab !== 'active' && (
                                <button className="task-dropdown-item" onClick={() => { updateTaskStatus(task.id, 'active'); setTaskMenuOpenId(null); }}>
                                  {taskTab === 'deleted' ? 'Restore' : 'Activate'}
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
                      <div>
                        <strong>{task.title}</strong>
                        <br />
                        <small>{task.details || 'No details'} • Due: {task.dueDate || 'No date'}</small>
                        {task.sourceVoiceNote?.audioUrl ? <audio controls src={task.sourceVoiceNote.audioUrl} /> : null}
                        {task.status === 'deleted' && task.deletedAt && (
                          <p className="task-retention-note">Permanently deletes on: {new Date(new Date(task.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                        )}
                      </div>
                    </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-item">No {taskTab} tasks yet. Add your first to-do above!</p>
              )}
            </div>

            {taskTab === 'deleted' && (
              <p className="status retention-note">Deleted tasks are permanently removed 30 days after first deletion.</p>
            )}

            {editingTask && (
              <div className="date-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Edit task">
                <div className="date-dialog edit-dialog">
                  <h3>Edit task</h3>
                  <label htmlFor="editTaskTitle">Title</label>
                  <input id="editTaskTitle" value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} />

                  <label htmlFor="editTaskDetails">Details</label>
                  <textarea id="editTaskDetails" value={editTaskDetails} onChange={(e) => setEditTaskDetails(e.target.value)} rows={4} />

                  <label htmlFor="editTaskUrgency">Priority</label>
                  <select id="editTaskUrgency" value={editTaskUrgency} onChange={(e) => setEditTaskUrgency(e.target.value)}>
                    <option value="3">High</option>
                    <option value="2">Medium</option>
                    <option value="1">Low</option>
                  </select>

                  <label htmlFor="editTaskDueDate">Due date</label>
                  <input id="editTaskDueDate" type="date" value={editTaskDueDate} onChange={(e) => setEditTaskDueDate(e.target.value)} />

                  {taskEditMessage ? <p className="status">{taskEditMessage}</p> : null}

                  <div className="date-dialog-actions">
                    <button className="mini-btn" onClick={closeTaskEditModal}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveTaskEdit}>Save</button>
                  </div>
                </div>
              </div>
            )}

            {editingNote && (
              <div className="date-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Edit voice note">
                <div className="date-dialog edit-dialog">
                  <h3>Edit voice note</h3>

                  <label htmlFor="editNoteTitle">Title</label>
                  <input id="editNoteTitle" value={editNoteTitle} onChange={(e) => setEditNoteTitle(e.target.value)} />

                  <label htmlFor="editNoteContent">Notes</label>
                  <textarea id="editNoteContent" value={editNoteContent} onChange={(e) => setEditNoteContent(e.target.value)} rows={4} />

                  {noteEditMessage ? <p className="status">{noteEditMessage}</p> : null}

                  <div className="date-dialog-actions">
                    <button className="mini-btn" onClick={closeNoteEditModal}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveNoteEdit}>Save</button>
                  </div>
                </div>
              </div>
            )}

            <div className="pagination-row">
              <button className="mini-btn" disabled={taskPage === 1} onClick={() => setTaskPage((prev) => Math.max(1, prev - 1))}>Prev</button>
              <span>Page {Math.min(taskPage, taskTotalPages)} of {taskTotalPages}</span>
              <button className="mini-btn" disabled={taskPage >= taskTotalPages} onClick={() => setTaskPage((prev) => Math.min(taskTotalPages, prev + 1))}>Next</button>
            </div>
          </article>
          )}
          </div>

          {isTaskCreateModalOpen && (
            <div className="date-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Create task from voice note" onClick={closeTaskCreateModal}>
              <div className="date-dialog edit-dialog" onClick={(event) => event.stopPropagation()}>
                <h3>Create task</h3>
                <label htmlFor="taskTitleModal">Task</label>
                <input id="taskTitleModal" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Plan weekly meals" />

                <label htmlFor="taskDetailsModal">Details (optional)</label>
                <textarea id="taskDetailsModal" value={taskDetails} onChange={(e) => setTaskDetails(e.target.value)} placeholder="Add helpful notes" rows={4} />

                <label htmlFor="taskUrgencyModal">Priority</label>
                <select id="taskUrgencyModal" value={taskUrgency} onChange={(e) => setTaskUrgency(e.target.value)}>
                  <option value="3">High</option>
                  <option value="2">Medium</option>
                  <option value="1">Low</option>
                </select>

                <label htmlFor="taskDueModal">Due date (optional)</label>
                <input id="taskDueModal" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />

                {taskErrorMessage ? <p className="status">{taskErrorMessage}</p> : null}

                <div className="date-dialog-actions">
                  <button className="mini-btn" onClick={closeTaskCreateModal}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveTask}>Add Task</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </SignedIn>
    </main>
  );
}
