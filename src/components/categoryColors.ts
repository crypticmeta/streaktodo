import { palette } from '../theme';

// Pre-curated palette of category colors. Used by both the create-category
// dialog (composer) and the manage-categories edit dialog. Keeping the list
// short on purpose — V0 doesn't need a full color picker.
export const CATEGORY_COLORS: ReadonlyArray<string> = [
  palette.evergreen[400],
  palette.amber[500],
  palette.crimson[500],
  palette.evergreen[700],
  '#5b6c89',
  '#7a4c8a',
  '#2f7d4d',
  '#c1592b',
];

export const CATEGORY_NAME_MAX_LENGTH = 28;
