// graph.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import {
  AgentState,
  Employee,
  Manager,
  Director,
  CEO,
} from "./agent";

// Instantiate agent objects (they store memory inside instances)
const employee = new Employee("employee");
const manager = new Manager("manager");
const director = new Director("director");
const ceo = new CEO("ceo");

// Wrap agent.handle as LangGraph nodes
const employeeNode = async (state: AgentState) => employee.handle(state);
const managerNode = async (state: AgentState) => manager.handle(state);
const directorNode = async (state: AgentState) => director.handle(state);
const ceoNode = async (state: AgentState) => ceo.handle(state);

// Router reads state.next which agents set via sendMessage()
const router = (state: AgentState): string => {
  if (!state.next) {
    // If nothing decided, end the workflow
    return END;
  }
  return state.next;
};

// Build the StateGraph
const graph = new StateGraph<AgentState>({
  channels: {
    task: null,
    messages: null,
    meta: null,
    approval: null,
    next: null,
  },
})
  .addNode("employee", employeeNode)
  .addNode("manager", managerNode)
  .addNode("director", directorNode)
  .addNode("ceo", ceoNode)

  // Primary flow: start at employee
  .addEdge(START, "employee")

  // Router can route to any agent node or to END using conditional edges
  .addConditionalEdges("employee", router)
  .addConditionalEdges("manager", router)
  .addConditionalEdges("director", router)
  .addConditionalEdges("ceo", router);

export const officeGraph = graph.compile();

// demo runner
export async function runDemo() {
  const initialState: AgentState = {
    task: {
      id: `T-${Date.now()}`,
      title: "Prepare Q4 Report",
      description: "Compile all metrics for Q4",
      priority: "high",
      createdBy: "employee",
    },
    messages: [], // empty bus at start
    meta: {},
  };

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              🏢 OFFICE HIERARCHY WORKFLOW                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  const out = (await officeGraph.invoke(initialState as any)) as unknown as AgentState;

  console.log("\n┌────────────────────────────────────────────────────────────┐");
  console.log("│                     📋 FINAL RESULT                        │");
  console.log("└────────────────────────────────────────────────────────────┘");
  console.log(`  Task:     "${out.task?.title}"`);
  console.log(`  Priority: ${out.task?.priority?.toUpperCase()}`);
  console.log(`  Status:   ${out.approval?.approved ? "✅ APPROVED" : "❌ REJECTED"}`);
  console.log(`  Note:     ${out.approval?.note || "N/A"}`);
  console.log(`  Decided:  ${out.approval?.decidedBy?.toUpperCase() || "N/A"}`);
  console.log("");
}

runDemo();
