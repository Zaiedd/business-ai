"use client";

import { type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const slideLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const slideRight = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} transition={{ duration: 0.3, delay }} className={className}>
      {children}
    </motion.div>
  );
}

export function SlideUp({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={slideUp} transition={{ duration: 0.35, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

export function SlideLeft({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={slideLeft} transition={{ duration: 0.35, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

export function SlideRight({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={slideRight} transition={{ duration: 0.35, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={scaleIn} transition={{ duration: 0.3, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={slideUp} transition={{ duration: 0.35, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

export function HoverScale({ children, className, scale = 1.02 }: { children: ReactNode; className?: string; scale?: number }) {
  return (
    <motion.div whileHover={{ scale }} transition={{ type: "spring", stiffness: 400, damping: 17 }} className={className}>
      {children}
    </motion.div>
  );
}

export function AnimatePresence({ children }: { children: ReactNode }) {
  return <motion.div exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}>{children}</motion.div>;
}
