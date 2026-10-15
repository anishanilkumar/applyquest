import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { User, JobApplication, NetworkContact, DailyGoal, Interview } from '../types';
import { userService, applicationService, networkService, shareService, interviewService } from '../services/api';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  applications: JobApplication[];
  setApplications: React.Dispatch<React.SetStateAction<JobApplication[]>>;
  contacts: NetworkContact[];
  setContacts: React.Dispatch<React.SetStateAction<NetworkContact[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  dailyGoals: DailyGoal[];
  setDailyGoals: (goals: DailyGoal[]) => void;
  loading: boolean;
  isAuthenticated: boolean;
  isMentorView: boolean;
  login: (token: string) => Promise<void>;
  mentorLogin: (password: string) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [contacts, setContacts] = useState<NetworkContact[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('token'));
  const [isMentorView, setIsMentorView] = useState<boolean>(false);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setIsMentorView(false);
    setUser(null);
    setApplications([]);
    setContacts([]);
    setInterviews([]);
  }, []);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [userData, appsData, contactsData, interviewsData] = await Promise.all([
        userService.getCurrentUser(),
        applicationService.getAll(),
        networkService.getAll(),
        interviewService.getAll(),
      ]);
      setUser(userData);
      setApplications(appsData);
      setContacts(contactsData);
      setInterviews(interviewsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      if (localStorage.getItem('token')) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  const login = async (token: string) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    await fetchData();
  };

  const mentorLogin = async (password: string) => {
    setLoading(true);
    try {
      const data = await shareService.getData(password);
      setUser(data.user);
      setApplications(data.applications);
      setContacts(data.contacts);
      setInterviews(data.interviews);
      setIsMentorView(true);
      setIsAuthenticated(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchData]);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        applications,
        setApplications,
        contacts,
        setContacts,
        interviews,
        setInterviews,
        dailyGoals,
        setDailyGoals,
        loading,
        isAuthenticated,
        isMentorView,
        login,
        mentorLogin,
        logout,
        refreshData: fetchData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};