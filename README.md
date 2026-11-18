# ApplyQuest

A gamified job search tracking application to keep you motivated during your job hunt.

## Project Structure

- `/frontend` - React + TypeScript frontend
- `/backend` - Python FastAPI backend

## Setup

### Frontend
```bash
cd frontend
npm install
npm start
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Features

- Gamified job tracking with points, levels, and streaks
- Kanban board for application management
- Apply queue: drafts waiting to be sent, ranked by P(interview) from your own track record, with the posting link, salary range and ask, a heads-up, and the CV and cover letter file names; tick one when it's sent, or set it aside
- Analytics and visualizations
- Network contact management
- Germany-specific job search fields

## Tech Stack

**Frontend:** React, TypeScript, Tailwind CSS, Recharts
**Backend:** Python, FastAPI, PostgreSQL, SQLAlchemy