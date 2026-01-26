import React, { useState, useEffect } from 'react';
import './ImageUploadField.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

export default function ImageUploadField({
  label,
  value,
  token,
  presignPath,
  confirmPath,
  presignBody,
  confirmBody,
  maxBytes = 5 * 1024 * 1024,
  emptyLabel = 'No image',
  onUploaded,
  onPreview,
  maxDimension = 768,
  outputType = 'image/webp',
  outputQuality = 0.78,
}) {
  const [preview, setPreview] = useState(value || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreview, setLocalPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreview(value || '');
    }
  }, [value]);

  useEffect(() => {
    if (!selectedFile) {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
        setLocalPreview('');
      }
      return;
    }
    const nextPreview = URL.createObjectURL(selectedFile);
    setLocalPreview(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [selectedFile]);

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type) {
      setError('Please choose a valid image file.');
      return;
    }
    if (file.size > maxBytes) {
      setError('Image too large (max 5MB).');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const processImage = (file) => {
    if (!file) return Promise.resolve(null);
    const inputType = file.type || '';
    const needsResize = maxDimension && maxDimension > 0;
    const canProcess = inputType.startsWith('image/');
    if (!canProcess || !needsResize) {
      return Promise.resolve(file);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const nameBase = (file.name || 'upload').replace(/\.[^.]+$/, '');
            const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
            const processedFile = new File([blob], `${nameBase}.${ext}`, { type: outputType });
            resolve(processedFile);
          },
          outputType,
          outputQuality
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please choose a file first.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const processedFile = await processImage(selectedFile);
      if (!processedFile) {
        throw new Error('Failed to process image.');
      }
      const presignRes = await fetch(`${API_BASE}${presignPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(presignBody(processedFile)),
      });
      if (!presignRes.ok) {
        throw new Error('Failed to get upload URL.');
      }
      const presign = await presignRes.json();
      console.log('[ImageUploadField] presign ok', presign);
      const uploadRes = await fetch(presign.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': processedFile.type,
          ...(presign.cache_control ? { 'Cache-Control': presign.cache_control } : null),
        },
        body: processedFile,
      });
      if (!uploadRes.ok) {
        throw new Error('Upload failed.');
      }
      const confirmRes = await fetch(`${API_BASE}${confirmPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(confirmBody(presign)),
      });
      if (!confirmRes.ok) {
        throw new Error('Failed to save image.');
      }
      const confirmJson = await confirmRes.json();
      const nextUrl = confirmJson?.image_url
        || confirmJson?.profile_image_url
        || confirmJson?.army_image_url
        || presign.file_url;
      console.log('[ImageUploadField] confirm ok', nextUrl);
      setPreview(nextUrl);
      setSelectedFile(null);
      setShowConfirm(false);
      if (onUploaded) {
        onUploaded(nextUrl, confirmJson);
      }
    } catch (err) {
      setError(err?.message || 'Upload failed.');
      setShowConfirm(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="image-upload-field">
      <div
        className="image-upload-preview"
        onClick={() => preview && onPreview && onPreview(preview)}
        role={preview && onPreview ? "button" : undefined}
        tabIndex={preview && onPreview ? 0 : undefined}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && preview && onPreview) {
            onPreview(preview);
          }
        }}
      >
        {(localPreview || preview) ? (
          <img src={localPreview || preview} alt="" />
        ) : (
          <span>{emptyLabel}</span>
        )}
      </div>
      <div className="image-upload-controls">
        {label && <label>{label}</label>}
        {!selectedFile && (
          <label className="image-upload-picker">
            <span className="image-upload-picker-label">Update</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </label>
        )}
        {selectedFile && (
          <div className="image-upload-actions">
            <button
              type="button"
              className="image-upload-btn"
              onClick={() => setShowConfirm(true)}
              disabled={uploading}
            >
              Save
            </button>
            <button
              type="button"
              className="image-upload-btn ghost"
              onClick={() => setSelectedFile(null)}
              disabled={uploading}
            >
              Cancel
            </button>
          </div>
        )}
        {uploading && (
          <span className="image-upload-status">
            Uploading… <span className="image-upload-note">this can took a bit... I just a baby</span>
          </span>
        )}
        {error && <span className="image-upload-error">{error}</span>}
      </div>
      {showConfirm && (
        <div className="image-upload-confirm-overlay">
          <div className="image-upload-confirm">
            <h3>Save this image?</h3>
            <p>This will replace your current image.</p>
            <div className="image-upload-confirm-actions">
              <button
                type="button"
                className="image-upload-btn"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <span className="image-upload-saving">
                    <span className="image-upload-spinner" aria-hidden="true" />
                    Saving… <span className="image-upload-note">this can took a bit... I just a baby</span>
                  </span>
                ) : (
                  'Yes, save'
                )}
              </button>
              <button
                type="button"
                className="image-upload-btn ghost"
                onClick={() => setShowConfirm(false)}
                disabled={uploading}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
