from typing import Dict, TypedDict, List, Union
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
import os
import google.generativeai as genai

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash-lite')
chat = model.start_chat(history=[])

class AgentState(TypedDict):
    message: List[Union[HumanMessage, AIMessage]]

def process_message(state: AgentState) -> AgentState:
    user_message = state["message"][-1].content
    
    # Send message using chat session (maintains history automatically)
    response = chat.send_message(user_message)
    print(f"\nAI: {response.text}\n")
    
    # Add AI response to the conversation history
    state["message"].append(AIMessage(content=response.text))
    print("Current State: ", state["message"])
    return state

graph = StateGraph(AgentState)
graph.add_node("process", process_message)
graph.add_edge(START, "process")
graph.add_edge("process", END)
agent = graph.compile()

conversation_history = []

users_input = input("You: ")
while users_input != "exit":
    conversation_history.append(HumanMessage(content=users_input))
    result = agent.invoke({"message": conversation_history})
    conversation_history = result["message"]
    users_input = input("You: ")


with open("conversation_history.txt", "w") as f:
    for msg in conversation_history:
        role = "User" if isinstance(msg, HumanMessage) else "AI"
        f.write(f"{role}: {msg.content}\n") 