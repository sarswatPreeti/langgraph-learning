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

export class teacherAgent{
    evaluate(suggestion: any){
        const text = suggestion.suggestions.toLowerCase();
        if(text.includes("cancel homework") || text.includes("unknown")){
            return {
                role: 'teacher',
                action: "ask_student_for_revision",
                message: "This suggestion is not feasible."

            };
        }

        else{
            return {
                role: 'teacher',
                action: "send_to_principal",
                message: "This is a good suggestion. Let's consider implementing it."
            };
        }
    }
}

export class principalAgent{
    finalDecision(suggestion: any){
        const text = suggestion.suggestions.toLowerCase();

        if(text.includes("science fair") || text.includes("sports ground")){
            return {
                role: 'principal',
                action: "approve_suggestion",
                message: "The suggestion has been approved for implementation."
            };
        }

        else{
            return {
                role: 'principal',
                action: "reject_suggestion",
                message: "The suggestion has been rejected."
            };
        }
    }
}