import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppContext } from './AppContext';
import { apiClient } from '../services/api';

// GET /stats/summary (backend core/stats.py), fetched once for the page and
// again whenever an application changes: the Quest card reads its game block,
// and every <Explain> reads its glossary (backend core/glossary.py). Absent in
// the mentor view, which has no session for it.
export interface GlossaryEntry { title: string; formula: string[]; here: string[]; vars: string[] }
export type Glossary = Record<string, GlossaryEntry>;

interface SummaryState { summary: any | null; glossary: Glossary }

export const SummaryContext = createContext<SummaryState>({ summary: null, glossary: {} });

export const SummaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { applications, user, isMentorView, isAuthenticated } = useAppContext();
  const [summary, setSummary] = useState<any | null>(null);
  const stamp = applications.reduce((m: string, a) => (a.updatedAt > m ? a.updatedAt : m), '');

  useEffect(() => {
    if (isMentorView || isAuthenticated === false) { setSummary(null); return; }
    apiClient.get('/stats/summary').then(r => setSummary(r.data)).catch(() => setSummary(null));
  }, [stamp, applications.length, user?.points, isMentorView, isAuthenticated]);

  return <SummaryContext.Provider value={{ summary, glossary: summary?.glossary ?? {} }}>{children}</SummaryContext.Provider>;
};

export const useSummary = () => useContext(SummaryContext);
