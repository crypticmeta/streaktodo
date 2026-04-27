// Primitives — TaskRow, Pill, Fab, Checkbox, Star, Icon
// Tiny SVG icons inline so the kit doesn't depend on a CDN at runtime.

const Icon = ({ name, size = 18, color = 'currentColor' }) => {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>,
    list: <><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1.2" fill={color} /><circle cx="4" cy="12" r="1.2" fill={color} /><circle cx="4" cy="18" r="1.2" fill={color} /></>,
    clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /></>,
    arrowUp: <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="6 11 12 5 18 11" /></>,
    bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    bellFilled: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16zM10 20a2 2 0 0 0 4 0" fill={color} stroke="none" />,
    repeat: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
    star: <polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9" />,
    starFilled: <polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9" fill={color} stroke="none" />,
    check: <polyline points="4 12 10 18 20 6" />,
    close: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
    trash: <><polyline points="4 7 20 7" /><path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>,
    person: <><circle cx="12" cy="9" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></>,
    checkCircle: <><circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" /></>,
    time: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

const Checkbox = ({ done, onClick, size = 22 }) => (
  <button onClick={onClick} className="st-press" style={{
    width: size, height: size, borderRadius: size/2,
    border: `1.75px solid ${done ? '#ffffff' : 'var(--color-border-strong)'}`,
    background: done ? 'var(--color-accent)' : 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  }}>
    {done ? <Icon name="check" size={14} color="var(--color-text-on-accent)" /> : null}
  </button>
);

const Star = ({ on, onClick }) => (
  <button onClick={onClick} className="st-press" style={{ padding: '2px 4px', marginTop: -2, color: on ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
    <Icon name={on ? 'starFilled' : 'star'} size={20} />
  </button>
);

const Pill = ({ label, selected, onClick }) => (
  <button onClick={onClick} className="st-press" style={{
    background: selected ? 'var(--color-accent)' : 'var(--color-surface-muted)',
    color: selected ? 'var(--color-text-on-accent)' : 'var(--color-text-primary)',
    fontWeight: selected ? 700 : 600,
    fontSize: 13, padding: '10px 16px', borderRadius: 999, whiteSpace: 'nowrap',
  }}>{label}</button>
);

const Fab = ({ onClick, glyph = '+', label = 'New task' }) => (
  <div style={{ position: 'absolute', right: 12, bottom: 92, padding: 8, borderRadius: '50%', background: 'var(--color-accent-soft)', opacity: 0.55, zIndex: 10 }}>
    <button onClick={onClick} aria-label={label} className="st-press" style={{
      width: 60, height: 60, borderRadius: 30,
      background: 'var(--color-accent)', color: 'var(--color-text-on-accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28, fontWeight: 400, lineHeight: 1,
      boxShadow: '0 12px 20px rgba(31,35,40,0.30)',
      opacity: 1 / 0.55, // restore (parent halo wrap dims)
    }}>{glyph}</button>
  </div>
);

const TaskRow = ({ task, onToggle, onPin, onTap }) => {
  const isDone = task.status === 'done';
  return (
    <div style={{
      background: task.pinned ? 'var(--color-accent-soft)' : 'var(--color-surface-muted)',
      borderRadius: 14, padding: 14, marginBottom: 8,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <Checkbox done={isDone} onClick={() => onToggle?.(task.id)} />
      <button onClick={() => onTap?.(task.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{
          fontSize: 15, fontWeight: 500, lineHeight: 1.35, color: 'var(--color-text-primary)',
          textDecoration: isDone ? 'line-through' : 'none',
          opacity: isDone ? 0.55 : 1,
        }}>{task.title}</div>
        {(task.dateText || task.category || task.subtaskCounts || task.hasReminder || task.hasRepeat) && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginTop: 4, gap: 4 }}>
            {task.category && <div style={{ width: 8, height: 8, borderRadius: 4, background: task.category.color, marginRight: 2 }} />}
            {task.dateText && (
              <span style={{
                fontSize: 11,
                color: task.overdue ? 'var(--color-danger)' : 'var(--color-text-muted)',
                fontWeight: task.overdue ? 600 : 400,
              }}>{task.dateText}{task.timeText ? ` · ${task.timeText}` : ''}</span>
            )}
            {task.hasReminder && <span style={{ marginLeft: 6, color: 'var(--color-text-muted)', display: 'inline-flex' }}><Icon name="bellFilled" size={11} /></span>}
            {task.hasRepeat && <span style={{ marginLeft: 4, color: 'var(--color-text-muted)', display: 'inline-flex' }}><Icon name="repeat" size={11} /></span>}
            {task.category && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>· {task.category.name}</span>}
            {task.subtaskCounts && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>· {task.subtaskCounts.done}/{task.subtaskCounts.total} subtasks</span>}
          </div>
        )}
      </button>
      <Star on={task.pinned} onClick={() => onPin?.(task.id)} />
    </div>
  );
};

Object.assign(window, { Icon, Checkbox, Star, Pill, Fab, TaskRow });
