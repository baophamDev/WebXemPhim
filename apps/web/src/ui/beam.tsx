/**
 * Viền led chuyển động cho panel hero, dùng lib `border-beam`.
 *
 * Vì sao dùng lib thay vì keyframes tay (`aurora-flow` cũ): keyframes cũ animate
 * `background-position` 0 → 220% rồi nhảy về 0 nên mỗi vòng loop giật một cái,
 * stop trắng ở giữa quét qua rất gắt trên màn hình hẹp, và animate `background`
 * là repaint bằng CPU mỗi frame. Lib vẽ beam bằng conic-gradient + mask, có
 * `prefers-reduced-motion`, giới hạn blur và `will-change` đúng chỗ.
 *
 * Tông màu khóa theo bảng của trang (cam cháy — hổ phách — kem): `sunset` +
 * `staticColors` để lib không xoay hue sang cầu vồng, `duration` chậm và
 * `strength` vừa để vệt sáng lướt nhẹ thay vì chém đôi panel.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { BorderBeam } from 'border-beam';

/** Tắt chuyển động khi người dùng yêu cầu giảm motion ở cấp hệ điều hành. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function HeroPanelBeam({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  return <BorderBeam
    size="md"
    colorVariant="sunset"
    theme="dark"
    staticColors
    duration={6}
    strength={0.65}
    borderRadius={16}
    active={!reduced}
    className="hero-beam"
  >
    {children}
  </BorderBeam>;
}
