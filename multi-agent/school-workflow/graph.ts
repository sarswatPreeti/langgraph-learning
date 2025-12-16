import { StateGraph, START, END } from "@langchain/langgraph";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
    StudentAgent,
    TeacherAgent,
    PrincipalAgent,
    SupervisorAgent
} from "./agents";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ AGENT INSTANCES ============
const student = new StudentAgent();
const teacher = new TeacherAgent();
const principal = new PrincipalAgent();
const supervisor = new SupervisorAgent();

// ============ PERSISTENT HISTORY ============
const HISTORY_FILE = path.join(__dirname, "chat_history.json");

interface HistoryEntry {
    timestamp: string;
    messages: Array<{role: string; content: string}>;
}

function loadHistory(): HistoryEntry[] {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error loading history:", error);
    }
    return [];
}

function saveHistory(messages: Array<{role: string; content: string}>) {
    try {
        const history = loadHistory();
        history.push({
            timestamp: new Date().toISOString(),
            messages
        });
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error("Error saving history:", error);
    }
}

// ============ GRAPH STATE ============
interface GraphState {
    idea?: string;
    teacherAssessment?: string;
    principalFeasibility?: string;
    decision?: string;
    messages?: Array<{role: string; content: string}>;
    attempts?: number;
}

// ============ NODES ============
const studentNode = async (state: GraphState) => {
    const messages = state.messages || [];
    const attempts = (state.attempts || 0) + 1;
    
    // Stop after 3 attempts
    if (attempts > 3) {
        console.log("\n⚠️  Max attempts reached (3). Ending workflow.\n");
        return { ...state, attempts };
    }
    
    const res = await student.generateIdea(messages);
    const newMessage = { role: "student", content: `Idea: ${res.idea}` };
    // Reset assessments so new idea goes through evaluation again
    return { 
        idea: res.idea, 
        messages: [...messages, newMessage], 
        attempts,
        teacherAssessment: undefined,
        principalFeasibility: undefined
    };
};

const teacherNode = async (state: GraphState) => {
    const messages = state.messages || [];
    const res = await teacher.review(state.idea!, messages);
    const newMessage = { role: "teacher", content: `Assessment: ${res.assessment}` };
    return { ...state, teacherAssessment: res.assessment, messages: [...messages, newMessage] };
};

const principalNode = async (state: GraphState) => {
    const messages = state.messages || [];
    const res = await principal.review(state.idea!, messages);
    const newMessage = { role: "principal", content: `Feasibility: ${res.feasibility}` };
    return { ...state, principalFeasibility: res.feasibility, messages: [...messages, newMessage] };
};

const supervisorNode = (state: GraphState) => {
  // Check if max attempts reached
  if (state.attempts && state.attempts > 3) {
    return { ...state, decision: END };
  }
  return supervisor.act(state);
};

// ============ ROUTER (NO LOGIC) ============
const supervisorRouter = (state: GraphState) => {
    // If max attempts reached, end workflow
    if (state.attempts && state.attempts > 3) {
        return "END";
    }
    // If no decision, shouldn't happen but return END as fallback
    if (!state.decision) {
        return "END";
    }
    return state.decision;
};

// ============ GRAPH ============
const workflow = new StateGraph<GraphState>({
    channels: {
        idea: null,
        teacherAssessment: null,
        principalFeasibility: null,
        decision: null,
        messages: null,
        attempts: null,
    },
})
    .addNode("student", studentNode, { ends: ["supervisor"] })
    .addNode("teacher", teacherNode, { ends: ["supervisor"] })
    .addNode("principal", principalNode, { ends: ["supervisor"] })
    .addNode("supervisor", supervisorNode, {ends: ["student", "teacher", "principal", END],})

    .addEdge(START, "student")
    .addEdge("student", "supervisor")
    .addEdge("teacher", "supervisor")
    .addEdge("principal", "supervisor")

    .addConditionalEdges("supervisor", supervisorRouter, {
        "NA_NA": "teacher",
        "acceptable_NA": "principal",
        "needs_revision_NA": "student",
        "acceptable_feasible": END,
        "acceptable_not_feasible": "student",
        "END": END,
    })

    .compile();

// ============ RUN ============
(async () => {
    const stream = await workflow.stream({}, { recursionLimit: 50 });
    let finalState: any = null;

    for await (const step of stream) {
        console.log("STEP →", step);
        
        // Keep track of the last state
        const firstKey = Object.keys(step)[0];
        finalState = step[firstKey as keyof typeof step];
    }
    
    // Save current run's messages to persistent history
    if (finalState?.messages) {
        saveHistory(finalState.messages);
    }
    
    // Load and display only the latest 5 historical messages
    const allHistory = loadHistory();
    
    if (allHistory.length > 0) {
        console.log("\n" + "=".repeat(60));
        console.log("📜 RECENT MESSAGE HISTORY (Latest 5 Runs):");
        console.log("=".repeat(60));
        
        // Get only the last 5 entries
        const recentHistory = allHistory.slice(-5);
        const startIndex = Math.max(0, allHistory.length - 5);
        
        recentHistory.forEach((entry, index) => {
            const date = new Date(entry.timestamp).toLocaleString();
            console.log(`\n🕒 Run ${startIndex + index + 1} - ${date}`);
            console.log("-".repeat(60));
            entry.messages.forEach((msg: any) => {
                console.log(`  ${msg.role.toUpperCase()}: ${msg.content}`);
            });
        });
        
        console.log("\n" + "=".repeat(60));
        console.log(`💾 Total runs saved in file: ${allHistory.length}`);
        console.log("=".repeat(60) + "\n");
    }
})();