from typing import Dict, TypedDict, List
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
import os
import google.generativeai as genai

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash')

class AgentState(TypedDict):
    message: List[HumanMessage]

def process_message(state: AgentState) -> AgentState:
    user_message = state["message"][-1].content
    response = model.generate_content(user_message)
    print(f"\nAI: {response.text}\n")
    return state

graph = StateGraph(AgentState)
graph.add_node("process", process_message)
graph.add_edge(START, "process")
graph.add_edge("process", END)
agent = graph.compile()

users_input = input("You: ")
while users_input != "exit":
    agent.invoke({"message": [HumanMessage(content=users_input)]})
    users_input = input("You: ")
