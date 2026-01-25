import React, { useEffect, useRef, useState } from 'react';
import { HslColorPicker } from 'react-colorful';
import ImageUploadField from './uploads/ImageUploadField';
import '../styles/ProfileModal.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

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
        default: h = 0; break;
      }
      h *= 60;
    }

    return {
      h: Math.round(h % 360),
      s: Math.min(Math.max(s, 0), 1),
      l: Math.min(Math.max(l, 0), 0.9)
    };
  } catch {
    return { h: 0, s: 0, l: 1 };
  }
}

function hslToCssString(hsl) {
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
}

export default function ProfileModal({
  visible,
  token,
  campaignId,
  displayName,
  color,
  profileImageUrl,
  armyImageUrl,
  armyName,
  onClose,
  onUpdated,
}) {
  const [pickerColor, setPickerColor] = useState(() => parseHslString(color));
  const [swatchColor, setSwatchColor] = useState(color);
  const [savingColor, setSavingColor] = useState(false);
  const [colorError, setColorError] = useState("");
  const [colorSnapshot, setColorSnapshot] = useState(null);
  const [newDisplayName, setNewDisplayName] = useState(displayName || "");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState("");
  const [newArmyName, setNewArmyName] = useState(armyName || "");
  const [savingArmyName, setSavingArmyName] = useState(false);
  const [armyNameError, setArmyNameError] = useState("");
  const [showWheel, setShowWheel] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const pickerAreaRef = useRef(null);

  useEffect(() => {
    if (visible) {
      const parsed = parseHslString(color);
      setPickerColor(parsed);
      setSwatchColor(color);
      setColorError("");
      setSavingColor(false);
      setColorSnapshot(null);
      setNewDisplayName(displayName || "");
      setDisplayNameError("");
      setSavingDisplayName(false);
      setNewArmyName(armyName || "");
      setArmyNameError("");
      setSavingArmyName(false);
      setPreviewImageUrl("");
    }
  }, [visible, color, armyName, displayName]);

  if (!visible) return null;

  const handleSaveColor = async () => {
    setSavingColor(true);
    setColorError("");
    try {
      const newColor = hslToCssString(pickerColor);
      const res = await fetch(`${API_BASE}/api/campaign/update_member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaign_id: Number(campaignId),
          user_id: 0,
          display_name: displayName || "",
          color: newColor
        })
      });

      if (!res.ok) {
        throw new Error("Update failed. Please try again.");
      }

      onUpdated({
        color: newColor,
      });
      setShowWheel(false);
      setColorSnapshot(null);
    } catch (err) {
      setColorError(err?.message || "Update failed.");
    } finally {
      setSavingColor(false);
    }
  };

  return (
    <div className="profile-modal-overlay">
      <div className="profile-modal">
        <button className="profile-modal-close" onClick={onClose} type="button">×</button>
        <h2>Profile</h2>
        <p className="profile-modal-name">{displayName || "Player"}</p>

        <section className="profile-modal-section">
          <h3>Images</h3>
          <div className="profile-modal-grid">
            <ImageUploadField
              label="Profile Image"
              value={profileImageUrl}
              token={token}
              presignPath="/api/user/profile-image/presign"
              confirmPath="/api/user/profile-image/confirm"
              presignBody={(file) => ({ filename: file.name, content_type: file.type })}
              confirmBody={(presign) => ({ key: presign.key, file_url: presign.file_url })}
              emptyLabel="No photo"
              onUploaded={(url) => onUpdated({ profileImageUrl: url })}
              onPreview={(url) => setPreviewImageUrl(url)}
            />
            <ImageUploadField
              label="Army Banner"
              value={armyImageUrl}
              token={token}
              presignPath="/api/campaign/army-image/presign"
              confirmPath="/api/campaign/army-image/confirm"
              presignBody={(file) => ({
                campaign_id: Number(campaignId),
                filename: file.name,
                content_type: file.type
              })}
              confirmBody={(presign) => ({
                campaign_id: Number(campaignId),
                key: presign.key,
                file_url: presign.file_url
              })}
              emptyLabel="No banner"
              onUploaded={(url) => onUpdated({ armyImageUrl: url })}
              onPreview={(url) => setPreviewImageUrl(url)}
            />
          </div>
        </section>

        <section className="profile-modal-section">
          <h3 className="profile-color-title">Display Color</h3>
          <div className={`profile-color-row centered ${showWheel ? "picker-open" : ""}`}>
            <div
              className="profile-color-swatch"
              style={{ backgroundColor: swatchColor }}
              onClick={() => {
                setColorSnapshot({ pickerColor, swatchColor });
                setShowWheel(true);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') {
                setColorSnapshot({ pickerColor, swatchColor });
                setShowWheel(true);
              }}}
            />
            <div className="profile-color-controls">
              {showWheel && (
                <div
                  className="profile-color-wheel"
                  ref={pickerAreaRef}
                >
                  <HslColorPicker
                    color={pickerColor}
                    onChange={(nextColor) => {
                      const parsed = {
                        h: nextColor.h,
                        s: nextColor.s / 100,
                        l: nextColor.l / 100
                      };
                      setPickerColor(parsed);
                      setSwatchColor(hslToCssString(parsed));
                    }}
                  />
                </div>
              )}
              {showWheel && (
                <div className="profile-color-actions">
                  <button
                    className="profile-color-confirm"
                    type="button"
                    onClick={handleSaveColor}
                    disabled={savingColor}
                    aria-label="Save color"
                  >
                    {savingColor ? "Saving..." : "✓"}
                  </button>
                  <button
                    className="profile-color-cancel"
                    type="button"
                    onClick={() => {
                      if (colorSnapshot) {
                        setPickerColor(colorSnapshot.pickerColor);
                        setSwatchColor(colorSnapshot.swatchColor);
                      }
                      setShowWheel(false);
                    }}
                    aria-label="Cancel color change"
                  >
                    ✕
                  </button>
                </div>
              )}
              {colorError && <span className="profile-color-error">{colorError}</span>}
            </div>
          </div>
        </section>

        <section className="profile-modal-section">
          <div className="profile-section-header">
            <h3>Campaign Display Name</h3>
            {newDisplayName.trim() !== (displayName || "").trim() && (
              <div className="profile-inline-actions">
                <button
                  className="profile-inline-confirm"
                  type="button"
                  onClick={async () => {
                    if (!newDisplayName.trim()) {
                      setDisplayNameError("Display name cannot be empty.");
                      return;
                    }
                    setSavingDisplayName(true);
                    setDisplayNameError("");
                    try {
                      const res = await fetch(`${API_BASE}/api/campaign/update_member`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          campaign_id: Number(campaignId),
                          user_id: 0,
                          display_name: newDisplayName.trim(),
                          color: swatchColor
                        })
                      });
                      if (!res.ok) throw new Error("Update failed.");
                      onUpdated({ displayName: newDisplayName.trim() });
                    } catch (err) {
                      setDisplayNameError(err?.message || "Update failed.");
                    } finally {
                      setSavingDisplayName(false);
                    }
                  }}
                  disabled={savingDisplayName}
                  aria-label="Save display name"
                >
                  {savingDisplayName ? "..." : "✓"}
                </button>
                <button
                  className="profile-inline-cancel"
                  type="button"
                  onClick={() => {
                    setNewDisplayName(displayName || "");
                    setDisplayNameError("");
                  }}
                  aria-label="Cancel display name changes"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <div className="profile-army-name">
            <input
              type="text"
              maxLength={50}
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Display name"
            />
            {displayNameError && <span className="profile-color-error">{displayNameError}</span>}
          </div>
        </section>

        <section className="profile-modal-section">
          <div className="profile-section-header">
            <h3>Army Name</h3>
            {newArmyName.trim() !== (armyName || "").trim() && (
              <div className="profile-inline-actions">
                <button
                  className="profile-inline-confirm"
                  type="button"
                  onClick={async () => {
                    setSavingArmyName(true);
                    setArmyNameError("");
                    try {
                      const res = await fetch(`${API_BASE}/api/campaign/army-name`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          campaign_id: Number(campaignId),
                          army_name: newArmyName.trim()
                        })
                      });
                      if (!res.ok) throw new Error("Update failed.");
                      const data = await res.json();
                      onUpdated({ armyName: data?.army_name ?? newArmyName.trim() });
                    } catch (err) {
                      setArmyNameError(err?.message || "Update failed.");
                    } finally {
                      setSavingArmyName(false);
                    }
                  }}
                  disabled={savingArmyName}
                  aria-label="Save army name"
                >
                  {savingArmyName ? "..." : "✓"}
                </button>
                <button
                  className="profile-inline-cancel"
                  type="button"
                  onClick={() => {
                    setNewArmyName(armyName || "");
                    setArmyNameError("");
                  }}
                  aria-label="Cancel army name changes"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <div className="profile-army-name">
            <input
              type="text"
              maxLength={24}
              value={newArmyName}
              onChange={(e) => setNewArmyName(e.target.value)}
              placeholder="Name your army"
            />
            {armyNameError && <span className="profile-color-error">{armyNameError}</span>}
          </div>
        </section>
      </div>
      {previewImageUrl && (
        <div className="profile-image-overlay" onClick={() => setPreviewImageUrl("")}>
          <div className="profile-image-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="profile-image-close"
              type="button"
              onClick={() => setPreviewImageUrl("")}
            >
              ×
            </button>
            <img src={previewImageUrl} alt="Profile preview" />
          </div>
        </div>
      )}
    </div>
  );
}
