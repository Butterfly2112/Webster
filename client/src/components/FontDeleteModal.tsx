import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { deleteFont } from '../api/font';
import type { Font } from '../api/types';

interface FontDeleteModalProps {
  fonts: Font[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function FontDeleteModal({ fonts, onClose, onSuccess }: FontDeleteModalProps) {
  const [selectedFontId, setSelectedFontId] = React.useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (selectedFontId === null) throw new Error('Font not selected');
      return deleteFont(selectedFontId);
    },
    onSuccess: () => {
      setSelectedFontId(null);
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      console.error(err);
    },
  });

  const userFonts = fonts.filter((f) => f.owner_id !== null);

  if (userFonts.length === 0) {
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
            Delete Font
          </h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            No custom fonts to delete.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
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
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          maxHeight: '60vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
          Delete Font
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
            Select font to delete
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {userFonts.map((font) => (
              <div
                key={font.id}
                onClick={() => setSelectedFontId(font.id)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: selectedFontId === font.id ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  background: selectedFontId === font.id ? '#fee2e2' : '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: font.name,
                  fontSize: '14px',
                }}
              >
                {font.name}
              </div>
            ))}
          </div>
        </div>

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
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending || selectedFontId === null}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: deleteMutation.isPending || selectedFontId === null ? '#cbd5e1' : '#ef4444',
              color: '#fff',
              cursor: deleteMutation.isPending || selectedFontId === null ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => {
              if (!deleteMutation.isPending && selectedFontId !== null) {
                e.currentTarget.style.background = '#dc2626';
              }
            }}
            onMouseOut={(e) => {
              if (!deleteMutation.isPending && selectedFontId !== null) {
                e.currentTarget.style.background = '#ef4444';
              }
            }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
