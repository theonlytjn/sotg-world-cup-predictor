import { ImageResponse } from 'next/og';

export const alt = 'SOTG World Cup 2026 Predictor';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#070b08',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: 'absolute',
            width: '900px',
            height: '900px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(159,204,47,0.13) 0%, transparent 65%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
          }}
        />

        {/* FIFA WORLD CUP 2026 badge */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(159,204,47,0.12)',
            border: '1px solid rgba(159,204,47,0.35)',
            borderRadius: '100px',
            padding: '10px 28px',
            marginBottom: '28px',
          }}
        >
          <span
            style={{
              color: '#9fcc2f',
              fontSize: '20px',
              letterSpacing: '0.18em',
              fontWeight: 700,
            }}
          >
            FIFA WORLD CUP 2026
          </span>
        </div>

        {/* SOTG headline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              color: '#f4f6f2',
              fontSize: '108px',
              fontWeight: 900,
              letterSpacing: '-4px',
              lineHeight: 1,
            }}
          >
            SOTG
          </span>
          <span
            style={{
              color: '#9fcc2f',
              fontSize: '46px',
              fontWeight: 900,
              letterSpacing: '0.18em',
            }}
          >
            PREDICTOR
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            color: 'rgba(244,246,242,0.5)',
            fontSize: '24px',
            marginTop: '36px',
            letterSpacing: '0.03em',
            textAlign: 'center',
            display: 'flex',
          }}
        >
          Pick the scoreline · Earn points · Top the table
        </p>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '44px',
            display: 'flex',
          }}
        >
          <span
            style={{
              color: 'rgba(244,246,242,0.28)',
              fontSize: '22px',
              letterSpacing: '0.08em',
            }}
          >
            sotg.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
