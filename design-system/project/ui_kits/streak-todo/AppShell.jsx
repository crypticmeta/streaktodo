// AppShell — bottom tab bar + screen switcher + composer mount
function AppShell() {
  const [tab, setTab] = useState('tasks');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tasks, setTasks] = useState(SAMPLE_TASKS);

  const handleSave = ({ title, subtasks, category, date }) => {
    if (editing) {
      setTasks(p => p.map(t => t.id === editing.id ? { ...t, title, category, dateText: date ? `${date.month.toLowerCase()} ${date.day}` : null } : t));
    } else {
      const newTask = {
        id: 't' + Date.now(), title, status: 'pending', pinned: false,
        category, dateText: date ? `${date.month.toLowerCase()} ${date.day}` : null,
        subtaskCounts: subtasks.length > 0 ? { done: 0, total: subtasks.length } : undefined,
      };
      setTasks(p => [newTask, ...p]);
    }
    setComposerOpen(false);
    setEditing(null);
  };

  const handleTap = id => {
    const t = tasks.find(x => x.id === id);
    setEditing({ id: t.id, title: t.title, category: t.category, subtasks: [] });
    setComposerOpen(true);
  };

  return (
    <div className="st-app">
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {tab === 'tasks' && <TasksScreen tasks={tasks} setTasks={setTasks} onComposerOpen={() => { setEditing(null); setComposerOpen(true); }} onTaskTap={handleTap} />}
        {tab === 'calendar' && <CalendarScreen tasks={tasks} />}
        {tab === 'profile' && <ProfileScreen />}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        display: 'flex', borderTop: '1px solid var(--color-border-muted)',
        background: 'var(--color-surface)', padding: '8px 8px 14px',
      }}>
        {[
          { id: 'tasks', icon: 'checkCircle', label: 'Tasks' },
          { id: 'calendar', icon: 'calendar', label: 'Calendar' },
          { id: 'profile', icon: 'person', label: 'Profile' },
        ].map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0',
              color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            }}>
              <Icon name={t.icon} size={22} />
              <div style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {composerOpen && (
        <Composer
          initial={editing}
          onClose={() => { setComposerOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

window.AppShell = AppShell;
