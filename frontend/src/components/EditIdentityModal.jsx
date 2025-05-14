import React, { useState, useEffect, useRef } from 'react';
import { HslColorPicker } from 'react-colorful';
import '../styles/EditIdentityModal.css';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000`;

function parseHslString(input) {
  if (!input) return { h: 0, s: 0, l: 1 };

  if (typeof input === "object" && input.h !== undefined) {
    return input;
  }

  if (typeof input === "string" && input.startsWith("hsl(")) {
    const match = input.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
    if (match) {
      return {
        h: parseFloat(match[1]),
        s: parseFloat(match[2]) / 100,
        l: parseFloat(match[3]) / 100
      };
    }
  }

  try {
    const dummy = document.createElement("div");
    dummy.style.color = input;
    document.body.appendChild(dummy);
    const computed = getComputedStyle(dummy).color;
    document.body.removeChild(dummy);

    const [r, g, b] = computed.match(/\d+/g).map(Number).map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0; break; // <--- Add this
      }
      h *= 60;
    }

    return {
      h: Math.round(h % 360),
      s: Math.min(Math.max(s, 0), 1),
      l: Math.min(Math.max(l, 0), 0.9)  // ⬅️ Cap lightness to 90%
    };
    
  } catch {
    return { h: 0, s: 0, l: 1 };
  }
}

function hslToCssString(hsl) {
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
}

export default function EditIdentityModal({
  visible,
  displayName,
  color,
  campaignId,
  userId,
  onClose,
  onSave
}) {
  const [newName, setNewName] = useState(displayName);
  const [pickerColor, setPickerColor] = useState(() => {
    const parsed = parseHslString(color);
    return parsed;
  });
  const [showWheel, setShowWheel] = useState(false);
  const [nameError, setNameError] = useState("");
  const [swatchColor, setSwatchColor] = useState(color);

  const spectrumRef = useRef(null);
  const lastTapY = useRef(null);
  const pickerAreaRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setNewName(displayName);
      setSwatchColor(color); // 👈 Reset swatch to initial color
    }
  }, [visible, displayName, color]);
  
  if (!visible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Edit Your Identity</h2>
        <label>Display Name</label>
        <input
          type="text"
          value={newName}
          maxLength={13}
          onChange={(e) => setNewName(e.target.value)}
        />
        <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "4px" }}>
          {newName.length}/13 characters
        </p>
        {nameError && <p className="modal-error">{nameError}</p>}

        <label>Color</label>
        <div className="color-picker-wrapper">
          <div
            className="current-color-preview"
            style={{ backgroundColor: swatchColor }}
            onClick={() => setShowWheel(!showWheel)}
          />
          {showWheel && (
            <div
              className="wheel-container"
              ref={pickerAreaRef}
              onPointerDown={(e) => {
                const rect = pickerAreaRef.current?.getBoundingClientRect();
                if (!rect) return;
                lastTapY.current = e.clientY - rect.top;
              }}
            >
              <div ref={spectrumRef}>
                <HslColorPicker
                  color={pickerColor}
                  onChange={(color) => {
                    const parsed = {
                      h: color.h,
                      s: color.s / 100,
                      l: color.l / 100
                    };
                    setPickerColor(parsed);
                    setSwatchColor(hslToCssString(parsed));
                    // Close only if the tap was near the top spectrum (e.g., <100px)
                    if (lastTapY.current !== null && lastTapY.current < 100) {
                      setShowWheel(false);
                      lastTapY.current = null;
                    } else {
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-buttons">
          <button
            className="troop-btn"
            onClick={async () => {
              if (newName.trim() === "") {
                setNameError("Display name cannot be empty.");
                setTimeout(() => setNameError(""), 3000);
                return;
              }

              const newColor = hslToCssString(pickerColor);

              const res = await fetch(`${API_BASE}/api/campaign/update_member`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                  campaign_id: campaignId,
                  user_id: userId,
                  display_name: newName,
                  color: newColor
                })
              });

              if (res.ok) {
                onSave(newName, newColor);
              } else {
                setNameError("Update failed. Please try again.");
                setTimeout(() => setNameError(""), 3000);
              }
            }}
          >
            Save
          </button>
          <button className="troop-btn close-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
