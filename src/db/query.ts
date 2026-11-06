// Stay well below SQLite builds that retain the historical 999 bind-variable
// limit. Newer builds allow more, but using a conservative batch keeps the
// repository portable across older Android devices.
export function queryChunks<T>(values: ReadonlyArray<T>, size = 400): T[][] {
  const unique = [...new Set(values)];
  const chunks: T[][] = [];
  for (let index = 0; index < unique.length; index += size) {
    chunks.push(unique.slice(index, index + size));
  }
  return chunks;
}
