// SchedulePicker — centered card with calendar + shortcuts + rows
const SHORTCUTS = [
  { key: 'today', label: 'Today', day: new Date().getDate(), month: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][new Date().getMonth()] },
  { key: 'tomorrow', label: 'Tomorrow', day: new Date(Date.now()+86400000).getDate(), month: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][new Date(Date.now()+86400000).getMonth()] },
  { key: '3-days', label: '3 Days Later' },
  { key: 'sunday', label: 'This Sunday' },
  { key: 'no-date', label: 'No Date' },
];

function CalendarMini({ selectedDay, onPick }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][month] + ' ' + year;
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 12px' }}>
        <button style={{ width: 32, height: 32, color: 'var(--color-text-secondary)', fontSize: 17 }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.4 }}>{monthLabel}</span>
        <button style={{ width: 32, height: 32, color: 'var(--color-text-secondary)', fontSize: 17 }}>›</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
        {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(w => (
          <div key={w} style={{ width: 36, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {cells.map((d, i) => {
          const isToday = d === today.getDate();
          const isSel = d === selectedDay;
          return (
            <button key={i} disabled={!d} onClick={() => d && onPick(d)} style={{
              width: 36, height: 36, borderRadius: 18, marginBottom: 2,
              background: isSel ? 'var(--color-accent)' : 'transparent',
              color: !d ? 'transparent' : isSel ? 'var(--color-text-on-accent)' : isToday ? 'var(--color-accent)' : 'var(--color-text-primary)',
              fontSize: 15, fontWeight: (isToday || isSel) ? 600 : 400,
            }}>{d || '·'}</button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleRow({ icon, label, value, dimmed, disabled }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
      borderTop: '1px solid var(--color-border-muted)', opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, color: dimmed ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>{value}</div>
    </div>
  );
}

function SchedulePicker({ initial, onCancel, onConfirm }) {
  const [picked, setPicked] = useState(initial?.day || null);
  const [shortcut, setShortcut] = useState(null);
  return (
    <>
      <div onClick={onCancel} style={{
        position: 'absolute', inset: 0, background: 'var(--color-scrim)', zIndex: 80,
      }} />
      <div style={{
        position: 'absolute', inset: 16, top: 60, bottom: 60, zIndex: 90,
        background: 'var(--color-surface-raised)', borderRadius: 22, border: '1px solid var(--color-border)',
        padding: '20px 24px 12px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 20px rgba(111,78,55,.18)', overflow: 'auto',
      }}>
        <CalendarMini selectedDay={picked} onPick={d => { setPicked(d); setShortcut(null); }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {SHORTCUTS.map(s => {
            const sel = shortcut === s.key;
            return (
              <button key={s.key} onClick={() => { setShortcut(s.key); if (s.day) setPicked(s.day); else if (s.key === 'no-date') setPicked(null); }} style={{
                background: sel ? 'var(--color-accent)' : 'var(--color-surface)',
                border: `1px solid ${sel ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: 14, padding: '8px 14px',
                fontSize: 13, fontWeight: 600,
                color: sel ? 'var(--color-text-on-accent)' : 'var(--color-text-primary)',
              }}>{s.label}</button>
            );
          })}
        </div>
        <ScheduleRow icon="time" label="Time" value="No" dimmed disabled={!picked} />
        <ScheduleRow icon="bell" label="Reminder" value="No" dimmed disabled={!picked} />
        <ScheduleRow icon="repeat" label="Repeat" value="No" dimmed disabled={!picked} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, paddingTop: 12, marginTop: 8, borderTop: '1px solid var(--color-border-muted)' }}>
          <button onClick={onCancel} style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: 0.4 }}>CANCEL</button>
          <button onClick={() => {
            if (!picked) return onConfirm(null);
            const m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][new Date().getMonth()];
            onConfirm({ day: picked, month: m });
          }} style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: 0.4 }}>DONE</button>
        </div>
      </div>
    </>
  );
}

window.SchedulePicker = SchedulePicker;
