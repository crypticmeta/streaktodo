// ProfileScreen — streak counter (the honest one) + settings rows
function ProfileScreen() {
  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>signed in</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2, letterSpacing: -0.4 }}>alex chen</div>
      </div>

      {/* Streak hero */}
      <div style={{ margin: '0 16px', background: 'var(--color-surface)', borderRadius: 22, padding: 20, border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>current streak</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 42, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums' }}>12</span>
          <span style={{ fontSize: 17, color: 'var(--color-text-secondary)', fontWeight: 500 }}>days</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
          You missed 2 days last month. We don't pretend you didn't.
        </div>
        {/* dot calendar */}
        <div style={{ display: 'flex', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
          {Array.from({ length: 28 }).map((_, i) => {
            const broken = i === 9 || i === 14;
            return <div key={i} style={{
              width: 10, height: 10, borderRadius: 5,
              background: broken ? 'var(--color-danger-soft)' : i < 24 ? 'var(--color-accent)' : 'var(--color-surface-muted)',
            }} />;
          })}
        </div>
      </div>

      {/* Settings rows */}
      <div style={{ marginTop: 24, padding: '0 4px' }}>
        {[
          { icon: 'bell', label: 'Notifications', value: 'On' },
          { icon: 'calendar', label: 'Default schedule', value: '09:00 am' },
          { icon: 'clipboard', label: 'Templates', value: '👑' },
          { icon: 'person', label: 'Sign out', value: '' },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 20px',
          }}>
            <div style={{ color: 'var(--color-text-secondary)' }}><Icon name={r.icon} size={20} /></div>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{r.label}</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ProfileScreen = ProfileScreen;
