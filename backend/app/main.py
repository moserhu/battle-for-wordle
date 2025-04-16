from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app import database, models, crud
from app.models import CampaignOnly

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/api/word/reveal")
def reveal_word(data: models.CampaignOnly):
    return {"word": crud.get_daily_word(data.campaign_id)}

@app.post("/api/guess")
def guess_with_meta(data: models.GuessWithMeta):
    return crud.validate_guess(data.word, data.user_id, data.campaign_id)

@app.post("/api/leaderboard")
def get_leaderboard(data: CampaignOnly):
    return crud.get_leaderboard(data.campaign_id)

@app.post("/api/register")
def register(user: models.UserLogin):
    return crud.register_user(user.username, user.password)

@app.post("/api/login")
def login(user: models.UserLogin):
    return crud.login_user(user.username, user.password)

@app.post("/api/campaign/create")
def create_campaign(camp: models.NewCampaign):
    return crud.create_campaign(camp.name, camp.user_id)

@app.post("/api/campaign/join")
def join_campaign(data: models.JoinCampaign):
    return crud.join_campaign(data.invite_code, data.user_id)

