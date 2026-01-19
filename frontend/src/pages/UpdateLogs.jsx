import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import '../styles/UpdateLogs.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

const emptyForm = {
  date: '',
  title: '',
  items: [],
  lineItem: ''
};

export default function UpdateLogs() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const isAdmin = Boolean(user?.is_admin);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEditor, setShowEditor] = useState(false);
  const [editLogId, setEditLogId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const sortedLogs = useMemo(() => logs, [logs]);

  const loadLogs = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/updates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to load update logs');
      }
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load update logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [token]);

  const openAddModal = () => {
    setEditLogId(null);
    setForm(emptyForm);
    setShowEditor(true);
  };

  const openEditModal = (log) => {
    setEditLogId(log.id);
    setForm({
      date: log.date || '',
      title: log.title || '',
      items: Array.isArray(log.items) ? log.items : [],
      lineItem: ''
    });
    setShowEditor(true);
  };

  const handleAddLineItem = () => {
    const value = form.lineItem.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, value],
      lineItem: ''
    }));
  };

  const handleRemoveLineItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        date: form.date,
        title: form.title,
        items: form.items
      };
      const res = await fetch(`${API_BASE}/api/updates${editLogId ? `/${editLogId}` : ''}`, {
        method: editLogId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to save update log');
      }
      setShowEditor(false);
      await loadLogs();
    } catch (err) {
      setError(err?.message || 'Failed to save update log');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (logId) => {
    const fallbackId = logId ?? (logs[0]?.id ?? null);
    setDeleteTargetId(fallbackId);
    setDeleteConfirm('');
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!token || deleteConfirm.trim().toLowerCase() !== 'yes' || !deleteTargetId) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/updates/${deleteTargetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to delete update log');
      }
      setShowDeleteModal(false);
      await loadLogs();
    } catch (err) {
      setError(err?.message || 'Failed to delete update log');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="updates-wrapper">
      <header className="updates-header">
        <div className="updates-header-inner">
          <h1 className="updates-title">Update Logs</h1>
          <div className="updates-actions">
            {isAdmin && (
              <>
                <button className="btn updates-admin-btn" onClick={openAddModal}>
                  Add
                </button>
                <button
                  className="btn updates-admin-btn ghost"
                  onClick={() => openDeleteModal()}
                  disabled={logs.length === 0}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        <p className="updates-subtitle">
          A rolling log of gameplay updates, balance tweaks, and new features.
        </p>
        {error && <div className="updates-error">{error}</div>}
      </header>

      <section className="updates-list">
        {loading ? (
          <div className="updates-card">Loading updates...</div>
        ) : sortedLogs.length === 0 ? (
          <div className="updates-card">No updates yet.</div>
        ) : (
          sortedLogs.map((entry) => (
            <article className="updates-card" key={entry.id}>
              <div className="updates-card-header">
                <div>
                  <div className="updates-card-date">{entry.date}</div>
                  <h2>{entry.title}</h2>
                </div>
                {isAdmin && (
                  <div className="updates-card-actions">
                    <button
                      className="updates-icon-btn"
                      onClick={() => openEditModal(entry)}
                      aria-label="Edit update"
                      title="Edit"
                      type="button"
                    >
                      ✎
                    </button>
                    <button
                      className="updates-icon-btn"
                      onClick={() => openDeleteModal(entry.id)}
                      aria-label="Delete update"
                      title="Delete"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <ul>
                {(entry.items || []).map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </article>
          ))
        )}
      </section>

      {showEditor && (
        <div className="updates-modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="updates-modal" onClick={(event) => event.stopPropagation()}>
            <h2>{editLogId ? 'Edit Update' : 'Add Update'}</h2>
            <label className="updates-label" htmlFor="update-date">Date</label>
            <input
              id="update-date"
              className="updates-input"
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />
            <label className="updates-label" htmlFor="update-title">Title</label>
            <input
              id="update-title"
              className="updates-input"
              type="text"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Release title or version"
            />
            <label className="updates-label" htmlFor="update-item">Line item</label>
            <input
              id="update-item"
              className="updates-input"
              type="text"
              value={form.lineItem}
              onChange={(event) => setForm((prev) => ({ ...prev, lineItem: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddLineItem();
                }
              }}
              placeholder="Type a bullet point and press Enter"
            />
            <button className="btn ghost" onClick={handleAddLineItem}>
              Add Line
            </button>
            <div className="updates-items-preview">
              {form.items.length === 0 ? (
                <p>No line items yet.</p>
              ) : (
                <ul>
                  {form.items.map((item, index) => (
                    <li key={index}>
                      <input
                        className="updates-line-input"
                        type="text"
                        value={item}
                        onChange={(event) => {
                          const value = event.target.value;
                          setForm((prev) => ({
                            ...prev,
                            items: prev.items.map((entry, idx) => (
                              idx === index ? value : entry
                            ))
                          }));
                        }}
                      />
                      <button
                        className="updates-remove"
                        onClick={() => handleRemoveLineItem(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="updates-modal-actions">
              <button className="btn ghost" onClick={() => setShowEditor(false)}>
                Cancel
              </button>
              <button className="btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Finish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="updates-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="updates-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Delete Update</h2>
            <p>Type "yes" to confirm deletion.</p>
            <label className="updates-label" htmlFor="delete-target">
              Select update
            </label>
            <select
              id="delete-target"
              className="updates-input"
              value={deleteTargetId ?? ''}
              onChange={(event) => setDeleteTargetId(Number(event.target.value))}
            >
              {logs.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.date} — {entry.title}
                </option>
              ))}
            </select>
            <input
              className="updates-input"
              type="text"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="yes"
            />
            <div className="updates-modal-actions">
              <button className="btn ghost" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm.trim().toLowerCase() !== 'yes'}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
