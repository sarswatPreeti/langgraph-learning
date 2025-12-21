import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import {
    StudentAgent,
    TeacherAgent,
    PrincipalAgent,
    SupervisorAgent
} from "./agents";

// ============ AGENT INSTANCES ============
const student = new StudentAgent();
const teacher = new TeacherAgent();
const principal = new PrincipalAgent();
const supervisor = new SupervisorAgent();

// ============ GRAPH STATE WITH ANNOTATION ============
interface Message {
    role: string;
    content: string;
}

// Define state using LangGraph Annotation for proper state management
const GraphState = Annotation.Root({
    idea: Annotation<string | undefined>({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    teacherAssessment: Annotation<string | undefined>({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    principalFeasibility: Annotation<string | undefined>({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    decision: Annotation<string | undefined>({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
    messages: Annotation<Message[]>({
        reducer: (prev, next) => next, // Replace messages entirely
        default: () => [],
    }),
    attempts: Annotation<number>({
        reducer: (_, next) => next,
        default: () => 0,
    }),
});

type GraphStateType = typeof GraphState.State;

// ============ POSTGRES CHECKPOINTER FOR DURABLE PERSISTENCE ============
const connectionString = "postgresql://postgres:preetiDatabase@localhost:5432/school_agents";

async function createCheckpointer() {
    const checkpointer = PostgresSaver.fromConnString(connectionString);
    await checkpointer.setup(); // Creates necessary tables if they don't exist
    return checkpointer;
}

// ============ NODES ============
const studentNode = async (state: GraphStateType) => {
    const messages = state.messages || [];
    const attempts = (state.attempts || 0) + 1;
    
    // Stop after 3 attempts
    if (attempts > 3) {
        console.log("\n⚠️  Max attempts reached (3). Ending workflow.\n");
        return { attempts };
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

const teacherNode = async (state: GraphStateType) => {
    const messages = state.messages || [];
    const res = await teacher.review(state.idea!, messages);
    const newMessage = { role: "teacher", content: `Assessment: ${res.assessment}` };
    return { teacherAssessment: res.assessment, messages: [...messages, newMessage] };
};

const principalNode = async (state: GraphStateType) => {
    const messages = state.messages || [];
    const res = await principal.review(state.idea!, messages);
    const newMessage = { role: "principal", content: `Feasibility: ${res.feasibility}` };
    return { principalFeasibility: res.feasibility, messages: [...messages, newMessage] };
};

const supervisorNode = async (state: GraphStateType) => {
  // Check if max attempts reached
  if (state.attempts && state.attempts > 3) {
    return { decision: END };
  }
  return await supervisor.act(state);
};

// ============ ROUTER (NO LOGIC) ============
const supervisorRouter = (state: GraphStateType) => {
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
const workflow = new StateGraph(GraphState)
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
    });

// ============ RUN ============
(async () => {
    // Initialize PostgreSQL checkpointer
    const checkpointer = await createCheckpointer();
    
    // Compile the workflow with the checkpointer
    const compiledWorkflow = workflow.compile({ checkpointer });
    
    // Use a thread_id to enable state persistence via checkpointer
    // Same thread_id will resume from last checkpoint, new thread_id starts fresh
    const threadId = `school-workflow-${Date.now()}`;
    
    const config = {
        configurable: { thread_id: threadId },
        recursionLimit: 50,
    };

    console.log(`\n🚀 Starting workflow with thread_id: ${threadId}\n`);
    console.log(`📦 Using PostgreSQL for durable state persistence\n`);

    const stream = await compiledWorkflow.stream({}, config);
    let finalState: GraphStateType | null = null;

    for await (const step of stream) {
        console.log("STEP →", step);
        
        // Keep track of the last state
        const firstKey = Object.keys(step)[0];
        finalState = step[firstKey as keyof typeof step] as GraphStateType;
    }
    
    // Display final state summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 FINAL STATE (Persisted via Checkpointer):");
    console.log("=".repeat(60));
    console.log(`Thread ID: ${threadId}`);
    console.log(`Final Idea: ${finalState?.idea || "None"}`);
    console.log(`Teacher Assessment: ${finalState?.teacherAssessment || "N/A"}`);
    console.log(`Principal Feasibility: ${finalState?.principalFeasibility || "N/A"}`);
    console.log(`Decision: ${finalState?.decision || "N/A"}`);
    console.log(`Attempts: ${finalState?.attempts || 0}`);
    
    if (finalState?.messages && finalState.messages.length > 0) {
        console.log("\n📜 Message History:");
        console.log("-".repeat(60));
        finalState.messages.forEach((msg) => {
            console.log(`  ${msg.role.toUpperCase()}: ${msg.content}`);
        });
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("💾 State persisted via PostgreSQL checkpointer");
    console.log("   Use the same thread_id to resume this workflow");
    console.log("=".repeat(60) + "\n");
    
    // Example: Get the current state from checkpointer
    const savedState = await compiledWorkflow.getState(config);
    console.log("🔍 Retrieved state from checkpointer:", savedState.values);
    
    // Close the database connection
    await checkpointer.end();
})();