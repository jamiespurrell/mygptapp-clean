'use client';

import { FormEvent, useEffect, useState } from 'react';

type Task = {
  id: string;
  title: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
};

export default function TasksTestPage() {
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadTasks() {
    setError(null);

    const response = await fetch('/api/tasks', { cache: 'no-store' });
    if (!response.ok) {
      setError('Failed to load tasks.');
      return;
    }

    const data = (await response.json()) as { tasks: Task[] };
    setTasks(data.tasks);
  }

  useEffect(() => {
    loadTasks().catch(() => setError('Failed to load tasks.'));
  }, []);

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!response.ok) {
        setError('Failed to add task.');
        return;
      }

      setTitle('');
      await loadTasks();
    } catch {
      setError('Failed to add task.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main style={{ margin: '2rem auto', maxWidth: 640, padding: '0 1rem' }}>
      <h1>Tasks API Test</h1>

      <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSaving}
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="submit" disabled={isSaving || !title.trim()}>
          {isSaving ? 'Adding...' : 'Add'}
        </button>
      </form>

      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            {task.title} <small>({new Date(task.createdAt).toLocaleString()})</small>
          </li>
        ))}
      </ul>
    </main>
  );
}
