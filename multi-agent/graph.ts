import {StateGraph, START, END} from '@langchain/langgraph';
import {studentAgent, principalAgent, teacherAgent } from './agents';

const student = new studentAgent();
const teacher = new teacherAgent();
const principal = new principalAgent();

interface GraphState{
    suggestion?: any;
    teacherDecision?: any;
    principalDecision?: any;
    attempts?: number;
}

const studentNode= (state: GraphState) => {
    const attempts = state.attempts ?? 0;
    if (attempts >= 10) { // stop after 10 retries
        return { ...state, attempts, teacherDecision: { action: "force_stop", message: "Max attempts reached" } };
    }

    const newSuggestion = student.generateIdeas();
    return {
        ...state,
        suggestion: newSuggestion,
        attempts: attempts + 1
    };
};

const teacherNode = (state: GraphState) => {
    const result = teacher.evaluate(state.suggestion);
    return {
        ...state,
        teacherDecision: result
    };
};

const principalNode = (state: GraphState) => {
    const decision = principal.finalDecision(state.suggestion);
    return {
        ...state,
        principalDecision: decision
    };
};

const teacherRouter = (state: GraphState) => {
    const action = state.teacherDecision?.action;
    if(action === "send_to_principal"){
        return 'principalNode';
    }

    if(action === "ask_student_for_revision"){
        return 'studentNode';
    }

    if(action === "force_stop"){
        return END;
    }
    return END;

};

const principalRouter = (state: GraphState) => {
    const action = state.principalDecision?.action;
    if(action ==="approve_suggestion") return END;
    if(action ==="reject_suggestion") return 'studentNode';

    return END;
};

const workflowGraph = new StateGraph<GraphState>({
    channels: {
        suggestion: null,
        teacherDecision: null,
        principalDecision: null,
    }
})
.addNode('studentNode', studentNode)
.addNode('teacherNode', teacherNode)
.addNode('principalNode', principalNode)
.addEdge(START, 'studentNode')
.addEdge('studentNode', 'teacherNode')
.addConditionalEdges('teacherNode', teacherRouter)
.addConditionalEdges('principalNode', principalRouter)
.compile();

(async () => {
  const result = await workflowGraph.invoke({
    suggestion: null
  });

  console.log("Final Result → ", result);
})();