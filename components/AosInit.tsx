'use client';

import { useEffect } from 'react';
import AOS from 'aos';

export default function AosInit() {
  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 60, easing: 'ease-out-quad' });
  }, []);
  return null;
}
