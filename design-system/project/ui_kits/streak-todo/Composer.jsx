// Composer — bottom sheet for create/edit
const { useState } = React;

function Composer({ onClose, onSave, initial }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [subtasks, setSubtasks] = useState(initial?.subtasks || []);
  const [category, setCategory] = useState(initial?.category || null);
  const [date, setDate] = useState(initial?.date || null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const canSave = title.trim().length > 0;

  return (
    <>
      <div className="st-scrim" onClick={onClose} />
      <div className="st-sheet">
        <div className="st-sheet-handle" />
        <div style={{ background: 'var(--color-surface-muted)', borderRadius: 14, padding: '12px 16px' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
            placeholder="Input new task here"
            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%',
              color: 'var(--color-text-primary)', fontSize: 17, fontWeight: 500, fontFamily: 'inherit' }} />
        </div>

        {subtasks.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, border: '1.5px solid var(--color-border-strong)' }} />
            <input value={s} onChange={e => setSubtasks(p => p.map((x,j) => j===i ? e.target.value : x))}
              placeholder="Input the sub-task"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                color: 'var(--color-text-primary)', fontSize: 15, fontFamily: 'inherit', padding: '6px 0' }} />
            <button onClick={() => setSubtasks(p => p.filter((_,j) => j!==i))} style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>×</button>
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPickerOpen(o => !o)} className="st-press" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: category ? 'var(--color-accent-soft)' : 'var(--color-surface-muted)',
            borderRadius: 999, padding: '8px 14px',
            color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600,
          }}>
            {category && <span style={{ width: 8, height: 8, borderRadius: 4, background: category.color }} />}
            {category ? category.name : 'No Category'}
          </button>

          <button onClick={() => setScheduleOpen(true)} className="st-press" style={{
            width: 38, height: 38, borderRadius: 10, background: date ? 'var(--color-accent-soft)' : 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)',
          }}>
            {date ? (
              <div style={{ textAlign: 'center', lineHeight: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-accent)' }}>{date.month}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{date.day}</div>
              </div>
            ) : <Icon name="calendar" size={20} />}
          </button>

          <button onClick={() => setSubtasks(p => [...p, ''])} className="st-press" style={{
            width: 38, height: 38, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)',
          }}><Icon name="list" size={20} /></button>

          <button className="st-press" style={{
            width: 38, height: 38, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', opacity: 0.45,
          }}><Icon name="clipboard" size={20} /></button>

          <div style={{ flex: 1 }} />

          <button disabled={!canSave} onClick={() => canSave && onSave({ title: title.trim(), subtasks: subtasks.filter(s => s.trim()), category, date })}
            className="st-press" style={{
              width: 48, height: 48, borderRadius: 24, background: 'var(--color-accent)',
              color: 'var(--color-text-on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              opacity: canSave ? 1 : 0.4, boxShadow: '0 8px 12px rgba(31,35,40,.18)',
            }}><Icon name="arrowUp" size={22} /></button>
        </div>

        {pickerOpen && (
          <div style={{
            position: 'absolute', left: 24, bottom: 110, zIndex: 70,
            background: 'var(--color-surface-raised)', borderRadius: 14, border: '1px solid var(--color-border)',
            minWidth: 220, boxShadow: '0 12px 20px rgba(111,78,55,.18)', overflow: 'hidden',
          }}>
            {[null, {name:'Work', color:'#3f7e69'}, {name:'Personal', color:'#b58a3d'}, {name:'Errands', color:'#d44a4a'}].map((c, i) => (
              <button key={i} onClick={() => { setCategory(c); setPickerOpen(false); }} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '14px 18px',
                fontSize: 15, color: 'var(--color-text-primary)', fontWeight: category?.name === c?.name ? 600 : 400,
              }}>{c ? c.name : 'No Category'}</button>
            ))}
            <button onClick={() => setPickerOpen(false)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '14px 18px',
              fontSize: 15, color: 'var(--color-accent)', fontWeight: 600,
            }}>+ Create New</button>
          </div>
        )}

        {scheduleOpen && (
          <SchedulePicker
            initial={date}
            onCancel={() => setScheduleOpen(false)}
            onConfirm={d => { setDate(d); setScheduleOpen(false); }}
          />
        )}
      </div>
    </>
  );
}

window.Composer = Composer;
