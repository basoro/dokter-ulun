import type React from 'react';

export type NoteListType = 'bullet' | 'number';

export const BULLET_MARKER = '• ';
export const BULLET_PATTERN = /^(\s*)•\s+/;
export const NUMBER_PATTERN = /^(\s*)\d+\.\s+/;
const NUMBER_CAPTURE_PATTERN = /^(\s*)(\d+)\.\s+/;

export const stripListMarker = (line: string) =>
  line.replace(BULLET_PATTERN, '$1').replace(NUMBER_PATTERN, '$1');

export const hasListMarker = (line: string, type: NoteListType) =>
  type === 'number' ? NUMBER_PATTERN.test(line) : BULLET_PATTERN.test(line);

export const getLeadingWhitespace = (line: string) => line.match(/^\s*/)?.[0] ?? '';

export interface ListFormatResult {
  value: string;
  start: number;
  end: number;
}

/**
 * Toggles a bullet / numbered marker on every line covered by the selection.
 * Returns null when nothing would change.
 */
export const applyListFormatting = (
  source: string,
  selectionStart: number,
  selectionEnd: number,
  type: NoteListType
): ListFormatResult | null => {
  const lineStart = source.lastIndexOf('\n', Math.max(selectionStart - 1, 0)) + 1;
  const nextNewline = source.indexOf('\n', selectionEnd);
  const lineEnd = nextNewline === -1 ? source.length : nextNewline;
  const lines = source.slice(lineStart, lineEnd).split('\n');

  const filledLines = lines.filter((line) => line.trim() !== '');
  const allMarked = filledLines.length > 0 && filledLines.every((line) => hasListMarker(line, type));

  let counter = 0;
  const nextLines = lines.map((line) => {
    const stripped = stripListMarker(line);
    if (allMarked || stripped.trim() === '') {
      return stripped;
    }

    counter += 1;
    const indent = getLeadingWhitespace(stripped);
    const content = stripped.slice(indent.length);
    const marker = type === 'number' ? `${counter}. ` : BULLET_MARKER;
    return `${indent}${marker}${content}`;
  });

  const nextBlock = nextLines.join('\n');
  const value = `${source.slice(0, lineStart)}${nextBlock}${source.slice(lineEnd)}`;

  if (value === source) {
    return null;
  }

  return { value, start: lineStart, end: lineStart + nextBlock.length };
};

export interface ListContinuation {
  value: string;
  caret: number;
}

/**
 * Builds the next list line when Enter is pressed inside a bullet / numbered
 * line. Returns null when the caret is not on a list line (so the default
 * newline behaviour is kept).
 */
export const buildListContinuation = (value: string, caret: number): ListContinuation | null => {
  const lineStart = value.lastIndexOf('\n', Math.max(caret - 1, 0)) + 1;
  const currentLine = value.slice(lineStart, caret);
  const bulletMatch = currentLine.match(BULLET_PATTERN);
  const numberMatch = currentLine.match(NUMBER_CAPTURE_PATTERN);
  const match = bulletMatch ?? numberMatch;

  if (!match) {
    return null;
  }

  const lineEndIndex = value.indexOf('\n', caret);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const contentBeforeCaret = currentLine.slice(match[0].length);
  const contentAfterCaret = value.slice(caret, lineEnd);

  // Pressing Enter on an empty list item ends the list instead of adding a new one.
  if (contentBeforeCaret.trim() === '' && contentAfterCaret.trim() === '') {
    const nextValue = `${value.slice(0, lineStart)}\n${value.slice(lineEnd)}`;
    if (nextValue === value) {
      return null;
    }
    return { value: nextValue, caret: lineStart + 1 };
  }

  const marker = bulletMatch ? BULLET_MARKER : `${Number.parseInt(numberMatch![2], 10) + 1}. `;
  const insertion = `\n${getLeadingWhitespace(match[0])}${marker}`;

  return {
    value: `${value.slice(0, caret)}${insertion}${value.slice(caret)}`,
    caret: caret + insertion.length,
  };
};

export interface NoteListKeyDownOptions {
  /** Optional character cap; continuation is skipped when exceeded. */
  maxLength?: number;
  /** Called when continuation would exceed maxLength. */
  onLimitExceeded?: () => void;
}

/**
 * `onKeyDown` handler for a note textarea that keeps bullet / numbered lists
 * going when Enter is pressed. Attach it to the same textarea the toolbar
 * formats. Modifier + Enter still inserts a plain newline.
 */
export const handleNoteListKeyDown = (
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  onChange: (value: string) => void,
  options: NoteListKeyDownOptions = {}
) => {
  if (
    event.key !== 'Enter' ||
    event.shiftKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.nativeEvent.isComposing
  ) {
    return;
  }

  const textarea = event.currentTarget;
  if (textarea.selectionStart !== textarea.selectionEnd) {
    return;
  }

  const result = buildListContinuation(textarea.value, textarea.selectionStart);
  if (!result) {
    return;
  }

  event.preventDefault();

  if (typeof options.maxLength === 'number' && result.value.length > options.maxLength) {
    options.onLimitExceeded?.();
    return;
  }

  onChange(result.value);

  // Restore the caret right after the newly inserted marker once React commits.
  requestAnimationFrame(() => {
    if (!textarea.isConnected) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(result.caret, result.caret);
  });
};
