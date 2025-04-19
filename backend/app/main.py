from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app import models, crud
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
def register(user: models.UserRegister):
    return crud.register_user(
        user.first_name,
        user.last_name,
        user.email,
        user.phone,
        user.password
    )


@app.post("/api/login")
def login(user: models.UserLogin):
    return crud.login_user(user.email, user.password)


@app.post("/api/campaign/create")
def create_campaign(camp: models.NewCampaign):
    return crud.create_campaign(camp.name, camp.user_id)

@app.post("/api/campaign/join")
def join_campaign(data: models.JoinCampaign):
    return crud.join_campaign(data.invite_code, data.user_id)

@app.post("/api/campaign/progress")
def get_campaign_progress(data: CampaignOnly):
    return crud.get_campaign_progress(data.campaign_id)

@app.post("/api/user/campaigns")
def user_campaigns(data: models.UserOnly):
    return crud.get_user_campaigns(data.user_id)

@app.post("/api/game/state")
def fetch_game_state(data: models.CampaignAndUserOnly):
    return crud.get_saved_progress(data.user_id, data.campaign_id) or {}
