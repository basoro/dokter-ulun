import * as React from 'react';
import { List, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { applyListFormatting, type NoteListType } from '@/lib/note-list';

export interface NoteListToolbarProps {
  /** Ref to the textarea whose value is being formatted. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Current (controlled) textarea value. */
  value: string;
  /** Called with the formatted value; selection is restored after the update. */
  onChange: (value: string) => void;
  /** Optional character cap; formatting is skipped when exceeded. */
  maxLength?: number;
  /** Called when formatting would exceed maxLength. */
  onLimitExceeded?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Adds bullet / numbered list formatting to a plain-text note textarea.
 * Each selected line is toggled between plain text and a list marker so the
 * list keeps rendering correctly through the app's `whitespace-pre-line` view.
 */
export function NoteListToolbar({
  textareaRef,
  value,
  onChange,
  maxLength,
  onLimitExceeded,
  disabled = false,
  className,
}: NoteListToolbarProps) {
  const [pendingSelection, setPendingSelection] = React.useState<{ start: number; end: number } | null>(null);

  React.useEffect(() => {
    if (!pendingSelection) {
      return;
    }

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(pendingSelection.start, pendingSelection.end);
    }
    setPendingSelection(null);
  }, [pendingSelection, textareaRef]);

  const applyList = (type: NoteListType) => {
    const textarea = textareaRef.current;
    const source = textarea?.value ?? value;
    const selectionStart = textarea?.selectionStart ?? source.length;
    const selectionEnd = textarea?.selectionEnd ?? source.length;

    const result = applyListFormatting(source, selectionStart, selectionEnd, type);
    if (!result) {
      return;
    }

    if (typeof maxLength === 'number' && result.value.length > maxLength) {
      onLimitExceeded?.();
      return;
    }

    setPendingSelection({ start: result.start, end: result.end });
    onChange(result.value);
  };

  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label="Format daftar catatan">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2"
        onClick={() => applyList('bullet')}
        disabled={disabled}
        title="Daftar berpoin"
        aria-label="Daftar berpoin"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2"
        onClick={() => applyList('number')}
        disabled={disabled}
        title="Daftar bernomor"
        aria-label="Daftar bernomor"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default NoteListToolbar;
