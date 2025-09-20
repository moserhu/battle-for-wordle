from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app import models, crud
from app.models import CampaignOnly
from fastapi import Depends
from app.auth import get_current_user
from app.auth import create_access_token
from app.models import UserOnly, UpdateUserInfo, CampaignAndUserOnly
from prometheus_fastapi_instrumentator import Instrumentator

from app.scheduler import start_scheduler
from database import init_db


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],   
    allow_headers=["Authorization", "Content-Type"]
)

instrumentator = Instrumentator().instrument(app)

@app.on_event("startup")
async def startup_event():
    start_scheduler()
    init_db()
    instrumentator.expose(app, include_in_schema=True, should_gzip=False)

@app.post("/api/word/reveal")
def reveal_word(data: models.CampaignOnly):
    return {"word": crud.get_daily_word(data.campaign_id)}

@app.post("/api/guess")
def guess_with_meta(data: models.GuessWithMeta, current_user: dict = Depends(get_current_user)):
    return crud.validate_guess(data.word, current_user["user_id"], data.campaign_id)

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
    user_data = crud.login_user(user.email, user.password)
    token = create_access_token({"user_id": user_data["user_id"]})
    return {"access_token": token, "user": user_data}

@app.post("/api/campaign/create")
def create_campaign(camp: models.NewCampaign, current_user: dict = Depends(get_current_user)):
    return crud.create_campaign(camp.name, current_user["user_id"], camp.cycle_length)

@app.post("/api/campaign/join")
def join_campaign(data: models.JoinCampaign, current_user: dict = Depends(get_current_user)):
    return crud.join_campaign(data.invite_code, current_user["user_id"])

@app.post("/api/campaign/join_by_id")
def join_campaign_by_id(data: models.CampaignIDOnly, current_user: dict = Depends(get_current_user)):
    return crud.join_campaign_by_id(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/progress")
def get_campaign_progress(data: CampaignOnly):
    return crud.get_campaign_progress(data.campaign_id)

@app.post("/api/campaign/end")
def end_campaign(data: CampaignOnly):
    return crud.handle_campaign_end(data.campaign_id)

@app.post("/api/game/state")
def fetch_game_state(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_saved_progress(current_user["user_id"], data.campaign_id)

@app.get("/api/user/info")
def get_user_info(current_user: dict = Depends(get_current_user)):
    return crud.get_user_info(current_user["user_id"])

@app.post("/api/user/campaigns")
def user_campaigns(current_user: dict = Depends(get_current_user)):
    return crud.get_user_campaigns(current_user["user_id"])

@app.post("/api/user/update")
def update_user(data: UpdateUserInfo, current_user: dict = Depends(get_current_user)):
    return crud.update_user_info(current_user["user_id"], data.first_name, data.last_name, data.phone)

@app.post("/api/campaign/finished_today")
def check_finished_today(data: CampaignOnly):
    return {"ended": crud.has_campaign_finished_for_day(data.campaign_id)}

@app.post("/api/campaign/delete")
def delete_campaign(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.delete_campaign(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/kick")
def kick_player(data: models.KickRequest, current_user: dict = Depends(get_current_user)):
    return crud.kick_player_from_campaign(data.campaign_id, data.user_id, current_user["user_id"])


@app.get("/api/campaigns/owned")
def get_owned_campaigns(current_user: dict = Depends(get_current_user)):
    return crud.get_campaigns_by_owner(current_user["user_id"])

@app.post("/api/campaign/members")
def get_campaign_members(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_campaign_members(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/self_member")
def get_self_member(data: models.CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.get_self_member(data.campaign_id, current_user["user_id"])

@app.post("/api/campaign/update_member")
def update_campaign_member(data: models.CampaignAndUserOnly, current_user: dict = Depends(get_current_user)):
    return crud.update_campaign_member(data.campaign_id, current_user["user_id"], data.display_name, data.color)

@app.post("/api/double_down")
def activate_double_down(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return crud.activate_double_down(current_user["user_id"], data.campaign_id)

@app.post("/api/user/acknowledge_update")
def acknowledge_update(current_user: dict = Depends(get_current_user)):
    return crud.acknowledge_update(current_user["user_id"])
