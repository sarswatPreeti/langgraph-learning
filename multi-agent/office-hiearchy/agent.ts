// agents.ts
export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  createdBy: string;
}

export type MessageType = "task_request" | "approval" | "status" | "note";

export interface Message {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  taskId?: string;
  payload?: any;
  timestamp?: number;
}

export interface Decision {
  approved: boolean;
  note?: string;
  decidedBy: string;
  timestamp?: number;
}

export interface AgentState {
  task?: Task;
  messages: Message[]; // global message bus
  approval?: Decision;
  next?: string; // which agent to run next
  // optional meta that you want LangGraph to carry between nodes
  meta?: Record<string, any>;
}

// -------------------- BASE AGENT --------------------
export abstract class Agent {
  name: string;
  // persistent memory for this agent instance (survives across node calls)
  memory: Map<string, any>;
  // simple log stored in memory under key "log"
  constructor(name: string) {
    this.name = name;
    this.memory = new Map();
    if (!this.memory.has("log")) this.memory.set("log", [] as string[]);
  }

  // helper: get icon for message type
  protected getIcon(type: MessageType): string {
    const icons: Record<MessageType, string> = {
      task_request: "📋",
      approval: "✅",
      status: "📊",
      note: "📝",
    };
    return icons[type] || "💬";
  }

  // helper: format agent name with padding for alignment
  protected formatName(name: string): string {
    return name.toUpperCase().padEnd(10);
  }

