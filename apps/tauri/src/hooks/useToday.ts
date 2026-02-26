import { useEffect, useState } from 'react';
import { todayDate } from '../lib/api-client';

/**
 * Returns the current date as a YYYY-MM-DD string.
 * Updates automatically when the day changes (checked every minute).
 */
export function useToday(): string {
  const [today, setToday] = useState<string>(() => todayDate());

  useEffect(() => {
    // Check every minute if the date has changed
    const interval = setInterval(() => {
      const newToday = todayDate();
      if (newToday !== today) {
        setToday(newToday);
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [today]);

  return today;
}
