import { describe, expect, it } from 'vitest';
import { reliabilitySchemaSql } from '../002_reliability';

describe('reliability migration', () => {
  it('contains every column, repair, and idempotency constraint in the v2 contract', () => {
    expect(reliabilitySchemaSql).toContain('ALTER TABLE tasks ADD COLUMN due_date TEXT');
    expect(reliabilitySchemaSql).toContain('ALTER TABLE tasks ADD COLUMN series_id TEXT');
    expect(reliabilitySchemaSql).toContain('ALTER TABLE tasks ADD COLUMN parent_occurrence_id TEXT');
    expect(reliabilitySchemaSql).toContain('ALTER TABLE task_repeat_rules ADD COLUMN anchor_date TEXT');
    expect(reliabilitySchemaSql).toContain('ALTER TABLE task_reminders ADD COLUMN schedule_state TEXT');
    expect(reliabilitySchemaSql).toContain('UPDATE subtasks');
    expect(reliabilitySchemaSql).toContain('idx_tasks_active_parent_occurrence');
  });
});
