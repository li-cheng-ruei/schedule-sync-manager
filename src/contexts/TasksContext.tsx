
import React, { createContext, useState, useContext, useEffect } from "react";
import { Task } from "../types";
import { useAuth } from "./AuthContext";
import { addDays, isBefore, addHours, addMinutes } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

interface TasksContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, "id" | "createdBy" | "status" | "registeredEmployees" | "duration"> & {
    duration?: { hours: number; minutes: number }
  }) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  registerForTask: (taskId: string) => void;
  unregisterFromTask: (taskId: string) => void;
  getUserTasks: () => Task[];
  getPendingTasks: () => Task[];
  getAssignedTasks: () => Task[];
  getCompletedTasks: () => Task[];
  getTasksByDate: (date: Date) => Task[];
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export const useTasks = () => {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error("useTasks 必須在 TasksProvider 內部使用");
  }
  return context;
};

// Sample tasks for development
const initialTasks: Task[] = [
  {
    id: "1",
    title: "項目演示",
    description: "向團隊展示季度項目結果",
    startDate: addDays(new Date(), 2),
    endDate: addDays(new Date(), 2),
    duration: { hours: 1, minutes: 30 },
    registrationDeadline: addDays(new Date(), 1),
    createdBy: "1",
    status: "pending",
    registeredEmployees: ["2"]
  },
  {
    id: "2",
    title: "客戶會議",
    description: "與客戶討論新需求",
    startDate: addDays(new Date(), -1),
    endDate: addDays(new Date(), -1),
    duration: { hours: 2, minutes: 0 },
    registrationDeadline: addDays(new Date(), -2),
    createdBy: "1",
    status: "completed",
    assignedTo: "3",
    registeredEmployees: ["2", "3"]
  },
  {
    id: "3",
    title: "團隊建設",
    description: "月度團隊建設活動",
    startDate: addDays(new Date(), 5),
    endDate: addDays(new Date(), 5),
    duration: { hours: 3, minutes: 0 },
    registrationDeadline: addDays(new Date(), 3),
    createdBy: "1",
    status: "pending",
    registeredEmployees: []
  }
];

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // In a real app, we'd fetch tasks from an API
    // For demo purposes, use our initial tasks
    const savedTasks = localStorage.getItem("tasks");
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks).map((task: any) => ({
          ...task,
          startDate: new Date(task.startDate),
          endDate: new Date(task.endDate),
          registrationDeadline: new Date(task.registrationDeadline)
        }));
        setTasks(parsedTasks);
      } catch (error) {
        console.error("解析保存的任務時出錯:", error);
        setTasks(initialTasks);
        localStorage.setItem("tasks", JSON.stringify(initialTasks));
      }
    } else {
      setTasks(initialTasks);
      localStorage.setItem("tasks", JSON.stringify(initialTasks));
    }
  }, []);

  useEffect(() => {
    // Check for tasks with passed registration deadlines and no assigned employee
    const now = new Date();
    
    tasks.forEach(task => {
      if (task.status === "pending" && 
          task.registeredEmployees.length > 0 && 
          isBefore(task.registrationDeadline, now) && 
          !task.assignedTo) {
        // Randomly assign an employee
        const randomIndex = Math.floor(Math.random() * task.registeredEmployees.length);
        const assignedEmployeeId = task.registeredEmployees[randomIndex];
        
        updateTask(task.id, { 
          status: "assigned",
          assignedTo: assignedEmployeeId
        });
        
        toast({
          title: "任務已分配",
          description: `任務 "${task.title}" 已自動分配給一名隨機員工。`,
          duration: 5000,
        });
      }
    });
  }, [tasks]);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }
  }, [tasks]);

  const addTask = (taskData: Omit<Task, "id" | "createdBy" | "status" | "registeredEmployees" | "duration"> & {
    duration?: { hours: number; minutes: number }
  }) => {
    if (!user) return;
    
    let endDate = taskData.endDate;
    const duration = taskData.duration || { hours: 1, minutes: 0 };
    
    // If endDate is not provided, calculate it from startDate and duration
    if (taskData.duration) {
      endDate = addMinutes(addHours(taskData.startDate, duration.hours), duration.minutes);
    }
    
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      createdBy: user.id,
      status: "pending",
      registeredEmployees: [],
      duration: duration,
      endDate: endDate
    };

    setTasks(prev => [...prev, newTask]);
    
    toast({
      title: "任務已創建",
      description: `任務 "${newTask.title}" 已成功創建。`,
      duration: 3000,
    });
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    
    toast({
      title: "任務已刪除",
      description: "任務已成功刪除。",
      duration: 3000,
    });
  };

  const registerForTask = (taskId: string) => {
    if (!user) return;
    
    setTasks(prev => prev.map(task => {
      if (task.id === taskId && !task.registeredEmployees.includes(user.id)) {
        return {
          ...task,
          registeredEmployees: [...task.registeredEmployees, user.id]
        };
      }
      return task;
    }));
    
    toast({
      title: "報名成功",
      description: "您已成功報名此任務。",
      duration: 3000,
    });
  };

  const unregisterFromTask = (taskId: string) => {
    if (!user) return;
    
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          registeredEmployees: task.registeredEmployees.filter(id => id !== user.id)
        };
      }
      return task;
    }));
    
    toast({
      title: "取消報名",
      description: "您已成功取消報名此任務。",
      duration: 3000,
    });
  };

  const getUserTasks = () => {
    if (!user) return [];
    
    if (user.role === "manager") {
      return tasks.filter(task => task.createdBy === user.id);
    } else {
      return tasks.filter(task => 
        task.assignedTo === user.id || 
        task.registeredEmployees.includes(user.id)
      );
    }
  };

  const getPendingTasks = () => {
    return tasks.filter(task => task.status === "pending");
  };

  const getAssignedTasks = () => {
    return tasks.filter(task => task.status === "assigned");
  };

  const getCompletedTasks = () => {
    return tasks.filter(task => task.status === "completed");
  };

  const getTasksByDate = (date: Date) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return tasks.filter(task => {
      const taskDate = new Date(task.startDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() === targetDate.getTime();
    });
  };

  return (
    <TasksContext.Provider value={{
      tasks,
      addTask,
      updateTask,
      deleteTask,
      registerForTask,
      unregisterFromTask,
      getUserTasks,
      getPendingTasks,
      getAssignedTasks,
      getCompletedTasks,
      getTasksByDate
    }}>
      {children}
    </TasksContext.Provider>
  );
};
