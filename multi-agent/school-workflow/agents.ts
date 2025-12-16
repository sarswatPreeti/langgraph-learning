import "dotenv/config";
import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const model = new ChatOpenAI({
    modelName: "mistralai/devstral-2512:free",
    configuration: {
        baseURL: "https://openrouter.ai/api/v1"
    },
    temperature: 0,
});
// ================= STUDENT AGENT =================
export class StudentAgent {
    async generateIdea(messages: Array<{role: string; content: string}> = []) {
        const history = messages.length > 0 
            ? "\n\nPrevious conversation:\n" + messages.map(m => `${m.role}: ${m.content}`).join("\n")
            : "";
        
        // Get a random number to vary the type of idea
        const randomSeed = Math.random();
        
        let ideaType = "";
        if (randomSeed < 0.3) {
            ideaType = "practical and budget-friendly";
        } else if (randomSeed < 0.6) {
            ideaType = "creative but expensive/complex";
        } else {
            ideaType = "unrealistic or inappropriate";
        }
            
        const prompt = `
You are a creative school student brainstorming improvement ideas.
Propose ONE NEW and DIFFERENT idea to improve school (don't repeat previous ideas).
${history}

IMPORTANT: Generate a ${ideaType} idea this time.

Examples of different types:
- Practical: "Add water fountains", "Create study groups", "Weekly tutoring sessions"
- Creative/Expensive: "Install smart lockers with facial recognition", "Build a new sports complex", "AI-powered learning tablets for every student"
- Unrealistic: "Cancel all homework forever", "Make school optional", "Replace teachers with robots", "School only 2 hours per day"

Rules:
- Keep it short (1 sentence)
- Make it DIFFERENT from any previous ideas in history
- No explanations
- Vary between realistic, ambitious, and silly ideas

Return JSON only:
{
  "idea": "<string>"
}
        `;

        const res = await model.invoke(prompt);
        let content = res.content as string;
        // Remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const json = JSON.parse(content);

        return {
            role: "student",
            idea: json.idea
        };
    }
}

// ================= TEACHER AGENT =================
export class TeacherAgent {
    async review(idea: string, messages: Array<{role: string; content: string}> = []) {
        const history = messages.length > 0 
            ? "\n\nPrevious conversation:\n" + messages.map(m => `${m.role}: ${m.content}`).join("\n")
            : "";
            
        const prompt = `
You are a school teacher.
Evaluate the following idea ONLY for learning value.
${history}

Idea: "${idea}"

Return JSON only:
{
  "assessment": "acceptable" | "needs_revision"
}
        `;

        const res = await model.invoke(prompt);
        let content = res.content as string;
        // Remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const json = JSON.parse(content);

        return {
            role: "teacher",
            assessment: json.assessment
        };
    }
}

// ================= PRINCIPAL AGENT =================
export class PrincipalAgent {
    async review(idea: string, messages: Array<{role: string; content: string}> = []) {
        const history = messages.length > 0 
            ? "\n\nPrevious conversation:\n" + messages.map(m => `${m.role}: ${m.content}`).join("\n")
            : "";
            
        const prompt = `
You are a school principal.
Judge whether the idea is feasible considering:
- school policy
- budget
- practicality
${history}

Idea: "${idea}"

Return JSON only:
{
  "feasibility": "feasible" | "not_feasible"
}
        `;

        const res = await model.invoke(prompt);
        let content = res.content as string;
        // Remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const json = JSON.parse(content);

        return {
            role: "principal",
            feasibility: json.feasibility
        };
    }
}

// ================= SUPERVISOR AGENT =================
export class SupervisorAgent {
    act(state: any) {
        const teacher = state.teacherAssessment ?? "NA";
        const principal = state.principalFeasibility ?? "NA";

        return {
            ...state,
            decision: `${teacher}_${principal}`
        };
    }
}