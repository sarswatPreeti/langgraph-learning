from langchain_core.tools import tool
from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI

from dotenv import load_dotenv
import os

load_dotenv()

@tool
def add_number(a:int, b:int):
    """Add two numbers and return the result."""
    return a + b

@tool
def subtract_number(a:int, b:int):
    """Subtract two numbers and return the result."""
    return a - b

@tool
def mulitply_number(a:int, b:int):
    """Multiply two numbers and return the result."""
    return a * b

tools = [add_number, subtract_number, mulitply_number]

model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite",
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# Create a react agent with tools
app = create_agent(model, tools)

# Run the agent
input_message = {"messages": [("user", "What is 25 multiplied by 4, then subtract 100 and add 15?, tell me a joke afterwards.")]}

for chunk in app.stream(input_message, stream_mode="values"):
    chunk["messages"][-1].pretty_print()