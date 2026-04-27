// TasksScreen — main list with section headers + category pills
const SAMPLE_TASKS = [
  { id: 't1', title: 'Plan content for next week', status: 'pending', pinned: false, dateText: 'today', timeText: '09:00 am', category: { name: 'Work', color: '#3f7e69' }, hasReminder: true },
  { id: 't2', title: 'Renew passport before December', status: 'pending', pinned: true, dateText: 'in 5 days', category: { name: 'Errands', color: '#d44a4a' } },
  { id: 't3', title: 'Submit invoice to client', status: 'pending', pinned: false, dateText: '2 days overdue', overdue: true, category: { name: 'Work', color: '#3f7e69' } },
  { id: 't4', title: 'Read 30 pages of new book', status: 'pending', pinned: false, dateText: 'tomorrow', category: { name: 'Personal', color: '#b58a3d' }, hasRepeat: true, subtaskCounts: { done: 0, total: 3 } },
  { id: 't5', title: 'Morning pages', status: 'done', pinned: false, dateText: 'today', timeText: '06:00 am', category: { name: 'Personal', color: '#b58a3d' } },
  { id: 't6', title: 'Buy birthday gift for mom', status: 'done', pinned: false, dateText: 'yesterday', category: { name: 'Personal', color: '#b58a3d' } },
];

function TasksScreen({ tasks, setTasks, onComposerOpen, onTaskTap }) {
  const [cat, setCat] = useState(null);
  const cats = [
    { id: 'work', name: 'Work' }, { id: 'personal', name: 'Personal' },
    { id: 'errands', name: 'Errands' }, { id: 'reading', name: 'Reading' },
  ];

  const filtered = cat ? tasks.filter(t => t.category?.name.toLowerCase() === cat) : tasks;
  const today = filtered.filter(t => t.status === 'pending' && (t.dateText === 'today' || t.overdue));
  const upcoming = filtered.filter(t => t.status === 'pending' && t.dateText !== 'today' && !t.overdue);
  const previous = filtered.filter(t => t.status === 'done');

  const toggle = id => setTasks(p => p.map(t => t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t));
  const pin = id => setTasks(p => p.map(t => t.id === id ? { ...t, pinned: !t.pinned } : t));

  const Section = ({ title, items }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 10px 4px' }}>{title}</div>
      {items.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0)).map(t => (
        <TaskRow key={t.id} task={t} onToggle={toggle} onPin={pin} onTap={onTaskTap} />
      ))}
    </div>
  );

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2, letterSpacing: -0.4 }}>
          tasks
        </div>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, padding: '4px 20px 16px', overflowX: 'auto' }}>
        <Pill label="All" selected={cat === null} onClick={() => setCat(null)} />
        {cats.map(c => <Pill key={c.id} label={c.name} selected={cat === c.id} onClick={() => setCat(c.id)} />)}
      </div>

      <div className="st-screen">
        <Section title="Today" items={today} />
        <Section title="Upcoming" items={upcoming} />
        <Section title="Previous" items={previous} />
      </div>

      <Fab onClick={onComposerOpen} />
    </div>
  );
}

window.TasksScreen = TasksScreen;
