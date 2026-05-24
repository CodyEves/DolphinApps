export function formatPartNumber(letter: string, sequenceNumber: number) {
  return `${letter.toUpperCase()}-${String(sequenceNumber).padStart(3, "0")}`;
}
