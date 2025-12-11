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
    const newSuggestion = student.generateIdeas();
    return {
        ...state,
        suggestion: newSuggestion,
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

    const attempts = (state.attempts ?? 0) + 1;

    if (attempts >= 8) {
        return END;
    }

    state.attempts = attempts;

    const action = state.teacherDecision?.action;
    if(action === "send_to_principal"){
        return 'principalNode';
    }

    if(action === "ask_student_for_revision"){
        return 'studentNode';
    }
    return END;

};

const principalRouter = (state: GraphState) => {

    const attempts = (state.attempts ?? 0) + 1;

    if (attempts >= 8) {
        return END;
    }

    state.attempts = attempts;
    console.log(attempts);

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
  const result = await workflowGraph.stream({
    suggestion: null
  });

  for await (const step of result) {
    console.log("STEP →", step);
}
})();