/**
 * @stra/core - Priority Scheduler
 * 
 * 微任务 + 优先级队列调度器
 * 高优先级任务先执行，同优先级按 FIFO
 */

export type SchedulerPriority = 'critical' | 'high' | 'normal' | 'low' | 'idle';

export interface ScheduledTask {
  id: string;
  priority: SchedulerPriority;
  execute: () => void | Promise<void>;
  cancelled: boolean;
  createdAt: number;
}

export interface PriorityScheduler {
  schedule(priority: SchedulerPriority, task: () => void | Promise<void>): string;
  cancel(taskId: string): void;
  flush(): Promise<void>;
  flushByPriority(priority: SchedulerPriority): Promise<void>;
  pending(): number;
  pendingByPriority(): Record<SchedulerPriority, number>;
  isRunning(): boolean;
}

const PRIORITY_ORDER: Record<SchedulerPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  idle: 4,
};

let taskIdCounter = 0;

export function createPriorityScheduler(): PriorityScheduler {
  const queues = new Map<SchedulerPriority, ScheduledTask[]>();
  let running = false;

  for (const priority of Object.keys(PRIORITY_ORDER) as SchedulerPriority[]) {
    queues.set(priority, []);
  }

  function getNextTask(): ScheduledTask | null {
    for (const priority of Object.keys(PRIORITY_ORDER) as SchedulerPriority[]) {
      const queue = queues.get(priority)!;
      while (queue.length > 0) {
        const task = queue.shift()!;
        if (!task.cancelled) {
          return task;
        }
      }
    }
    return null;
  }

  return {
    schedule(priority: SchedulerPriority, task: () => void | Promise<void>): string {
      const id = `task_${++taskIdCounter}`;
      const scheduledTask: ScheduledTask = {
        id,
        priority,
        execute: task,
        cancelled: false,
        createdAt: Date.now(),
      };
      queues.get(priority)!.push(scheduledTask);
      return id;
    },

    cancel(taskId: string): void {
      for (const queue of queues.values()) {
        const task = queue.find((t) => t.id === taskId);
        if (task) {
          task.cancelled = true;
          break;
        }
      }
    },

    async flush(): Promise<void> {
      if (running) return;
      running = true;
      try {
        let task = getNextTask();
        while (task) {
          if (!task.cancelled) {
            await task.execute();
          }
          task = getNextTask();
        }
      } finally {
        running = false;
      }
    },

    async flushByPriority(priority: SchedulerPriority): Promise<void> {
      const queue = queues.get(priority)!;
      while (queue.length > 0) {
        const task = queue.shift()!;
        if (!task.cancelled) {
          await task.execute();
        }
      }
    },

    pending(): number {
      let count = 0;
      for (const queue of queues.values()) {
        count += queue.filter((t) => !t.cancelled).length;
      }
      return count;
    },

    pendingByPriority(): Record<SchedulerPriority, number> {
      const result = {} as Record<SchedulerPriority, number>;
      for (const [priority, queue] of queues.entries()) {
        result[priority] = queue.filter((t) => !t.cancelled).length;
      }
      return result;
    },

    isRunning(): boolean {
      return running;
    },
  };
}
