from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END
import random

class GameState(TypedDict):
    user_choice: str
    computer_choice: str
    result: str
    user_score: int
    computer_score: int
    ties: int
    continue_playing: bool

def get_user_input(state: GameState) -> GameState:
    """Node: Get user's choice"""
    user_choice = input("\nEnter your choice (rock/paper/scissors) or 'quit' to exit: ").lower().strip()
    
    if user_choice == 'quit':
        state["continue_playing"] = False
        return state
    
    if user_choice not in ['rock', 'paper', 'scissors']:
        print("Invalid choice! Please try again.")
        return state
    
    state["user_choice"] = user_choice
    return state

def computer_makes_choice(state: GameState) -> GameState:
    """Node: Computer randomly chooses"""
    choices = ['rock', 'paper', 'scissors']
    computer_choice = random.choice(choices)
    state["computer_choice"] = computer_choice
    
    print(f"\nYou chose: {state['user_choice']}")
    print(f"Computer chose: {computer_choice}")
    
    return state

def determine_winner(state: GameState) -> GameState:
    """Node: Determine who wins"""
    user_choice = state["user_choice"]
    computer_choice = state["computer_choice"]
    
    if user_choice == computer_choice:
        state["result"] = "tie"
        state["ties"] += 1
        print("It's a tie!")
    else:
        winning_combinations = {
            'rock': 'scissors',
            'scissors': 'paper',
            'paper': 'rock'
        }
        
        if winning_combinations[user_choice] == computer_choice:
            state["result"] = "user"
            state["user_score"] += 1
            print("You win! 🎉")
        else:
            state["result"] = "computer"
            state["computer_score"] += 1
            print("Computer wins! 🤖")
    
    return state

def display_score(state: GameState) -> GameState:
    """Node: Display current score"""
    print(f"\nScore - You: {state['user_score']} | Computer: {state['computer_score']} | Ties: {state['ties']}")
    return state

def should_continue(state: GameState) -> Literal["continue", "end"]:
    """Conditional edge: Check if game should continue"""
    if state.get("continue_playing", True) and state.get("user_choice"):
        return "continue"
    return "end"

def check_valid_input(state: GameState) -> Literal["valid", "retry"]:
    """Conditional edge: Check if input is valid"""
    if not state.get("continue_playing", True):
        return "valid"
    if state.get("user_choice") in ['rock', 'paper', 'scissors']:
        return "valid"
    return "retry"

# Build the graph
graph = StateGraph(GameState)

# Add nodes
graph.add_node("get_input", get_user_input)
graph.add_node("computer_choice", computer_makes_choice)
graph.add_node("determine_winner", determine_winner)
graph.add_node("display_score", display_score)

# Add edges
graph.add_edge(START, "get_input")

# Conditional edge after input
graph.add_conditional_edges(
    "get_input",
    check_valid_input,
    {
        "valid": "computer_choice",
        "retry": "get_input"
    }
)

graph.add_edge("computer_choice", "determine_winner")
graph.add_edge("determine_winner", "display_score")

# Conditional edge to continue or end
graph.add_conditional_edges(
    "display_score",
    should_continue,
    {
        "continue": "get_input",
        "end": END
    }
)

# Compile the graph
app = graph.compile()

def play_game():
    """Main game function"""
    print("\n=== Rock Paper Scissors Game (LangGraph) ===")
    print("Type 'quit' to exit the game")
    
    # Initial state
    initial_state = {
        "user_choice": "",
        "computer_choice": "",
        "result": "",
        "user_score": 0,
        "computer_score": 0,
        "ties": 0,
        "continue_playing": True
    }
    
    # Run the graph
    final_state = app.invoke(initial_state)
    
    # Display final results
    print("\n=== Game Over ===")
    print(f"Final Score - You: {final_state['user_score']} | Computer: {final_state['computer_score']} | Ties: {final_state['ties']}")
    
    if final_state['user_score'] > final_state['computer_score']:
        print("Congratulations! You won overall! 🏆")
    elif final_state['computer_score'] > final_state['user_score']:
        print("Computer won overall! Better luck next time!")
    else:
        print("It's a tie overall!")

if __name__ == "__main__":
    play_game()
