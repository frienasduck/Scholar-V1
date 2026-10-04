"use client";

import { motion, useIsPresent, type HTMLMotionProps } from "framer-motion";
import type { Ref } from "react";

export function getLamPanelMotion(reducedMotion: boolean) {
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: {
      ...(reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.975 }),
      transition: {
        duration: reducedMotion ? 0.01 : 0.2,
        ease: [0.4, 0, 1, 1] as [number, number, number, number],
      },
    },
    transition: {
      duration: reducedMotion ? 0.01 : 0.22,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  };
}

type LamPanelSurfaceProps = HTMLMotionProps<"div"> & {
  reducedMotion: boolean;
  ref?: Ref<HTMLDivElement>;
};

// AnimatePresence keeps this surface mounted for its exit. Remove interaction
// immediately, but keep its geometry intact until the animation has finished.
export function LamPanelSurface({ reducedMotion, style, ...props }: LamPanelSurfaceProps) {
  const present = useIsPresent();
  return (
    <motion.div
      {...props}
      {...getLamPanelMotion(reducedMotion)}
      inert={!present}
      aria-hidden={!present || undefined}
      data-lam-panel-state={present ? "open" : "closing"}
      style={{ ...style, transformOrigin: "50% 0%", pointerEvents: present ? undefined : "none" }}
    />
  );
}

export function LamDismissScrim({ reducedMotion, ...props }: HTMLMotionProps<"button"> & { reducedMotion: boolean }) {
  const present = useIsPresent();
  return (
    <motion.button
      {...props}
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.16 }}
      inert={!present}
      disabled={!present}
      aria-hidden={!present || undefined}
    />
  );
}
