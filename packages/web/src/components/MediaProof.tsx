import { useRef, useState } from 'react';
import { uploadFile } from '../lib/api';

interface Props {
  onUpload: (url: string, type: 'image' | 'video') => void;
  onCancel: () => void;
}

export function MediaProof({ onUpload, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const isVideo = file.type.startsWith('video/');
    setPreviewType(isVideo ? 'video' : 'image');
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  async function handleSubmit() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const result = await uploadFile(selectedFile);
      onUpload(result.url, result.type);
    } catch (err) {
      alert('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1.5px solid var(--border)' }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>📸 Add proof</div>

      {!preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost" style={{ width: '100%' }}>
            📁 Choose photo or video
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button onClick={onCancel} className="btn btn-ghost" style={{ width: '100%', fontSize: 12 }}>Skip</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {previewType === 'video' ? (
            <video src={preview} controls style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
          ) : (
            <img src={preview} alt="proof" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setPreview(null); setSelectedFile(null); }} className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}>
              ↩ Retake
            </button>
            <button onClick={handleSubmit} disabled={uploading} className="btn btn-primary" style={{ flex: 2 }}>
              {uploading ? 'Uploading...' : '✓ Submit proof'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
