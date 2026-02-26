import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMedal } from '@fortawesome/free-solid-svg-icons';
import aceImg from '../assets/accolades/ace.png';
import clutchImg from '../assets/accolades/clutch.png';
import barelyMadeItImg from '../assets/accolades/barely_made_it.png';
import firstSolverImg from '../assets/accolades/first_solver.png';
import biggestGainImg from '../assets/accolades/biggest_gain.png';
import comebackImg from '../assets/accolades/comeback.png';
import bigSpenderImg from '../assets/accolades/big_spender.png';
import hoarderImg from '../assets/accolades/hoarder.png';
import shopRegularImg from '../assets/accolades/shop_regular.png';
import itemMasterImg from '../assets/accolades/item_master.png';
import savesTheDayImg from '../assets/accolades/saves_the_day.png';
import top3Img from '../assets/accolades/top_3.png';
import veteran7Img from '../assets/accolades/veteran_7.png';
import veteran30Img from '../assets/accolades/veteran_30.png';
import veteran100Img from '../assets/accolades/veteran_100.png';
import perfectWeekImg from '../assets/accolades/perfect_week.png';
import ironWillImg from '../assets/accolades/iron_will.png';
import marathonImg from '../assets/accolades/marathon.png';
import earlyBirdImg from '../assets/accolades/early_bird.png';
import nightOwlImg from '../assets/accolades/night_owl.png';
import lateSaveImg from '../assets/accolades/late_save.png';
import luckyStrikeImg from '../assets/accolades/lucky_strike.png';
import chaosKingImg from '../assets/accolades/chaos_king.png';

const accoladeDescriptions = {
  ace: "Solve the word in 1 guess.",
  clutch: "Solve the word in 2 or 3 guesses.",
  barely_made_it: "Solve the word in 6 guesses.",
  first_solver: "Be the first player in the campaign to solve the word that day.",
  biggest_gain: "Earn the most troops in the campaign for the day.",
  comeback: "Fail yesterday and solve today.",
  big_spender: "Spend 50+ coins in a single day.",
  hoarder: "Reach 100+ coins in your balance.",
  shop_regular: "Open the market 25+ times in a day.",
  item_master: "Use items 50+ times total.",
  saves_the_day: "Use an item and still clutch (2-3) or ace the word.",
  top_3: "Finish in the top 3 of the campaign at cycle end.",
  veteran_7: "Play 7 days in the campaign.",
  veteran_30: "Play 30 days in the campaign.",
  veteran_100: "Play 100 days in the campaign.",
  perfect_week: "Reach a 7-day solve streak.",
  iron_will: "Solve after failing the previous two days.",
  marathon: "Reach a 10-day solve streak.",
  early_bird: "Solve within the first hour of the day (CT).",
  night_owl: "Solve within the last hour of the day (CT).",
  late_save: "Solve within the final 10 minutes of the day (CT).",
  lucky_strike: "First two guesses are all gray, then solve on guess 3.",
  chaos_king: "Secret achievement: win a campaign during full chaos testing.",
};

const accoladeImages = {
  ace: aceImg,
  clutch: clutchImg,
  barely_made_it: barelyMadeItImg,
  first_solver: firstSolverImg,
  biggest_gain: biggestGainImg,
  comeback: comebackImg,
  big_spender: bigSpenderImg,
  hoarder: hoarderImg,
  shop_regular: shopRegularImg,
  item_master: itemMasterImg,
  saves_the_day: savesTheDayImg,
  top_3: top3Img,
  veteran_7: veteran7Img,
  veteran_30: veteran30Img,
  veteran_100: veteran100Img,
  perfect_week: perfectWeekImg,
  iron_will: ironWillImg,
  marathon: marathonImg,
  early_bird: earlyBirdImg,
  night_owl: nightOwlImg,
  late_save: lateSaveImg,
  lucky_strike: luckyStrikeImg,
  chaos_king: chaosKingImg,
};

export default function AccoladesModal({ open, onClose, accolades, isAdminCampaign }) {
  const [selectedAccolade, setSelectedAccolade] = useState(null);
  const visibleAccolades = useMemo(
    () => (accolades || []).filter((item) => (Number(item.count) || 0) > 0),
    [accolades]
  );
  const accoladesToShow = isAdminCampaign ? (accolades || []) : visibleAccolades;

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="accolades-modal-overlay" role="dialog" aria-modal="true">
        <div className="accolades-modal">
          <button
            className="accolades-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close accolades"
          >
            ×
          </button>
          <div className="accolades-modal-title">Accolades</div>
          <div className="accolades-modal-body">
            <div className="accolades-modal-list">
              {accoladesToShow.length === 0 ? (
                <div className="accolades-empty">No accolades yet.</div>
              ) : (
                accoladesToShow.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="accolades-card"
                    onClick={() => setSelectedAccolade(item)}
                    aria-label={`View ${item.label}`}
                  >
                    <div className="accolades-icon" aria-hidden="true">
                      {accoladeImages[item.key] ? (
                        <img src={accoladeImages[item.key]} alt="" />
                      ) : (
                        <FontAwesomeIcon icon={faMedal} />
                      )}
                    </div>
                    <div className="accolades-name">{item.label}</div>
                    <div className="accolades-qty">x{item.count}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedAccolade && (
        <div className="accolades-modal-overlay" role="dialog" aria-modal="true">
          <div className="accolades-info-modal">
            <button
              className="accolades-modal-close"
              type="button"
              onClick={() => setSelectedAccolade(null)}
              aria-label="Close accolade info"
            >
              ×
            </button>
            <div className="accolades-modal-title">{selectedAccolade.label}</div>
            <div className="accolades-info-icon">
              {accoladeImages[selectedAccolade.key] ? (
                <img src={accoladeImages[selectedAccolade.key]} alt="" />
              ) : (
                <FontAwesomeIcon icon={faMedal} />
              )}
            </div>
            <div className="accolades-info-body">
              {accoladeDescriptions[selectedAccolade.key] || "Accolade description coming soon."}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
