// CalendarScreen — month grid with task markers; selected day shows its tasks
function CalendarScreen({ tasks }) {
  const today = new Date();
  const [picked, setPicked] = useState(today.getDate());
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = today.toLocaleString(undefined, { month: 'long', year: 'numeric' }).toLowerCase();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);
  const marked = new Set([today.getDate(), today.getDate() + 1, today.getDate() + 5]);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>this month</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2, letterSpacing: -0.4 }}>{monthLabel}</div>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 22, padding: '18px 16px', margin: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 12px' }}>
          <button style={{ width: 32, height: 32, color: 'var(--color-text-secondary)', fontSize: 18 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {today.toLocaleString(undefined, { month: 'short' })} {year}
          </span>
          <button style={{ width: 32, height: 32, color: 'var(--color-text-secondary)', fontSize: 18 }}>›</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(w => (
            <div key={w} style={{ width: 40, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {cells.map((d, i) => {
            const isToday = d === today.getDate();
            const isSel = d === picked;
            const isMarked = d && marked.has(d);
            return (
              <button key={i} disabled={!d} onClick={() => d && setPicked(d)} style={{
                width: 40, height: 40, borderRadius: 20, marginBottom: 2, position: 'relative',
                background: isSel ? 'var(--color-accent)' : 'transparent',
                color: !d ? 'transparent' : isSel ? 'var(--color-text-on-accent)' : isToday ? 'var(--color-accent)' : 'var(--color-text-primary)',
                fontSize: 15, fontWeight: (isToday || isSel) ? 600 : 400,
              }}>
                {d || '·'}
                {isMarked && <span style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 2, background: isSel ? 'var(--color-text-on-accent)' : 'var(--color-accent)' }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
          {picked === today.getDate() ? 'today' : `${monthLabel.split(' ')[0]} ${picked}`}
        </div>
        {tasks.filter(t => t.status === 'pending').slice(0, 2).map(t => (
          <TaskRow key={t.id} task={t} onToggle={() => {}} onPin={() => {}} />
        ))}
      </div>
    </div>
  );
}

window.CalendarScreen = CalendarScreen;
