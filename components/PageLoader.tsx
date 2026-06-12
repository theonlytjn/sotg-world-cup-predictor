'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function PageLoader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 900);
    const t2 = setTimeout(() => setVisible(false), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={[
        'fixed inset-0 z-[9999] flex items-center justify-center bg-pitch-950 transition-opacity duration-500',
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100',
      ].join(' ')}
    >
      <div className="animate-pulse w-56 sm:w-72">
        <Image
          src="/loading-logo.svg"
          alt="Students of the Game"
          width={1147}
          height={358}
          priority
          className="w-full h-auto"
        />
      </div>
    </div>
  );
}
