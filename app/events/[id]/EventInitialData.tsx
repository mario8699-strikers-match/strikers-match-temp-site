'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Event } from '@/types';

const EventInitialDataContext = createContext<Event | null>(null);

export function EventInitialDataProvider({
  event,
  children,
}: {
  event: Event;
  children: ReactNode;
}) {
  return (
    <EventInitialDataContext.Provider value={event}>
      {children}
    </EventInitialDataContext.Provider>
  );
}

export function useEventInitialData() {
  return useContext(EventInitialDataContext);
}
