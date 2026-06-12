'use client';

import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUp01Icon } from '@hugeicons-pro/core-stroke-rounded';

export default function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className={[
        'fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-lime text-pitch-950 shadow-lg transition-all duration-300 hover:brightness-110 active:scale-95',
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
      ].join(' ')}
    >
      <HugeiconsIcon icon={ArrowUp01Icon} size={20} color="currentColor" strokeWidth={2} />
    </button>
  );
}
