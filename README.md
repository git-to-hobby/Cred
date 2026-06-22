# Agentic AI Loan Sales Query (CredFlow)

**Live demo:** https://credflow-portal.vercel.app  
**Backend API:** https://credflow-master.onrender.com  
**Demo login:** Customer ID `711007500` / Password `Sonu@123` · Admin portal: `/admin/login` (server-configured credentials)

A multi-agent AI system based on RAG and based on Langraph-framework.

This project implements a Hybrid AI Architecture combining the flexibility of Large Language Models (Google Gemini) with the reliability of deterministic code (Python/SQL). It orchestrates a team of specialized "Worker Agents" to handle sales with implemented webscrapper to feed relaible data to the LLM so it will be reliable to use, identity verification, risk underwriting, document processing, and sanction letter generation.

# Key Features

Intelligent Orchestration: Uses LangGraph to manage conversation state, memory, and tool execution.

Document Intelligence: A dedicated DocProcessor Agent uses OCR (Tesseract) and LLMs to extract data from uploaded KYC documents and Salary Slips automatically.

Risk-Based Underwriting: A sophisticated underwriting engine that adjusts interest rates and tenures dynamically based on credit scores (CIBIL logic).

# Robust Data Persistence:

PostgreSQL: Stores customer profiles, loan application status, and structural relational data.

MongoDB: Archives complete chat transcripts and loan lifecycle events for auditing.

Hybrid Sales Agent: Checks for pre-approved offers first, then falls back to an LLM with search grounding to answer general financial queries.

PDF Generation: Automatically generates and saves legally formatted Sanction Letters.

# Tech Stack

Language: Python 3.11+

Orchestration: LangGraph, LangChain

LLM: Google Gemini 1.5 Flash

Backend Framework: FastAPI (Microservices approach)

Databases: PostgreSQL (Relational), MongoDB (NoSQL)

Document Processing: PyMuPDF, Pytesseract, Pillow

Frontend: React, TypeScript, TailwindCSS

# Architecture Overview

The system consists of Master Agent (The Brain) and 5 Specialized Worker Agents running on different ports:
Master Agent:The LangGraph orchestrator. Manages user intent and routes tasks.
Sales Agent:Handles offers and general queries.
Verification:Validates customer identity against mock APIs.
Underwriting:Calculates risk, EMI, and approves/rejects loans.
Sanction:Generates PDF letters and archives chat history to MongoDB.
DocProcessor:Extracts text/data from uploaded files (OCR/LLM).
Plus 3 Mock Services for CRM, Credit Bureau, and Offer Mart 

# Installation & Setup

1. Clone the Repository
```bash
git clone https://github.com/git-to-hobby/Cred.git
cd Cred
```
 
2. Prerequisites

Ensure you have the following installed:
```bash
Python 3.10+
PostgreSQL 
MongoDB 
Tesseract OCR (Required for document processing. Download here)
```

3. Environment Setup (Backend)

Navigate to the backend directory and set up the virtual environment:
```bash
cd backend
python -m venv venv

# Activate venv:
# Windows:
.\venv\Scripts\Activate
# Mac/Linux:
source venv/bin/activate
```

4. Install Dependencies

Install all requirements for all agents at once:
```bash
pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
```

5. Database Configuration

Create a PostgreSQL database named loan_chatbot_db.

Run the setup script to create tables (customers, loans, chat_messages) and seed dummy data:
```bash
cd db
python setup_postgres_db.py
```

6. Environment Variables

Create a .env file in the backend/ directory:

GOOGLE_API_KEY=your_gemini_api_key_here
DB_NAME=loan_chatbot_db
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
MONGO_URI=mongodb://localhost:27017/
# Path to Tesseract executable (Windows example)
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe


 # How to Run

Since this is a microservices architecture, you need to run the agents simultaneously.

 Using the PowerShell Script (Windows)
Run the provided helper script from the backend/ folder:
```bash
.\run_all.ps1
```
# Launch Frontend (CredFlow — user + admin in one app)

```bash
cd frontend/credflow-portal
npm install
npm run dev
```

Open http://localhost:8080 — use **Admin** in the navbar for banker portal (`/admin/login`).

# Deployment

## Architecture

| Component | Platform | Notes |
|-----------|----------|-------|
| CredFlow Portal (`frontend/credflow-portal`) | **Vercel** | User + Admin in one app |
| Backend (9 microservices + DB) | **Docker Compose** / **Render** | PostgreSQL + MongoDB |

## 1. Backend (Docker Compose)

On a VPS (Ubuntu) or any machine with Docker:

```bash
cp .env.docker.example .env
# Edit .env — set GOOGLE_API_KEY (required)

docker compose up --build -d
```

APIs exposed:
- Master Agent: `http://YOUR_SERVER_IP:8000`
- CRM Login: `http://YOUR_SERVER_IP:9001`
- Doc Processor: `http://YOUR_SERVER_IP:8005`

Check health: `curl http://YOUR_SERVER_IP:8000/`

## 2. Frontend (Vercel)

Single Vercel project: **credflow-portal** → https://credflow-portal.vercel.app

- Root Directory: `frontend/credflow-portal`
- Framework: Vite
- Environment variables:
  - `VITE_API_BASE_URL` = Master Agent URL
  - `VITE_CRM_SERVICE_URL` = CRM URL (optional; login uses master)
  - `VITE_DOC_PROCESSOR_URL` = Doc processor URL
- Admin: `/admin/login` — set `ADMIN_BANKER_ID` + `ADMIN_PASSWORD` in backend `.env`

# Future Developments

The current system is a robust prototype.Future advancements are:

1. Multilingual Support (Bhashini Integration)

Goal: Allow users to chat in regional languages (Hindi, Tamil, Kannada, etc.).

Implementation: Integrate AI translation layers (like Google Translate API or Bhashini) at the entry and exit points of the Master Agent. The core logic remains in English, but the user interface becomes vernacular.

2. Voice-Enabled Interaction

Goal: Enable a "Talk to Apply" feature for better accessibility.

Implementation: Add Speech-to-Text (STT) (e.g., OpenAI Whisper) to convert voice notes to text for the Master Agent, and Text-to-Speech (TTS) (e.g., ElevenLabs or Google TTS) to read the agent's responses back to the user.

3.  Automated Web Direction (RPA)

Goal: Assist users with filling out government portal forms (like JanSamarth) automatically.

Implementation: Create a new "Navigator Agent" using tools like Selenium or Puppeteer. Once the user provides their details to the chatbot, this agent would physically navigate to the internal and external website and auto-fill the application forms, reducing manual effort.

# Author

**Sonu Kumar**  
Email: sonuk.ug23.ec@nitp.ac.in
