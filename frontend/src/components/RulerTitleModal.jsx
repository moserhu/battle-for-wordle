// frontend/src/components/RulerTitleModal.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/RulerTitleModal.css";
import ImageUploadField from "./uploads/ImageUploadField";

export default function RulerTitleModal({
  visible,
  initialTitle,
  onSave,
  onClose,
  token,
  campaignId,
  rulerBackdropUrl,
  onBackdropSaved,
}) {
  const [title, setTitle] = useState(initialTitle || "");

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle || "");
    }
  }, [visible, initialTitle]);

  if (!visible) return null;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    onSave(nextTitle);
  };

  const handleResetBackdrop = async () => {
    if (!token || !campaignId) return;
    try {
      await fetch(`${process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`}/api/campaign/ruler-background/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaign_id: Number(campaignId) }),
      });
      if (onBackdropSaved) {
        onBackdropSaved("");
      }
    } catch (err) {
      // silent fail for now
    }
  };

  const modal = (
    <div className="ruler-modal-backdrop" onClick={handleBackdropClick}>
      <div className="ruler-modal">
        <button
          className="ruler-modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          −
        </button>
        <h2>Royal Orders</h2>
        <p>Issue your title and set the realm’s backdrop.</p>
        <div className="ruler-modal-section">
          <div className="ruler-modal-section-title">Ruler Title</div>
          <form className="ruler-modal-form" onSubmit={handleSubmit}>
          <input
            className="ruler-modal-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={30}
            placeholder="Current Ruler"
          />
          {title.length >= 30 && (
            <div className="ruler-modal-hint">Max 30 characters.</div>
          )}
          <div className="ruler-modal-actions">
            <button className="ruler-modal-btn primary" type="submit">
              Save
            </button>
            <button className="ruler-modal-btn" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
          </form>
        </div>
        {campaignId && token && (
          <div className="ruler-backdrop-section ruler-modal-section">
            <div className="ruler-modal-section-title">Battle Backdrop</div>
            <ImageUploadField
              label="Ruler backdrop"
              value={rulerBackdropUrl || ''}
              token={token}
              presignPath="/api/campaign/ruler-background/presign"
              confirmPath="/api/campaign/ruler-background/confirm"
              presignBody={(file) => ({
                campaign_id: Number(campaignId),
                filename: file.name,
                content_type: file.type,
              })}
              confirmBody={(presign) => ({
                campaign_id: Number(campaignId),
                key: presign.key,
                file_url: presign.file_url,
              })}
              maxDimension={1920}
              outputQuality={0.9}
              emptyLabel="No backdrop"
              onUploaded={(url) => {
                if (onBackdropSaved) {
                  onBackdropSaved(url);
                }
              }}
            />
            <div className="ruler-backdrop-default">
              <div className="ruler-backdrop-default-preview" aria-hidden="true" />
              <button
                type="button"
                className="ruler-modal-btn"
                onClick={handleResetBackdrop}
              >
                Use default background
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
