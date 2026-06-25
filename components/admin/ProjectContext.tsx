"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "ama_admin_project";

type ProjectContextValue = {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
};

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined
);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectIdState] = useState<string | null>(null);

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setProjectIdState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setProjectId = (id: string | null) => {
    setProjectIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useSelectedProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error(
      "useSelectedProject must be used within a <ProjectProvider>"
    );
  }
  return ctx;
}