  // helper: push message to global bus and return modified state
  protected sendMessage(state: AgentState, msg: Omit<Message, "id" | "timestamp">): AgentState {
    const message: Message = {
      id: `${this.name}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: Date.now(),
      ...msg,
    };
    state.messages = state.messages.concat(message);
    // update router so graph will route to the recipient next
    state.next = msg.to;
    const icon = this.getIcon(msg.type);
    const detail = msg.type === "approval" 
      ? `(${msg.payload?.approved ? "APPROVED" : "REJECTED"}${msg.payload?.note ? " - " + msg.payload.note : ""})`
      : msg.type === "task_request" && msg.payload?.task
        ? `"${msg.payload.task.title}" [${msg.payload.task.priority}]`
        : "";
    this.log(state, `${icon} SEND → ${msg.to.toUpperCase()} | ${msg.type} ${detail}`);
    return state;
  }

  // helper: read messages addressed to this agent (not removed yet)
  protected inbox(state: AgentState): Message[] {
    return state.messages.filter((m) => m.to === this.name);
  }

  // helper: remove handled messages from the global bus
  protected removeMessages(state: AgentState, msgIds: string[]): void {
    state.messages = state.messages.filter((m) => !msgIds.includes(m.id));
  }

  // add to this agent's memory log and console
  protected log(state: AgentState, text: string) {
    const logArr: string[] = this.memory.get("log") || [];
    const name = this.formatName(this.name);
    const entry = `${name} │ ${text}`;
    logArr.push(entry);
    this.memory.set("log", logArr);
    console.log(entry);
  }

  // helper: log receiving a message with clean format
  protected logReceive(msg: Message) {
    const icon = this.getIcon(msg.type);
    const detail = msg.type === "approval"
      ? `(${msg.payload?.approved ? "APPROVED" : "REJECTED"}${msg.payload?.note ? " - " + msg.payload.note : ""})`
      : msg.type === "task_request" && msg.payload?.task
        ? `"${msg.payload.task.title}"`
        : "";
    console.log(`${this.formatName(this.name)} │ ${icon} RECV ← ${msg.from.toUpperCase()} | ${msg.type} ${detail}`);
  }

  // agents implement this to process state & return (possibly) updated state
  abstract handle(state: AgentState): Promise<AgentState>;
}

// -------------------- EMPLOYEE --------------------
export class Employee extends Agent {
  constructor(name = "employee") {
    super(name);
  }

  async handle(state: AgentState): Promise<AgentState> {
    // If there are messages for employee (e.g., approvals), process them
    const inbox = this.inbox(state);
    if (inbox.length) {
      const processedIds: string[] = [];
      for (const msg of inbox) {
        this.logReceive(msg);
        if (msg.type === "approval") {
          state.approval = {
            approved: !!msg.payload?.approved,
            note: msg.payload?.note,
            decidedBy: msg.from,
            timestamp: Date.now(),
          };
          const status = msg.payload?.approved ? "✅ Task APPROVED" : "❌ Task REJECTED";
          this.log(state, `${status} - Workflow complete`);
        }
        if (msg.type === "note") {
          const notes = this.memory.get("notes") || [];
          notes.push({ from: msg.from, note: msg.payload, at: Date.now() });
          this.memory.set("notes", notes);
        }
        processedIds.push(msg.id);
      }
      this.removeMessages(state, processedIds);
      // After processing approval, end the workflow
      if (state.approval) {
        state.next = undefined; // Signal to router to END
        return state;
      }
      state.next = state.next ?? "manager";
      return state;
    }

    // If no messages: initial kick-off (forward task to manager)
    if (state.task) {
      this.log(state, `🚀 Starting task: "${state.task.title}" [${state.task.priority}]`);
      this.sendMessage(state, {
        from: this.name,
        to: "manager",
        type: "task_request",
        taskId: state.task.id,
        payload: { task: state.task },
      });
      return state;
    }

    // nothing to do
    state.next = state.next ?? "manager";
    return state;
  }
}

// -------------------- MANAGER --------------------
export class Manager extends Agent {
  constructor(name = "manager") {
    super(name);
  }

  async handle(state: AgentState): Promise<AgentState> {
    const inbox = this.inbox(state);
    if (!inbox.length) {
      // nothing to do
      state.next = state.next ?? "director";
      return state;
    }

    const processed: string[] = [];

    for (const msg of inbox) {
      this.logReceive(msg);
      if (msg.type === "task_request") {
        const task: Task = msg.payload?.task;
        // simple decision policy
        if (task.priority === "low") {
          this.log(state, `✅ Auto-approving [low priority]`);
          this.sendMessage(state, {
            from: this.name,
            to: msg.from,
            type: "approval",
            taskId: task.id,
            payload: { approved: true, note: "Manager auto-approved (low priority)" },
          });
        } else if (task.priority === "medium") {
          const approved = Math.random() < 0.8;
          this.log(state, approved ? `✅ Approving [medium priority]` : `❌ Rejecting [medium priority]`);
          this.sendMessage(state, {
            from: this.name,
            to: msg.from,
            type: "approval",
            taskId: task.id,
            payload: { approved, note: approved ? "Manager approved" : "Manager requested revision" },
          });
        } else {
          this.log(state, `⬆️ Escalating to DIRECTOR [high priority]`);
          this.sendMessage(state, {
            from: this.name,
            to: "director",
            type: "task_request",
            taskId: task.id,
            payload: { task, escalatedBy: this.name },
          });
        }
      } else if (msg.type === "approval") {
        this.log(state, `➡️ Forwarding decision to EMPLOYEE`);
        this.sendMessage(state, {
          from: this.name,
          to: "employee",
          type: "approval",
          taskId: msg.taskId,
          payload: msg.payload,
        });
      }
      processed.push(msg.id);
    }

    this.removeMessages(state, processed);
    // router should pick next agent set by last send; if none, go to employee
    state.next = state.next ?? "employee";
    return state;
  }
}

// -------------------- DIRECTOR --------------------
export class Director extends Agent {
  constructor(name = "director") {
    super(name);
  }

  async handle(state: AgentState): Promise<AgentState> {
    const inbox = this.inbox(state);
    if (!inbox.length) {
      state.next = state.next ?? "ceo";
      return state;
    }

    const processed: string[] = [];
    for (const msg of inbox) {
      this.logReceive(msg);
      if (msg.type === "task_request") {
        const task: Task = msg.payload?.task;
        const approve = Math.random() < 0.6;
        if (approve) {
          this.log(state, `✅ Approving task`);
          this.sendMessage(state, {
            from: this.name,
            to: msg.from,
            type: "approval",
            taskId: task.id,
            payload: { approved: true, note: "Director approved" },
          });
        } else {
          this.log(state, `⬆️ Escalating to CEO`);
          this.sendMessage(state, {
            from: this.name,
            to: "ceo",
            type: "task_request",
            taskId: task.id,
            payload: { task, escalatedBy: this.name },
          });
        }
      } else if (msg.type === "approval") {
        // forward CEO decision back to manager/employee chain
        this.sendMessage(state, {
          from: this.name,
          to: "manager",
          type: "approval",
          taskId: msg.taskId,
          payload: msg.payload,
        });
      }
      processed.push(msg.id);
    }

    this.removeMessages(state, processed);
    state.next = state.next ?? "manager";
    return state;
  }
}

// -------------------- CEO --------------------
export class CEO extends Agent {
  constructor(name = "ceo") {
    super(name);
  }

  async handle(state: AgentState): Promise<AgentState> {
    const inbox = this.inbox(state);
    if (!inbox.length) {
      state.next = state.next ?? "director";
      return state;
    }

    const processed: string[] = [];
    for (const msg of inbox) {
      this.logReceive(msg);
      if (msg.type === "task_request") {
        const task: Task = msg.payload?.task;
        const approved = Math.random() < 0.7;
        this.log(state, approved ? `✅ Approving task` : `❌ Rejecting task`);
        this.sendMessage(state, {
          from: this.name,
          to: msg.from,
          type: "approval",
          taskId: task.id,
          payload: { approved, note: approved ? "CEO approved" : "CEO rejected" },
        });
      }
      processed.push(msg.id);
    }

    this.removeMessages(state, processed);
    state.next = state.next ?? "director";
    return state;
  }
}
