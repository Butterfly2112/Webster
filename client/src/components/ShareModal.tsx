import React from 'react';

interface ShareModalProps {
  projectTitle: string;
  projectId: string;
  onClose: () => void;
}

export default function ShareModal({ projectTitle, projectId, onClose }: ShareModalProps) {
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/home?shared=${projectId}`;
  const shareText = `Check out my design: ${projectTitle}`;

  const shareLinks = [
    {
      name: 'Facebook',
      icon: '📘',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
      color: '#1877f2'
    },
    {
      name: 'Twitter',
      icon: '𝕏',
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      color: '#000000'
    },
    {
      name: 'LinkedIn',
      icon: '💼',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      color: '#0a66c2'
    },
    {
      name: 'Pinterest',
      icon: '📌',
      url: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(shareText)}`,
      color: '#e60023'
    },
    {
      name: 'WhatsApp',
      icon: '💬',
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      color: '#25d366'
    },
    {
      name: 'Telegram',
      icon: '✈️',
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      color: '#0088cc'
    }
  ];

  const handleShare = (url: string) => {
    window.open(url, 'share-window', 'width=600,height=400');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('Link copied to clipboard!');
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
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
          Share "{projectTitle}"
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Share Link
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={shareUrl}
              readOnly
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                fontFamily: 'monospace',
                background: '#f8fafc',
              }}
            />
            <button
              onClick={copyToClipboard}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#2563eb')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#3b82f6')}
            >
              Copy
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Share on Social Networks
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {shareLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleShare(link.url)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1f2937',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = link.color;
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#1f2937';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span style={{ fontSize: '20px' }}>{link.icon}</span>
                {link.name}
              </button>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
