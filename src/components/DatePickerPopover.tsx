import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar, type CalendarProps } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerPopoverProps {
  mode?: CalendarProps["mode"];
  selected?: CalendarProps["selected"];
  onSelect?: CalendarProps["onSelect"];
  defaultMonth?: CalendarProps["defaultMonth"];
  numberOfMonths?: CalendarProps["numberOfMonths"];
  locale?: CalendarProps["locale"];
  disabled?: CalendarProps["disabled"];
  required?: CalendarProps["required"];
  fromDate?: CalendarProps["fromDate"];
  toDate?: CalendarProps["toDate"];
  displayValue?: React.ReactNode;
  placeholder?: React.ReactNode;
  buttonClassName?: string;
  popoverContentClassName?: string;
  calendarClassName?: string;
  triggerId?: string;
  align?: "start" | "center" | "end";
  contentAfterCalendar?: React.ReactNode;
}

export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  displayValue,
  placeholder = "Pilih tanggal",
  buttonClassName,
  popoverContentClassName,
  calendarClassName,
  triggerId,
  align = "start",
  contentAfterCalendar,
  initialFocus = true,
  ...calendarProps
}) => {
  const hasValue = Boolean(displayValue);
  const isRangeCalendar = calendarProps.mode === "range" && Number(calendarProps.numberOfMonths || 1) > 1;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !hasValue && "text-muted-foreground",
            buttonClassName
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {hasValue ? displayValue : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          isRangeCalendar
            ? "w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
            : "w-96 p-0",
          popoverContentClassName
        )}
        align={align}
      >
        <Calendar
          initialFocus={initialFocus}
          className={cn(
            "pointer-events-auto",
            isRangeCalendar && "min-w-[640px]",
            calendarClassName
          )}
          {...calendarProps}
        />
        {contentAfterCalendar}
      </PopoverContent>
    </Popover>
  );
};
