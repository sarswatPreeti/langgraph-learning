export class studentAgent{
    generateIdeas(){
       const ideas = [
            "Create a study schedule to manage time effectively.",
            "Join a study group to enhance learning through collaboration.",
            "Use flashcards for memorizing key concepts.",
            "Take regular breaks during study sessions to improve focus.",
            "Utilize online resources and tutorials for difficult subjects.",
            "We should organize a science fair",
            "Lets cancel homework forever",
            "We need a new sports ground",
            "Set school timing to 11am",
        ];

        return {
            role: 'student',
            suggestions: ideas[Math.floor(Math.random() * ideas.length)]
        };
    }
}

export class teacherAgent {
    evaluate(suggestion: any) {
        const text = suggestion.suggestions.toLowerCase();
        let score = 0;

        // High learning benefit
        if (
            text.includes("study") ||
            text.includes("learn") ||
            text.includes("focus") ||
            text.includes("schedule") ||
            text.includes("flashcards")
        ) {
            score += 2;
        }

        // Creativity & collaboration (science fair, group activities)
        if (
            text.includes("science fair") ||
            text.includes("group") ||
            text.includes("collaboration")
        ) {
            score += 1;
        }

        // Discipline or unrealistic ideas
        if (text.includes("cancel") || text.includes("no homework")) {
            score -= 2;
        }
        if (text.includes("11am")) {
            score -= 1;
        }

        // Neutral items (sports ground is neutral for teachers)
        // score stays unchanged

        if (score < 0) {
            return {
                role: "teacher",
                action: "ask_student_for_revision",
                message: "Please revise the idea. It may not support learning properly.",
                score
            };
        } else {
            return {
                role: "teacher",
                action: "send_to_principal",
                message: "The idea seems reasonable. Forwarding to principal.",
                score
            };
        }
    }
}

export class principalAgent {
    finalDecision(suggestion: any) {
        const text = suggestion.suggestions.toLowerCase();
        let score = 0;

        // Very good, low-cost academic improvements
        if (
            text.includes("schedule") ||
            text.includes("flashcards") ||
            text.includes("online resources") ||
            text.includes("study") ||
            text.includes("focus")
        ) {
            score += 3;
        }

        // Science fair: good for reputation + moderate money
        if (text.includes("science fair")) {
            score += 1;   // good for school branding
            score -= 1;   // cost & planning
        }

        // Sports ground: high cost project
        if (text.includes("sports ground")) {
            score -= 2;   // expensive
        }

        // Homework cancellation → breaks policy
        if (text.includes("cancel homework")) {
            score -= 3;
        }

        // Unrealistic request
        if (text.includes("11am")) {
            score -= 2;
        }

        if (score >= 1) {
            return {
                role: "principal",
                action: "approve_suggestion",
                message: "Approved. This idea is beneficial and feasible.",
                score
            };
        } else {
            return {
                role: "principal",
                action: "reject_suggestion",
                message: "Rejected. This idea is not practical within school policies or budget.",
                score
            };
        }
    }
}
