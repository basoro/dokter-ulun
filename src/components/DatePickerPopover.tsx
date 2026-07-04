import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar, type CalendarProps } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const hasValue = Boolean(displayValue);
  const effectiveNumberOfMonths = isMobile && calendarProps.mode === "range"
    ? 1
    : Number(calendarProps.numberOfMonths || 1);
  const isRangeCalendar = calendarProps.mode === "range" && effectiveNumberOfMonths > 1;

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
            ? "max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-auto p-0 sm:max-h-none sm:w-auto sm:max-w-[calc(100vw-2rem)] sm:overflow-x-auto sm:overflow-y-visible"
            : "max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-auto p-0 sm:max-h-none sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:overflow-visible",
          popoverContentClassName
        )}
        align={isMobile ? "center" : align}
        collisionPadding={8}
      >
        <Calendar
          initialFocus={initialFocus}
          {...calendarProps}
          numberOfMonths={effectiveNumberOfMonths}
          className={cn(
            "pointer-events-auto",
            isRangeCalendar && "sm:min-w-[640px]",
            calendarClassName,
            isMobile && "!min-w-0 w-full"
          )}
        />
        {contentAfterCalendar}
      </PopoverContent>
    </Popover>
  );
};
