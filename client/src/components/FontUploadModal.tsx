import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { uploadFont } from '../api/font';

interface FontUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function FontUploadModal({ onClose, onSuccess }: FontUploadModalProps) {
  const [fontName, setFontName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!fontName.trim()) {
        throw new Error('Font name is required');
      }
      if (!selectedFile) {
        throw new Error('Font file is required');
      }
      return uploadFont(fontName, selectedFile);
    },
    onSuccess: () => {
      setFontName('');
      setSelectedFile(null);
      setError('');
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to upload font');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['font/ttf', 'font/woff', 'font/woff2', 'font/otf', 'application/octet-stream'];
    const validExtensions = ['.ttf', '.woff', '.woff2', '.otf'];

    const isValidType = validTypes.includes(file.type) || validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType) {
      setError('Invalid file type. Only TTF, WOFF, WOFF2, and OTF allowed');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Font file too large. Max 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
          Upload Custom Font
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
            Font Name
          </label>
          <input
            type="text"
            value={fontName}
            onChange={(e) => {
              setFontName(e.target.value);
              setError('');
            }}
            placeholder="e.g., My Custom Font"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
            Font File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".ttf,.woff,.woff2,.otf"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0 0' }}>
            Supported formats: TTF, WOFF, WOFF2, OTF (Max 5MB)
          </p>
        </div>

        {selectedFile && (
          <div style={{ marginBottom: '16px', padding: '8px', background: '#f0f9ff', borderRadius: '6px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#0284c7' }}>
              Selected: {selectedFile.name}
            </p>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: '16px', padding: '8px', background: '#fee2e2', borderRadius: '6px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#dc2626' }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#f8fafc')}
          >
            Cancel
          </button>
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || !fontName.trim() || !selectedFile}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: uploadMutation.isPending || !fontName.trim() || !selectedFile ? '#cbd5e1' : '#3b82f6',
              color: '#fff',
              cursor: uploadMutation.isPending || !fontName.trim() || !selectedFile ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => {
              if (!uploadMutation.isPending && fontName.trim() && selectedFile) {
                e.currentTarget.style.background = '#2563eb';
              }
            }}
            onMouseOut={(e) => {
              if (!uploadMutation.isPending && fontName.trim() && selectedFile) {
                e.currentTarget.style.background = '#3b82f6';
              }
            }}
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
